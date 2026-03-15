"use client";

import { FormEvent, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "../page.module.css";
import { authClient } from "@/lib/auth-client";
import { GoogleLogo } from "@/app/components/GoogleLogo";
import { COMMUNES_FRANCE } from "@/data/communes-france";
import {
  SECTOR_LABELS,
  SECTOR_ORDER,
  SECTORS_SPECIALTIES,
  type SectorId,
} from "@/data/sectors-specialties";

type RunMode = "pipeline" | "hunter" | "generate" | "drafts";
type Zone = string;

type RunListItem = {
  run_id: string;
  status: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  exit_code: number | null;
  pid: number | null;
  cancel_requested: boolean;
  log_file: string;
  zone?: string | null;
  duration_seconds?: number | null;
  targets_found?: number | null;
  target_found?: number | null;
  emails_generated?: number | null;
  drafts_generated?: number | null;
};

type RunStatusResponse = {
  run_id: string;
  status: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  exit_code: number | null;
  command: string[];
  pid: number | null;
  cancel_requested: boolean;
  log_file: string;
  logs_tail: string[];
  zone?: string | null;
  duration_seconds?: number | null;
  targets_found?: number | null;
  target_found?: number | null;
  emails_generated?: number | null;
  drafts_generated?: number | null;
};

const END_STATUSES = new Set(["succeeded", "failed", "cancelled"]);
type ThemeMode = "light" | "dark";
const MODE_LABELS: Record<RunMode, string> = {
  pipeline: "Recherche complète",
  hunter: "Recherche d'entreprises",
  generate: "Génération des lettres",
  drafts: "Création des brouillons Gmail",
};

const ZONE_PLACEHOLDER =
  "Tapez une ville (ex: Paris) — laissez vide pour toute la France";

const KNOWN_ZONES: readonly Zone[] = ["all", ...COMMUNES_FRANCE];

async function safeJson<T>(response: Response): Promise<T | Record<string, unknown>> {
  const rawBody = await response.text();
  if (!rawBody) {
    return {};
  }
  try {
    return JSON.parse(rawBody) as T;
  } catch {
    return {};
  }
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
}

function formatDuration(
  startedAt: string | null,
  finishedAt: string | null,
  explicitSeconds?: number | null,
): string {
  if (typeof explicitSeconds === "number" && explicitSeconds >= 0) {
    const minutes = Math.floor(explicitSeconds / 60);
    const seconds = explicitSeconds % 60;
    return `${minutes} min ${seconds.toString().padStart(2, "0")} s`;
  }
  if (!startedAt) {
    return "-";
  }
  const startMs = new Date(startedAt).getTime();
  const endMs = finishedAt ? new Date(finishedAt).getTime() : Date.now();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) {
    return "-";
  }
  const deltaSeconds = Math.floor((endMs - startMs) / 1000);
  const hours = Math.floor(deltaSeconds / 3600);
  const minutes = Math.floor((deltaSeconds % 3600) / 60);
  const seconds = deltaSeconds % 60;
  if (hours > 0) {
    return `${hours} h ${minutes.toString().padStart(2, "0")} min`;
  }
  return `${minutes} min ${seconds.toString().padStart(2, "0")} s`;
}

function formatOptionalNumber(value: number | null | undefined): string {
  return typeof value === "number" ? String(value) : "-";
}

function getStatusTone(status: string): "running" | "success" | "failed" | "neutral" {
  const normalized = status.toLowerCase();
  if (normalized === "succeeded" || normalized === "success") {
    return "success";
  }
  if (normalized === "failed" || normalized === "error") {
    return "failed";
  }
  if (normalized === "cancelled") {
    return "neutral";
  }
  return "running";
}

type StepStatus = "pending" | "running" | "done" | "error";
type PipelineStep = { id: string; label: string; status: StepStatus; icon: string };

function getPipelineStepsFromLogs(logsTail: string[], runStatus: string): PipelineStep[] {
  const text = logsTail.join("\n");
  const normalizedStatus = runStatus.toLowerCase();
  const steps: PipelineStep[] = [
    { id: "hunter", label: "Recherche d'entreprises", status: "pending", icon: "🔍" },
    { id: "generate", label: "Génération des lettres de motivation", status: "pending", icon: "📄" },
    { id: "drafts", label: "Création des brouillons Gmail", status: "pending", icon: "✉️" },
  ];
  const hunterStarted = /ETAPE:\s*hunter/i.test(text);
  const generateStarted = /ETAPE:\s*generate/i.test(text);
  const draftsStarted = /ETAPE:\s*drafts/i.test(text);
  const pipelineDone = /Pipeline termine/i.test(text);

  if (pipelineDone || normalizedStatus === "succeeded") {
    steps[0].status = "done";
    steps[1].status = "done";
    steps[2].status = "done";
    return steps;
  }
  if (normalizedStatus === "failed" || normalizedStatus === "cancelled") {
    if (draftsStarted) {
      steps[0].status = "done";
      steps[1].status = "done";
      steps[2].status = "error";
    } else if (generateStarted) {
      steps[0].status = "done";
      steps[1].status = "error";
    } else if (hunterStarted) {
      steps[0].status = "error";
    }
    return steps;
  }
  if (draftsStarted) {
    steps[0].status = "done";
    steps[1].status = "done";
    steps[2].status = "running";
  } else if (generateStarted) {
    steps[0].status = "done";
    steps[1].status = "running";
  } else if (hunterStarted) {
    steps[0].status = "running";
  }
  return steps;
}

type ProgressCounts = { companiesFound: number; lettersWritten: number; draftsCreated: number };

/** Compte le nombre de lignes "✅ FOUND" dans les logs (1 FOUND = 1 email trouvé). */
function countFoundInLogs(logsTail: string[]): number {
  return logsTail.filter((line) => /✅\s*FOUND/i.test(line)).length;
}

function getProgressCountsFromLogs(logsTail: string[]): ProgressCounts {
  const text = logsTail.join("\n");
  let companiesFound = 0;
  let lettersWritten = 0;
  let draftsCreated = 0;

  const foundFromLines = countFoundInLogs(logsTail);
  if (foundFromLines > 0) companiesFound = foundFromLines;

  const foundMatch = text.match(/FOUND:\s*(\d+)/);
  if (foundMatch) companiesFound = Math.max(companiesFound, parseInt(foundMatch[1], 10));

  const entreprisesMatch = text.match(/Entreprises trouvées:\s*(\d+)/);
  if (entreprisesMatch) companiesFound = Math.max(companiesFound, parseInt(entreprisesMatch[1], 10));

  const lmMatch = text.match(/LM générées\s*:\s*(\d+)/);
  if (lmMatch) lettersWritten = Math.max(lettersWritten, parseInt(lmMatch[1], 10));

  const creesMatch = text.match(/créés=(\d+)/g);
  if (creesMatch) {
    const last = creesMatch[creesMatch.length - 1];
    const m = last.match(/créés=(\d+)/);
    if (m) draftsCreated = Math.max(draftsCreated, parseInt(m[1], 10));
  }
  const termineeMatch = text.match(/Créés:\s*(\d+)/);
  if (termineeMatch) draftsCreated = Math.max(draftsCreated, parseInt(termineeMatch[1], 10));

  return { companiesFound, lettersWritten, draftsCreated };
}

/** Détecte le mode lancé (hunter, generate, drafts, pipeline) depuis la commande du run. */
function getLaunchedModeFromCommand(command: string[] | undefined): RunMode | null {
  if (!command?.length) return null;
  const idx = command.indexOf("--mode");
  if (idx === -1 || idx + 1 >= command.length) return null;
  const mode = command[idx + 1]?.toLowerCase();
  if (mode === "hunter" || mode === "generate" || mode === "drafts" || mode === "pipeline") return mode as RunMode;
  return null;
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDemoView = searchParams.get("demo") === "1";
  const [accessState, setAccessState] = useState<
    "checking" | "unauthenticated" | "granted" | "forbidden"
  >("checking");
  const [accessError, setAccessError] = useState("");
  const [gmailConnected, setGmailConnected] = useState(false);
  const [googleAccountLinked, setGoogleAccountLinked] = useState(false);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [mailSubjectTemplate, setMailSubjectTemplate] = useState("");
  const [mailBodyTemplate, setMailBodyTemplate] = useState("");
  const [profileInfo, setProfileInfo] = useState("");
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [isUploadingAssets, setIsUploadingAssets] = useState(false);
  const [assetInfo, setAssetInfo] = useState("");
  const [draftInfo, setDraftInfo] = useState("");
  const [templateUploaded, setTemplateUploaded] = useState(false);
  const [cvUploaded, setCvUploaded] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [mode, setMode] = useState<RunMode>("pipeline");
  const [zones, setZones] = useState<Zone[]>([]);
  const [zoneQuery, setZoneQuery] = useState("");
  const [zoneSuggestions, setZoneSuggestions] = useState<Zone[]>([]);
  const [isZoneFocused, setIsZoneFocused] = useState(false);
  const MAX_ZONES = 5;
  const [sector, setSector] = useState("it");
  const [specialty, setSpecialty] = useState("");
  const [dryRun, setDryRun] = useState(false);
  const [maxMinutes, setMaxMinutes] = useState(30);
  const [maxSites, setMaxSites] = useState(1500);
  const [targetFound, setTargetFound] = useState(100);
  const [workers, setWorkers] = useState(20);
  const [useAi, setUseAi] = useState(false);
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [isLaunchingRun, setIsLaunchingRun] = useState(false);
  const [isRefreshingRuns, setIsRefreshingRuns] = useState(false);
  const [isRefreshingDetails, setIsRefreshingDetails] = useState(false);
  const [isCancellingRun, setIsCancellingRun] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [runs, setRuns] = useState<RunListItem[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [runDetails, setRunDetails] = useState<RunStatusResponse | null>(null);
  const [autoScrollLogs, setAutoScrollLogs] = useState(true);
  const [isTerminalFullscreen, setIsTerminalFullscreen] = useState(false);
  const [terminalFlash, setTerminalFlash] = useState(false);
  const [animatedLogs, setAnimatedLogs] = useState("");
  const [isTypingLogs, setIsTypingLogs] = useState(false);
  const [showLogsSection, setShowLogsSection] = useState(false);
  const [isDraggingDocs, setIsDraggingDocs] = useState(false);
  const logsRef = useRef<HTMLPreElement | null>(null);
  const typingTimerRef = useRef<number | null>(null);
  const animatedLogsRef = useRef("");
  const showDemoBanner = accessState === "unauthenticated" && isDemoView;

  const pipelineStepsRaw = useMemo(() => {
    if (!runDetails?.logs_tail?.length) return null;
    return getPipelineStepsFromLogs(runDetails.logs_tail, runDetails.status);
  }, [runDetails?.logs_tail, runDetails?.status]);

  const pipelineSteps = useMemo(() => {
    const mode = getLaunchedModeFromCommand(runDetails?.command ?? undefined);
    if (!pipelineStepsRaw || !mode) return pipelineStepsRaw;
    if (mode === "hunter") return pipelineStepsRaw.slice(0, 1);
    if (mode === "generate") return pipelineStepsRaw.slice(0, 2);
    return pipelineStepsRaw;
  }, [pipelineStepsRaw, runDetails?.command]);

  const progressCounts = useMemo(() => {
    if (!runDetails?.logs_tail?.length) return null;
    return getProgressCountsFromLogs(runDetails.logs_tail);
  }, [runDetails?.logs_tail]);

  const launchedMode = useMemo(
    () => getLaunchedModeFromCommand(runDetails?.command ?? undefined),
    [runDetails?.command],
  );

  useEffect(() => {
    const saved = window.localStorage.getItem("alternance-ui-theme");
    const initialTheme: ThemeMode = saved === "dark" || saved === "light" ? saved : "light";
    setTheme(initialTheme);
    document.documentElement.dataset.theme = initialTheme;
  }, []);

  useEffect(() => {
    const onThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<ThemeMode>;
      if (customEvent.detail === "dark" || customEvent.detail === "light") {
        setTheme(customEvent.detail);
      }
    };
    window.addEventListener("alternance-theme-change", onThemeChange);
    return () => window.removeEventListener("alternance-theme-change", onThemeChange);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("alternance-ui-theme", theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    let isCancelled = false;

    async function verifyAccess() {
      try {
        const response = await fetch("/api/auth/authorized", { cache: "no-store" });

        if (isCancelled) {
          return;
        }

        if (response.status === 401) {
          setAccessState("unauthenticated");
          return;
        }

        if (!response.ok) {
          const data = (await safeJson<{ detail?: string }>(response)) as { detail?: string };
          setAccessError(
            data.detail ??
              "Acces refuse. Votre session est absente ou votre email n'est pas autorise.",
          );
          setAccessState("forbidden");
          return;
        }

        const data = (await safeJson<{
          gmail_connected?: boolean;
          google_account_linked?: boolean;
        }>(response)) as {
          gmail_connected?: boolean;
          google_account_linked?: boolean;
        };
        setGmailConnected(Boolean(data.gmail_connected));
        setGoogleAccountLinked(Boolean(data.google_account_linked));
        setAccessState("granted");
      } catch {
        if (!isCancelled) {
          setAccessError("Impossible de verifier votre session. Reessayez dans quelques instants.");
          setAccessState("forbidden");
        }
      }
    }

    void verifyAccess();

    return () => {
      isCancelled = true;
    };
  }, [router]);

  const refreshRuns = useCallback(async (): Promise<RunListItem[]> => {
    setIsRefreshingRuns(true);
    try {
      const response = await fetch("/api/runs?limit=30", { cache: "no-store" });
      const data = (await safeJson<{ runs: RunListItem[]; detail?: string }>(
        response,
      )) as { runs?: RunListItem[]; detail?: string };
      if (!response.ok) {
        throw new Error(data.detail ?? "Impossible de récupérer la liste des recherches.");
      }
      const nextRuns = [...(data.runs ?? [])].reverse();
      setRuns(nextRuns);
      if (!activeRunId && nextRuns[0]?.run_id) {
        setActiveRunId(nextRuns[0].run_id);
      }
      return nextRuns;
    } finally {
      setIsRefreshingRuns(false);
    }
  }, [activeRunId]);

  const refreshRunDetails = useCallback(
    async (runId?: string | null) => {
      const runIdToLoad = runId ?? activeRunId;
      if (!runIdToLoad) {
        setRunDetails(null);
        return;
      }
      setIsRefreshingDetails(true);
      try {
        const response = await fetch(`/api/runs/${runIdToLoad}?tail=400`, {
          cache: "no-store",
        });
        const data = (await safeJson<RunStatusResponse & { detail?: string }>(
          response,
        )) as Partial<RunStatusResponse> & { detail?: string };

        if (!response.ok) {
          if (
            response.status === 404 &&
            typeof data.detail === "string" &&
            data.detail.includes("Run '") &&
            data.detail.includes("not found")
          ) {
            // Cas transitoire / instance backend differente : ne pas afficher d'erreur bloquante.
            setRunDetails(null);
            setActiveRunId(null);
            return;
          }
          throw new Error(data.detail ?? `Impossible de récupérer cette recherche.`);
        }

        setRunDetails(data as RunStatusResponse);
      } finally {
        setIsRefreshingDetails(false);
      }
    },
    [activeRunId],
  );

  const refreshAll = useCallback(async () => {
    setError("");
    try {
      const latestRuns = await refreshRuns();
      const runIdToLoad = activeRunId ?? latestRuns[0]?.run_id ?? null;
      await refreshRunDetails(runIdToLoad);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue.";
      setError(message);
    }
  }, [activeRunId, refreshRuns, refreshRunDetails]);

  useEffect(() => {
    if (accessState !== "granted") {
      return;
    }
    void refreshAll();
  }, [accessState, refreshAll]);

  useEffect(() => {
    if (accessState !== "granted") {
      return;
    }
    let cancelled = false;

    async function loadProfile() {
      setIsProfileLoading(true);
      try {
        const response = await fetch("/api/profile", { cache: "no-store" });
        const data = (await safeJson<{
          detail?: string;
          profile?: {
            first_name?: string;
            last_name?: string;
            linkedin_url?: string;
            portfolio_url?: string;
            subject_template?: string;
            body_template?: string;
            run_mode?: RunMode;
            run_zone?: Zone;
            run_sector?: string;
            run_specialty?: string;
            run_dry_run?: boolean;
            run_max_minutes?: number;
            run_max_sites?: number;
            run_target_found?: number;
            run_workers?: number;
            run_use_ai?: boolean;
          };
        }>(response)) as {
          detail?: string;
          profile?: {
            first_name?: string;
            last_name?: string;
            linkedin_url?: string;
            portfolio_url?: string;
            subject_template?: string;
            body_template?: string;
            run_mode?: RunMode;
            run_zone?: Zone;
            run_sector?: string;
            run_specialty?: string;
            run_dry_run?: boolean;
            run_max_minutes?: number;
            run_max_sites?: number;
            run_target_found?: number;
            run_workers?: number;
            run_use_ai?: boolean;
          };
        };
        if (!response.ok) {
          throw new Error(data.detail ?? "Impossible de charger votre profil.");
        }
        if (cancelled) {
          return;
        }
        setFirstName(data.profile?.first_name ?? "");
        setLastName(data.profile?.last_name ?? "");
        setLinkedinUrl(data.profile?.linkedin_url ?? "");
        setPortfolioUrl(data.profile?.portfolio_url ?? "");
        setMailSubjectTemplate(data.profile?.subject_template ?? "");
        setMailBodyTemplate(data.profile?.body_template ?? "");
        if (data.profile?.run_mode) {
          setMode(data.profile.run_mode);
        }
        if (data.profile?.run_zone) {
          const raw = (data.profile.run_zone as string).trim();
          if (raw && raw.toLowerCase() !== "all") {
            const list = raw
              .split(",")
              .map((z) => z.trim())
              .filter((z) => z.length > 0)
              .slice(0, MAX_ZONES);
            setZones(list);
          }
        }
        if (data.profile?.run_sector) {
          setSector(data.profile.run_sector);
        }
        setSpecialty(data.profile?.run_specialty ?? "");
        setDryRun(Boolean(data.profile?.run_dry_run));
        setMaxMinutes(Number(data.profile?.run_max_minutes ?? 30));
        setMaxSites(Number(data.profile?.run_max_sites ?? 1500));
        setTargetFound(Number(data.profile?.run_target_found ?? 100));
        setWorkers(Number(data.profile?.run_workers ?? 20));
        setUseAi(Boolean(data.profile?.run_use_ai));
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Erreur de chargement du profil.";
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setIsProfileLoading(false);
        }
      }
    }

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [accessState]);

  useEffect(() => {
    if (accessState !== "granted") {
      return;
    }
    let cancelled = false;

    async function loadUploadStatus() {
      try {
        const response = await fetch("/api/uploads", { method: "GET", cache: "no-store" });
        const data = (await safeJson<{
          ok?: boolean;
          cv_uploaded?: boolean;
          template_uploaded?: boolean;
          draft_uploaded?: boolean;
        }>(response)) as {
          ok?: boolean;
          cv_uploaded?: boolean;
          template_uploaded?: boolean;
          draft_uploaded?: boolean;
        };
        if (!response.ok || !data.ok || cancelled) {
          return;
        }
        setTemplateUploaded(Boolean(data.template_uploaded));
        setCvUploaded(Boolean(data.cv_uploaded));
        if (data.cv_uploaded && data.template_uploaded) {
          setAssetInfo("CV et template LM deja enregistres pour ce compte.");
        } else if (data.cv_uploaded) {
          setAssetInfo("CV deja enregistre pour ce compte.");
        } else if (data.template_uploaded) {
          setAssetInfo("Template LM deja enregistre pour ce compte.");
        }
        if (data.draft_uploaded) {
          setDraftInfo("Un fichier draft_emails.txt existe deja pour ce compte.");
        } else {
          setDraftInfo("Aucun draft_emails.txt existant pour ce compte pour le moment.");
        }
      } catch {
        // Ignore upload status failures to avoid blocking the dashboard.
      }
    }

    void loadUploadStatus();
    return () => {
      cancelled = true;
    };
  }, [accessState]);

  const activeRun = useMemo(
    () => runs.find((run) => run.run_id === activeRunId) ?? null,
    [runs, activeRunId],
  );
  const isRunning = runDetails ? !END_STATUSES.has(runDetails.status) : false;
  const logsText = runDetails?.logs_tail.join("\n") ?? "";
  const draftsRequireGmail = mode === "drafts" && !gmailConnected;
  const templateRequired = mode === "pipeline" || mode === "generate";
  const cvRequired = mode === "pipeline" || mode === "drafts";
  const launchDisabled =
    isLaunchingRun ||
    draftsRequireGmail ||
    (templateRequired && !templateUploaded) ||
    (cvRequired && !cvUploaded);
  const launchButtonLabel = isLaunchingRun
    ? "Lancement en cours..."
    : draftsRequireGmail
      ? "Connexion Gmail requise"
      : templateRequired && !templateUploaded
        ? "Template LM requis (déposez un fichier ci-dessus)"
        : cvRequired && !cvUploaded
          ? "CV obligatoire (déposez votre CV ci-dessus)"
          : "▶️ Lancer la recherche";
  const demoLaunchDisabled = showDemoBanner || launchDisabled;
  const demoLaunchLabel = showDemoBanner ? "Connectez-vous pour lancer une recherche" : launchButtonLabel;

  useEffect(() => {
    animatedLogsRef.current = animatedLogs;
  }, [animatedLogs]);

  useEffect(() => {
    if (accessState !== "granted") {
      return;
    }
    const intervalMs = isRunning ? 5000 : 5000;
    const intervalId = window.setInterval(() => {
      void refreshAll();
    }, intervalMs);
    return () => window.clearInterval(intervalId);
  }, [accessState, isRunning, refreshAll]);

  useEffect(() => {
    if (typingTimerRef.current) {
      window.clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }

    const currentAnimated = animatedLogsRef.current;
    if (!logsText) {
      setAnimatedLogs("");
      setIsTypingLogs(false);
      return;
    }

    if (!logsText.startsWith(currentAnimated)) {
      setAnimatedLogs(logsText);
      setIsTypingLogs(false);
      return;
    }

    const pending = logsText.slice(currentAnimated.length);
    if (!pending) {
      setIsTypingLogs(false);
      return;
    }

    setIsTypingLogs(true);
    let cursor = 0;
    const chunkSize = pending.length > 240 ? 6 : 2;
    const delayMs = 14;

    const typeStep = () => {
      const nextChunk = pending.slice(cursor, cursor + chunkSize);
      cursor += chunkSize;
      setAnimatedLogs((prev) => prev + nextChunk);
      if (cursor < pending.length) {
        typingTimerRef.current = window.setTimeout(typeStep, delayMs);
      } else {
        setIsTypingLogs(false);
      }
    };

    typingTimerRef.current = window.setTimeout(typeStep, 10);
    return () => {
      if (typingTimerRef.current) {
        window.clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
    };
  }, [logsText]);

  useEffect(() => {
    if (autoScrollLogs && logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [autoScrollLogs, animatedLogs]);

  useEffect(() => {
    if (!logsText) {
      return;
    }
    setTerminalFlash(true);
    const timer = window.setTimeout(() => setTerminalFlash(false), 450);
    return () => window.clearTimeout(timer);
  }, [logsText]);

  useEffect(() => {
    if (!isTerminalFullscreen) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsTerminalFullscreen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isTerminalFullscreen]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setError("Renseignez votre prenom et nom dans 'Profil expediteur' avant de lancer.");
      setInfo("");
      return;
    }
    if (draftsRequireGmail) {
      setError(
        "Connexion Gmail requise pour le mode brouillons. Connectez votre compte Google puis reessayez.",
      );
      setInfo("");
      return;
    }
    setIsLaunchingRun(true);
    setError("");
    setInfo("");
    try {
      const payload = {
        mode,
        zone: zones.length ? zones.join(", ") : "all",
        sector,
        specialty: specialty || undefined,
        dry_run: dryRun,
        max_minutes: maxMinutes,
        max_sites: maxSites,
        target_found: targetFound,
        workers,
        use_ai: useAi,
        ...(useAi && openaiApiKey.trim() ? { openai_api_key: openaiApiKey.trim() } : {}),
      };
      const response = await fetch("/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await safeJson<{
        run_id?: string;
        detail?: unknown;
        message?: unknown;
      }>(response)) as { run_id?: string; detail?: unknown; message?: unknown };
      if (!response.ok || !data.run_id) {
        const rawDetail = data.detail ?? data.message;
        let friendlyMessage = "Échec du lancement de la recherche.";
        if (typeof rawDetail === "string" && rawDetail.trim()) {
          friendlyMessage = rawDetail.trim();
        } else if (rawDetail && typeof rawDetail === "object") {
          try {
            friendlyMessage = JSON.stringify(rawDetail);
          } catch {
            // ignore, keep default message
          }
        }
        throw new Error(friendlyMessage);
      }

      setInfo(`Recherche lancée.`);
      setActiveRunId(data.run_id);
      await refreshAll();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue.";
      setError(message);
    } finally {
      setIsLaunchingRun(false);
    }
  }

  async function onConnectGoogle() {
    setError("");
    setInfo("");
    setIsConnectingGoogle(true);
    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/dashboard",
      });
      if (result?.error?.message) {
        setError(result.error.message);
      }
    } catch {
      setError("Impossible de demarrer la connexion Google.");
    } finally {
      setIsConnectingGoogle(false);
    }
  }

  async function onUploadAssets(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cvFile && !templateFile) {
      setError("Ajoutez au moins un fichier (CV PDF et/ou template LM) avant l'upload.");
      setAssetInfo("");
      return;
    }

    setError("");
    setInfo("");
    setAssetInfo("");
    setIsUploadingAssets(true);
    try {
      const formData = new FormData();
      if (cvFile) {
        formData.append("cv", cvFile);
      }
      if (templateFile) {
        formData.append("template", templateFile);
      }

      const response = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });
      const data = (await safeJson<{
        ok?: boolean;
        detail?: string;
        uploaded?: { cv?: string; template?: string };
      }>(response)) as {
        ok?: boolean;
        detail?: string;
        uploaded?: { cv?: string; template?: string };
      };
      if (!response.ok || !data.ok) {
        throw new Error(data.detail ?? "Echec de l'upload des fichiers.");
      }

      const uploadedParts: string[] = [];
      if (data.uploaded?.cv) {
        uploadedParts.push("CV");
        setCvUploaded(true);
      }
      if (data.uploaded?.template) {
        uploadedParts.push("template LM");
        setTemplateUploaded(true);
      }
      setAssetInfo(
        uploadedParts.length > 0
          ? `Fichiers enregistres: ${uploadedParts.join(" + ")}`
          : "Upload termine.",
      );
      setCvFile(null);
      setTemplateFile(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue lors de l'upload.";
      setError(message);
    } finally {
      setIsUploadingAssets(false);
    }
  }

  async function onSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();
    if (!normalizedFirstName || !normalizedLastName) {
      setError("Le prenom et le nom sont obligatoires.");
      setProfileInfo("");
      return;
    }

    setIsSavingProfile(true);
    setError("");
    setInfo("");
    setProfileInfo("");
    const uploadedParts: string[] = [];

    try {
      if (cvFile || templateFile) {
        const formData = new FormData();
        if (cvFile) {
          formData.append("cv", cvFile);
        }
        if (templateFile) {
          formData.append("template", templateFile);
        }
        const uploadResponse = await fetch("/api/uploads", {
          method: "POST",
          body: formData,
        });
        const uploadData = (await safeJson<{
          ok?: boolean;
          detail?: string;
          uploaded?: { cv?: string; template?: string };
        }>(uploadResponse)) as {
          ok?: boolean;
          detail?: string;
          uploaded?: { cv?: string; template?: string };
        };
        if (!uploadResponse.ok || !uploadData.ok) {
          throw new Error(uploadData.detail ?? "Echec de l'upload des fichiers.");
        }
        if (uploadData.uploaded?.cv) {
          uploadedParts.push("CV");
          setCvUploaded(true);
        }
        if (uploadData.uploaded?.template) {
          uploadedParts.push("template LM");
          setTemplateUploaded(true);
        }
        setCvFile(null);
        setTemplateFile(null);
      }

      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          first_name: normalizedFirstName,
          last_name: normalizedLastName,
          linkedin_url: linkedinUrl,
          portfolio_url: portfolioUrl,
          subject_template: mailSubjectTemplate,
          body_template: mailBodyTemplate,
          run_mode: mode,
          run_zone: zones.length ? zones.join(", ") : "all",
          run_sector: sector,
          run_specialty: specialty.trim() || "",
          run_dry_run: dryRun,
          run_max_minutes: maxMinutes,
          run_max_sites: maxSites,
          run_target_found: targetFound,
          run_workers: workers,
          run_use_ai: useAi,
        }),
      });
      const data = (await safeJson<{ ok?: boolean; detail?: string }>(response)) as {
        ok?: boolean;
        detail?: string;
      };
      if (!response.ok || !data.ok) {
        throw new Error(data.detail ?? "Impossible de sauvegarder le profil.");
      }
      const message =
        uploadedParts.length > 0
          ? `Profil, ${uploadedParts.join(" et ")} enregistres. Vos prochains mails utiliseront ces informations.`
          : "Profil enregistre. Vos prochains mails utiliseront ces informations.";
      setProfileInfo(message);
      if (uploadedParts.length > 0) {
        setAssetInfo(`Fichiers enregistres: ${uploadedParts.join(" + ")}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue lors de la sauvegarde.";
      setError(message);
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function onCancelRun() {
    if (!activeRunId) {
      return;
    }
    setIsCancellingRun(true);
    setError("");
    setInfo("");
    try {
      const response = await fetch(`/api/runs/${activeRunId}/cancel`, {
        method: "POST",
      });
      const data = (await safeJson<{ status?: string; message?: string; detail?: string }>(
        response,
      )) as { status?: string; message?: string; detail?: string };
      if (!response.ok) {
        throw new Error(data.detail ?? data.message ?? "Impossible d'annuler cette recherche.");
      }
      setInfo(
        data.message
          ? data.message
          : `Demande d'annulation envoyee (${data.status ?? "cancelling"}).`,
      );
      await refreshAll();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue.";
      setError(message);
    } finally {
      setIsCancellingRun(false);
    }
  }

  async function onSignOut() {
    setError("");
    setInfo("");
    setIsSigningOut(true);
    try {
      await authClient.signOut();
      setAccessState("unauthenticated");
      router.push("/login");
      router.refresh();
    } catch {
      setError("Impossible de se deconnecter pour le moment. Reessayez.");
    } finally {
      setIsSigningOut(false);
    }
  }

  async function onSaveWorkInProgress() {
    try {
      const normalizedFirstName = firstName.trim();
      const normalizedLastName = lastName.trim();
      if (!normalizedFirstName || !normalizedLastName) {
        throw new Error("Renseignez d'abord votre prenom et nom pour sauvegarder ce compte.");
      }

      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          first_name: normalizedFirstName,
          last_name: normalizedLastName,
          linkedin_url: linkedinUrl,
          subject_template: mailSubjectTemplate,
          body_template: mailBodyTemplate,
          run_mode: mode,
          run_zone: zones.length ? zones.join(", ") : "all",
          run_sector: sector,
          run_specialty: specialty.trim() || "",
          run_dry_run: dryRun,
          run_max_minutes: maxMinutes,
          run_max_sites: maxSites,
          run_target_found: targetFound,
          run_workers: workers,
          run_use_ai: useAi,
        }),
      });
      const data = (await safeJson<{ ok?: boolean; detail?: string }>(response)) as {
        ok?: boolean;
        detail?: string;
      };
      if (!response.ok || !data.ok) {
        throw new Error(data.detail ?? "Impossible d'enregistrer le travail en cours.");
      }

      setInfo("Travail en cours enregistre pour ce compte.");
      setError("");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Impossible d'enregistrer le travail en cours.";
      setError(message);
    }
  }

  function onSelectRun(runId: string) {
    setActiveRunId(runId);
    void refreshRunDetails(runId);
  }

  if (accessState === "checking") {
    return (
      <div className={`${styles.page} ${theme === "dark" ? styles.pageDark : ""}`}>
        <main className={styles.main}>
          <section className={styles.panel}>
            <h2>Verification de la session...</h2>
            <p className={styles.sectionHint}>Chargement du dashboard securise.</p>
          </section>
        </main>
      </div>
    );
  }

  if (accessState === "forbidden") {
    return (
      <div className={`${styles.page} ${theme === "dark" ? styles.pageDark : ""}`}>
        <main className={styles.main}>
          <section className={styles.panel}>
            <h2>Acces refuse</h2>
            <p className={styles.error} role="alert">
              {accessError || "Votre compte n'est pas autorise pour ce dashboard."}
            </p>
          </section>
        </main>
      </div>
    );
  }

  if (accessState === "unauthenticated" && !isDemoView) {
    return (
      <div className={`${styles.page} ${theme === "dark" ? styles.pageDark : ""}`}>
        <main className={styles.main}>
          <section className={styles.panel}>
            <p className={styles.eyebrow}>Alternance Hunter</p>
            <h1>👋 Bienvenue</h1>
            <p className={styles.panelHint}>
              Connectez-vous avec votre compte Google invite pour acceder au dashboard et lancer vos
              executions.
            </p>
            <div className={styles.controls}>
              <button className={styles.primaryBtn} type="button" onClick={() => router.push("/login")}>
                <GoogleLogo size={18} />
                Se connecter
              </button>
              <Link href="/dashboard?demo=1" className={styles.secondaryBtn} style={{ display: "inline-block", textDecoration: "none" }}>
                👀 Voir le dashboard en démo
              </Link>
              <button
                className={styles.secondaryBtn}
                type="button"
                onClick={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}
              >
                {theme === "light" ? "Activer le mode sombre" : "Activer le mode clair"}
              </button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className={`${styles.page} ${theme === "dark" ? styles.pageDark : ""}`}>
      <main className={styles.main}>
        {showDemoBanner ? (
          <section className={styles.panel} style={{ marginBottom: "1rem", background: "var(--color-accent-subtle, #e8f4fc)", border: "1px solid var(--color-accent, #0a7ea4)" }}>
            <p className={styles.panelHint} style={{ margin: 0 }}>
              <strong>Mode démo</strong> — Vous consultez le dashboard sans connexion. Les données ne sont pas chargées.{" "}
              <Link href="/login" style={{ fontWeight: 600 }}>Connectez-vous</Link>
              {" "}pour enregistrer votre profil, uploader vos documents et lancer des runs.
            </p>
          </section>
        ) : null}
        <header className={styles.headerCard}>
          <div>
            <p className={styles.eyebrow}>📊 Tableau de bord</p>
            <h1>Tableau de bord Alternance Hunter</h1>
            <p className={styles.panelHint}>
              Suivez les étapes : profil, documents, paramètres, puis lancez une recherche et suivez l’avancement.
            </p>
          </div>
          <div className={styles.headerActions}>
            <button
              className={styles.secondaryBtn}
              type="button"
              onClick={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}
            >
              {theme === "light" ? "Activer le mode sombre" : "Activer le mode clair"}
            </button>
            {!showDemoBanner ? (
              <>
                <button className={styles.secondaryBtn} type="button" onClick={onSaveWorkInProgress}>
                  💾 Enregistrer le travail
                </button>
                <button
                  className={styles.secondaryBtn}
                  type="button"
                  onClick={onSignOut}
                  disabled={isSigningOut}
                >
                  {isSigningOut ? "Deconnexion..." : "🚪 Se deconnecter"}
                </button>
              </>
            ) : (
              <Link href="/login" className={styles.primaryBtn} style={{ display: "inline-block", textDecoration: "none" }}>
                Connectez-vous pour utiliser
              </Link>
            )}
          </div>
        </header>

        <nav className={styles.stepNav} aria-label="Navigation des etapes du dashboard">
          <p className={styles.stepNavTitle}>🛤️ Parcours du pipeline</p>
          <ul className={styles.stepNavList}>
            <li>
              <a className={styles.stepNavItem} href="#step-profil">
                <span className={styles.stepNavNumber}>1</span>
                <span>👤 Profil expediteur</span>
              </a>
            </li>
            <li>
              <a className={styles.stepNavItem} href="#step-documents">
                <span className={styles.stepNavNumber}>2</span>
                <span>📁 Documents & templates</span>
              </a>
            </li>
            <li>
              <a className={styles.stepNavItem} href="#step-config">
                <span className={styles.stepNavNumber}>3</span>
                <span>⚙️ Options de recherche</span>
              </a>
            </li>
            <li>
              <a className={styles.stepNavItem} href="#step-runs">
                <span className={styles.stepNavNumber}>4</span>
                <span>Recherches récentes</span>
              </a>
            </li>
            <li>
              <a className={styles.stepNavItem} href="#step-logs">
                <span className={styles.stepNavNumber}>5</span>
                <span>🖥️ Logs & terminal</span>
              </a>
            </li>
          </ul>
        </nav>

        <div className={styles.topGrid}>
          <section className={styles.panel} id="step-profil">
            <h2>👤  Profil & personnalisation</h2>
            <p className={styles.sectionHint}>
              Renseignez votre profil et personnalisez vos emails avant de lancer une recherche.
            </p>
            <form id="profile-form" className={styles.profileCard} onSubmit={onSaveProfile}>
              <p className={styles.uploadTitle}>👤 Profil expediteur</p>
              <p className={styles.uploadHint}>
                Premiere connexion: renseignez votre prenom/nom. Vous pouvez personnaliser le sujet et
                le corps complet du mail avec des placeholders ({`{{ENTREPRISE}}`},{" "}
                {`{{NOM_COMPLET}}`}, {`{{PRENOM}}`}, {`{{NOM}}`}, {`{{LINKEDIN}}`}, {`{{PORTFOLIO}}`},{" "}
                {`{{DATE}}`}).
              </p>
              <div className={styles.uploadGrid}>
                <label>
                  Prenom
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </label>
                <label>
                  Nom
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </label>
              </div>
              <label>
                LinkedIn (optionnel)
                <input
                  type="url"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="https://www.linkedin.com/in/votre-profil"
                />
              </label>
              <label>
                Portfolio (optionnel)
                <input
                  type="url"
                  value={portfolioUrl}
                  onChange={(e) => setPortfolioUrl(e.target.value)}
                  placeholder="https://votre-portfolio.dev"
                />
              </label>
              <label>
                Sujet personnalise (optionnel)
                <input
                  type="text"
                  value={mailSubjectTemplate}
                  onChange={(e) => setMailSubjectTemplate(e.target.value)}
                  placeholder="Ex: Candidature alternance - {{ENTREPRISE}} - {{NOM_COMPLET}}"
                />
              </label>
              <label>
                Corps du mail personnalise (optionnel)
                <textarea
                  value={mailBodyTemplate}
                  onChange={(e) => setMailBodyTemplate(e.target.value)}
                  rows={8}
                  placeholder={"Ex: Bonjour,\nJe suis à la recherche d'une alternance en {{DATE}}.\nJe candidate chez {{ENTREPRISE}}."}
                />
              </label>
            </form>
            <form className={styles.uploadCard} onSubmit={onUploadAssets} id="step-documents">
              <p className={styles.uploadTitle}>📁 Vos documents</p>
              <p className={styles.uploadHint}>
                Déposez votre <strong>CV (PDF, obligatoire)</strong> et votre <strong>template de lettre de motivation</strong> (.docx). Sans CV, vous ne pourrez pas lancer de recherche.
                {cvUploaded || templateUploaded ? " Vos documents sont enregistrés et conservés pour vos prochaines visites. Vous pouvez en déposer de nouveaux pour les remplacer." : ""}
              </p>
              <div
                className={`${styles.dropZone} ${isDraggingDocs ? styles.dropZoneActive : ""} ${(cvFile || templateFile) ? styles.dropZoneHasFiles : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!showDemoBanner) setIsDraggingDocs(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingDocs(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingDocs(false);
                  if (showDemoBanner) return;
                  const files = Array.from(e.dataTransfer?.files ?? []);
                  for (const file of files) {
                    const name = (file.name || "").toLowerCase();
                    const isPdf = name.endsWith(".pdf") || file.type === "application/pdf";
                    const isDoc = name.endsWith(".docx") || name.endsWith(".doc") || file.type.includes("word") || file.type.includes("document");
                    if (isPdf) setCvFile(file);
                    if (isDoc) setTemplateFile(file);
                  }
                }}
              >
                <span className={styles.dropZoneIcon} aria-hidden="true">📁</span>
                <span className={styles.dropZoneText}>
                  {cvFile || templateFile
                    ? [cvFile?.name, templateFile?.name].filter(Boolean).join(" • ")
                    : isDraggingDocs
                      ? "Déposez les fichiers ici"
                      : "Déposez votre CV (PDF) et template LM (.docx) ici"}
                </span>
              </div>
              <button className={styles.secondaryBtn} type="submit" disabled={isUploadingAssets || showDemoBanner}>
                {isUploadingAssets ? "Upload en cours..." : showDemoBanner ? "Connectez-vous pour uploader" : "Uploader mes fichiers"}
              </button>
              {assetInfo ? <p className={styles.uploadSuccess}>{assetInfo}</p> : null}
              {draftInfo ? <p className={styles.uploadHint}>{draftInfo}</p> : null}
            </form>
            <div className={styles.profileSaveBlock}>
              <button form="profile-form" className={styles.secondaryBtn} type="submit" disabled={isSavingProfile || showDemoBanner}>
                {isSavingProfile
                  ? "Sauvegarde..."
                  : showDemoBanner
                    ? "Connectez-vous pour enregistrer"
                    : isProfileLoading
                      ? "Chargement du profil..."
                      : "💾 Enregistrer mon profil"}
              </button>
              {profileInfo ? <p className={styles.uploadSuccess}>{profileInfo}</p> : null}
            </div>
            <section className={styles.stepCard} aria-labelledby="step-zone">
              <div className={styles.stepCardHeader}>
                <div className={styles.stepTitle} id="step-zone">
                  <span className={styles.stepBadge}>3</span>
                  <span>🗺️ Zone geographique</span>
                </div>
              </div>
              <p className={styles.stepDescription}>
                Ajoutez jusqu’à {MAX_ZONES} zones géographiques pour affiner la recherche. Tapez une
                ville et sélectionnez une suggestion, ou laissez la liste vide pour couvrir toute la France.
              </p>
              <div className={styles.zoneSection}>
                <label className={styles.zoneFieldLabel} htmlFor="zone-geo-input">
                  Zones géographiques (max. {MAX_ZONES})
                </label>
                {zones.length > 0 ? (
                  <ul className={styles.zoneChipList} aria-label="Zones sélectionnées">
                    {zones.map((z) => (
                      <li key={z} className={styles.zoneChipItem}>
                        <span className={styles.zoneChipLabel}>{z}</span>
                        <button
                          type="button"
                          className={styles.zoneChipRemove}
                          onClick={() => setZones((prev) => prev.filter((x) => x !== z))}
                          aria-label={`Retirer ${z}`}
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className={styles.zoneFieldRow}>
                  <div className={styles.zoneFieldInputGroup}>
                    <div className={styles.zoneFieldInputWrapper}>
                      <span className={styles.zoneFieldIcon} aria-hidden="true">
                        📍
                      </span>
                      <input
                        id="zone-geo-input"
                        type="text"
                        aria-label="Ajouter une zone (ville)"
                        disabled={zones.length >= MAX_ZONES}
                        className={styles.zoneFieldInput}
                        value={zoneQuery}
                        onChange={(e) => {
                          const value = e.target.value;
                          setZoneQuery(value);
                          const trimmed = value.trim().toLowerCase();
                          if (!trimmed) {
                            setZoneSuggestions([]);
                            return;
                          }
                          setZoneSuggestions(
                            KNOWN_ZONES.filter(
                              (z) =>
                                z !== "all" &&
                                z.toLowerCase().includes(trimmed) &&
                                !zones.map((x) => x.toLowerCase()).includes(z.toLowerCase()),
                            ).slice(0, 8),
                          );
                        }}
                        placeholder={
                          zones.length >= MAX_ZONES
                            ? `Maximum ${MAX_ZONES} zones atteint`
                            : ZONE_PLACEHOLDER
                        }
                        onFocus={() => {
                          if (zones.length >= MAX_ZONES) return;
                          setIsZoneFocused(true);
                          const trimmed = zoneQuery.trim().toLowerCase();
                          if (!trimmed) {
                            setZoneSuggestions(
                              KNOWN_ZONES.filter(
                                (z) =>
                                  z !== "all" &&
                                  !zones.map((x) => x.toLowerCase()).includes(z.toLowerCase()),
                              ).slice(0, 12),
                            );
                          } else {
                            setZoneSuggestions(
                              KNOWN_ZONES.filter(
                                (z) =>
                                  z !== "all" &&
                                  z.toLowerCase().includes(trimmed) &&
                                  !zones.map((x) => x.toLowerCase()).includes(z.toLowerCase()),
                              ).slice(0, 8),
                            );
                          }
                        }}
                        onBlur={() => {
                          window.setTimeout(() => setIsZoneFocused(false), 100);
                        }}
                        autoComplete="off"
                      />
                    </div>
                    {isZoneFocused && zoneSuggestions.length > 0 && zones.length < MAX_ZONES ? (
                      <div
                        className={styles.zoneSuggestions}
                        role="listbox"
                        aria-label="Suggestions de zone"
                      >
                        {zoneSuggestions.map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            role="option"
                            className={styles.zoneSuggestionItem}
                            onClick={() => {
                              if (zones.length >= MAX_ZONES) return;
                              if (!zones.map((x) => x.toLowerCase()).includes(suggestion.toLowerCase())) {
                                setZones((prev) => [...prev, suggestion].slice(0, MAX_ZONES));
                              }
                              setZoneQuery("");
                              setZoneSuggestions([]);
                              setIsZoneFocused(false);
                            }}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  {zones.length > 0 ? (
                    <p className={styles.zoneHint}>
                      {zones.length}/{MAX_ZONES} zones
                    </p>
                  ) : null}
                </div>
              </div>
            </section>

            <section className={styles.stepCard} aria-labelledby="step-config">
              <div className={styles.stepCardHeader}>
                <div className={styles.stepTitle} id="step-config">
                  <span className={styles.stepBadge}>4</span>
                  <span>⚙️ Options de recherche</span>
                </div>
              </div>
              <p className={styles.stepDescription}>
                Ajustez la duree maximale, le nombre de sites explores et le nombre de cibles
                souhaitees avant de lancer la recherche.
              </p>
              <form
                id="pipeline-config-form"
                className={styles.form}
                onSubmit={onSubmit}
                aria-label="Paramètres de la recherche"
              >
                <div className={styles.inputGrid}>
                  <label>
                  Type de recherche
                  <select value={mode} onChange={(e) => setMode(e.target.value as RunMode)}>
                    {(Object.keys(MODE_LABELS) as RunMode[]).map((option) => (
                      <option key={option} value={option}>
                        {MODE_LABELS[option]}
                      </option>
                    ))}
                  </select>
                </label>

                <div className={styles.inputGrid} role="group" aria-label="Domaine de recherche">
                  <label>
                    Secteur d&apos;activite
                    <select
                      value={sector}
                      onChange={(e) => {
                        const next = e.target.value as SectorId;
                        setSector(next);
                        setSpecialty("");
                      }}
                      aria-label="Secteur d'activité"
                    >
                      {SECTOR_ORDER.map((key) => (
                        <option key={key} value={key}>
                          {SECTOR_LABELS[key]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Metier / specialite
                    <select
                      value={specialty}
                      onChange={(e) => setSpecialty(e.target.value)}
                      disabled={sector === "all"}
                      aria-label="Métier ou spécialité"
                    >
                      <option value="">Toutes</option>
                      {(SECTORS_SPECIALTIES[sector as SectorId] ?? []).map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label>
                  Duree maximale (minutes)
                  <input
                    type="number"
                    min={1}
                    value={maxMinutes}
                    onChange={(e) => setMaxMinutes(Number(e.target.value))}
                  />
                </label>

                <label>
                  Nombre maximal de sites
                  <input
                    type="number"
                    min={1}
                    value={maxSites}
                    onChange={(e) => setMaxSites(Number(e.target.value))}
                  />
                </label>

                <label>
                  Objectif de cibles trouvees
                  <input
                    type="number"
                    min={1}
                    value={targetFound}
                    onChange={(e) => setTargetFound(Number(e.target.value))}
                  />
                </label>

                <label>
                  Nombre de workers
                  <input
                    type="number"
                    min={1}
                    value={workers}
                    onChange={(e) => setWorkers(Number(e.target.value))}
                  />
                </label>
              </div>

              <fieldset className={styles.switchGroup}>
                <legend>Options</legend>
                <label className={styles.switchField}>
                  <span>Mode test (aucun envoi réel)</span>
                  <span className={styles.switchControl}>
                    <input
                      type="checkbox"
                      checked={dryRun}
                      onChange={(e) => setDryRun(e.target.checked)}
                    />
                    <span className={styles.switchTrack} aria-hidden="true" />
                  </span>
                </label>
                <label className={styles.switchField}>
                  <span>Générer le paragraphe personnalisé avec l&apos;IA</span>
                  <span className={styles.switchControl}>
                    <input
                      type="checkbox"
                      checked={useAi}
                      onChange={(e) => setUseAi(e.target.checked)}
                      aria-describedby="use-ai-hint"
                    />
                    <span className={styles.switchTrack} aria-hidden="true" />
                  </span>
                </label>
                {useAi ? (
                  <div className={styles.openaiKeyBlock} id="use-ai-hint">
                    <label className={styles.openaiKeyLabel} htmlFor="openai-api-key">
                      Clé API OpenAI (votre clé, non stockée)
                    </label>
                    <input
                      id="openai-api-key"
                      type="password"
                      autoComplete="off"
                      placeholder="sk-..."
                      value={openaiApiKey}
                      onChange={(e) => setOpenaiApiKey(e.target.value)}
                      className={styles.openaiKeyInput}
                    />
                    <p className={styles.openaiKeyHint}>
                      Saisissez votre clé OpenAI pour que le pipeline génère un paragraphe personnalisé par entreprise. Envoyée en HTTPS pour ce run puis effacée de la mémoire ; jamais enregistrée, loggée ou affichée. Utilisez une clé à plafond d'usage (OpenAI) pour limiter les risques. 
                    </p>
                  </div>
                ) : null}
              </fieldset>
              <div className={styles.launchBlock}>
                <button
                  className={styles.primaryBtn}
                  type="submit"
                  disabled={demoLaunchDisabled}
                >
                  {demoLaunchLabel}
                </button>
                <p className={styles.launchHint}>
                  Lance une recherche d&apos;entreprises puis la génération des lettres et brouillons selon le type choisi.
                </p>
              </div>
            </form>
          </section>

          </section>

          <section className={styles.panel}>
            <h2>📋 Etape 4 – Suivi des recherches</h2>
            <p className={styles.sectionHint}>
              Consultez vos recherches récentes et leur avancement ci-dessous.
            </p>
            <div className={styles.gmailStatusCard}>
              <p className={styles.gmailStatusTitle}>Connexion Gmail</p>
              <p
                className={`${styles.gmailStatusText} ${
                  gmailConnected ? styles.gmailStatusConnected : styles.gmailStatusMissing
                }`}
              >
                {gmailConnected
                  ? "Connecte: les brouillons seront crees avec votre compte Google."
                  : googleAccountLinked
                    ? "Compte Google lie, mais les permissions Gmail manquent."
                    : "Non connecte: reliez votre compte Google pour le mode brouillons."}
              </p>
              {!gmailConnected ? (
                <button
                  className={styles.secondaryBtn}
                  type="button"
                  onClick={onConnectGoogle}
                  disabled={isConnectingGoogle || showDemoBanner}
                >
                  {isConnectingGoogle ? "Connexion Google..." : showDemoBanner ? "Connectez-vous pour Gmail" : "Connecter Gmail"}
                </button>
              ) : null}
            </div>
            <div className={styles.controls}>
              <button
                className={styles.primaryBtn}
                form="pipeline-config-form"
                type="submit"
                disabled={demoLaunchDisabled}
              >
                {demoLaunchLabel}
              </button>
              <button
                className={styles.secondaryBtn}
                type="button"
                onClick={() => void refreshAll()}
                disabled={isRefreshingRuns || isRefreshingDetails}
              >
                {isRefreshingRuns || isRefreshingDetails ? "Rafraichissement..." : "Rafraichir"}
              </button>
            </div>

            {info ? (
              <p className={styles.info} role="status">
                {info}
              </p>
            ) : null}
            {error ? (
              <p className={styles.error} role="alert">
                {error}
              </p>
            ) : null}
          </section>
        </div>

        <section className={styles.panel} id="step-runs">
          <div className={styles.panelHeader}>
            <h2>Recherches récentes</h2>
            {isRefreshingRuns ? <span className={styles.loadingText}>Mise à jour...</span> : null}
          </div>
          {runs.length === 0 ? (
            <p className={styles.emptyState}>
              Aucune recherche pour le moment. Remplissez les paramètres ci-dessus puis lancez une recherche.
            </p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.runTable}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Statut</th>
                    <th>Zone</th>
                    <th>Duree</th>
                    <th>Cibles trouvees</th>
                    <th>Emails generes</th>
                    <th>Debut</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => {
                    const statusTone = getStatusTone(run.status);
                    const targetCount = run.targets_found ?? run.target_found;
                    const generatedCount = run.emails_generated ?? run.drafts_generated;
                    return (
                      <tr
                        key={run.run_id}
                        className={
                          activeRunId === run.run_id ? styles.tableRowActive : styles.tableRow
                        }
                      >
                        <td>
                          <button
                            className={styles.rowSelectBtn}
                            type="button"
                            onClick={() => onSelectRun(run.run_id)}
                          >
                            {run.run_id.slice(0, 8)}...
                          </button>
                        </td>
                        <td>
                          <span
                            className={`${styles.statusBadge} ${
                              statusTone === "success"
                                ? styles.badgeSuccess
                                : statusTone === "failed"
                                  ? styles.badgeFailed
                                  : statusTone === "running"
                                    ? styles.badgeRunning
                                    : styles.badgeNeutral
                            }`}
                          >
                            {run.status}
                          </span>
                        </td>
                        <td>{run.zone ?? "-"}</td>
                        <td>{formatDuration(run.started_at, run.finished_at, run.duration_seconds)}</td>
                        <td>{formatOptionalNumber(targetCount)}</td>
                        <td>{formatOptionalNumber(generatedCount)}</td>
                        <td>{formatDateTime(run.started_at ?? run.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className={styles.panel} id="step-logs">
          <div className={styles.panelHeader}>
            <h2>Détails de la recherche</h2>
            <div className={styles.panelHeaderActions}>
              <button
                type="button"
                className={styles.secondaryBtn}
                disabled={!activeRun || !isRunning}
                onClick={() =>
                  setInfo(
                    "Les donnees sont deja enregistrees au fur et a mesure. En annulant, tout le travail deja effectue restera sauvegarde (entreprises, brouillons, lettres de motivation).",
                  )
                }
              >
                Sauvegarder l&apos;etat actuel
              </button>
              <button
                className={styles.dangerBtn}
                type="button"
                onClick={onCancelRun}
                disabled={!activeRun || END_STATUSES.has(activeRun.status) || isCancellingRun}
              >
                {isCancellingRun ? "Annulation..." : "Annuler la recherche"}
              </button>
            </div>
          </div>
          <p className={styles.runSaveNote}>
            L&apos;annulation conserve ce qui a déjà été fait (entreprises trouvées, brouillons, lettres).
          </p>
          {!activeRunId ? (
            <p className={styles.emptyState}>
              Sélectionnez une recherche dans le tableau pour afficher les détails et l&apos;avancement.
            </p>
          ) : isRefreshingDetails && !runDetails ? (
            <p className={styles.loadingText}>Chargement des details...</p>
          ) : !runDetails ? (
            <p className={styles.emptyState}>
              Les details sont indisponibles pour le moment. Relancez un rafraichissement.
            </p>
          ) : (
            <>
              <dl className={styles.metaGrid}>
                <div>
                  <dt>ID</dt>
                  <dd>{runDetails.run_id}</dd>
                </div>
                <div>
                  <dt>Statut</dt>
                  <dd>
                    <span
                      className={`${styles.statusBadge} ${
                        getStatusTone(runDetails.status) === "success"
                          ? styles.badgeSuccess
                          : getStatusTone(runDetails.status) === "failed"
                            ? styles.badgeFailed
                            : getStatusTone(runDetails.status) === "running"
                              ? styles.badgeRunning
                              : styles.badgeNeutral
                      }`}
                    >
                      {runDetails.status}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>Demarrage</dt>
                  <dd>{formatDateTime(runDetails.started_at ?? runDetails.created_at)}</dd>
                </div>
                <div>
                  <dt>Fin</dt>
                  <dd>{formatDateTime(runDetails.finished_at)}</dd>
                </div>
                <div>
                  <dt>Duree</dt>
                  <dd>
                    {formatDuration(
                      runDetails.started_at,
                      runDetails.finished_at,
                      runDetails.duration_seconds,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Zone</dt>
                  <dd>{runDetails.zone ?? "-"}</dd>
                </div>
              </dl>

              {(pipelineSteps || progressCounts) ? (
                <div className={styles.progressSteps}>
                  <h3 className={styles.progressStepsTitle}>Avancement</h3>
                  {pipelineSteps ? (
                    <ul className={styles.progressStepsList}>
                      {pipelineSteps.map((step) => (
                        <li key={step.id} className={styles.progressStepItem}>
                          <span className={styles.progressStepIcon} aria-hidden="true">
                            {step.icon}
                          </span>
                          <span className={styles.progressStepLabel}>{step.label}</span>
                          <span
                            className={`${styles.progressStepBadge} ${
                              step.status === "done"
                                ? styles.progressStepDone
                                : step.status === "running"
                                  ? styles.progressStepRunning
                                  : step.status === "error"
                                    ? styles.progressStepError
                                    : styles.progressStepPending
                            }`}
                          >
                            {step.status === "pending"
                              ? "En attente"
                              : step.status === "running"
                                ? "En cours..."
                                : step.status === "done"
                                  ? "Terminé"
                                  : "Erreur"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {progressCounts && launchedMode ? (
                    <div className={styles.progressBars}>
                      {(launchedMode === "hunter" || launchedMode === "pipeline") && (
                        <div className={styles.progressBarItem}>
                          <div className={styles.progressBarLabel}>
                            <span>Alternance Hunter – emails trouvés</span>
                            <span className={styles.progressBarValue}>
                              {progressCounts.companiesFound} / {targetFound}
                            </span>
                          </div>
                          <div className={styles.progressBarTrack}>
                            <div
                              className={styles.progressBarFill}
                              style={{
                                width: `${Math.min(100, (progressCounts.companiesFound / Math.max(1, targetFound)) * 100)}%`,
                              }}
                            />
                          </div>
                          <span className={styles.progressBarPct}>
                            {Math.round(Math.min(100, (progressCounts.companiesFound / Math.max(1, targetFound)) * 100))} %
                          </span>
                        </div>
                      )}
                      {(launchedMode === "generate" || launchedMode === "pipeline") && (
                        <div className={styles.progressBarItem}>
                          <div className={styles.progressBarLabel}>
                            <span>Lettres de motivation générées</span>
                            <span className={styles.progressBarValue}>
                              {progressCounts.lettersWritten} / {Math.max(progressCounts.companiesFound, targetFound)}
                            </span>
                          </div>
                          <div className={styles.progressBarTrack}>
                            <div
                              className={styles.progressBarFill}
                              style={{
                                width: `${Math.min(100, (progressCounts.lettersWritten / Math.max(1, Math.max(progressCounts.companiesFound, targetFound))) * 100)}%`,
                              }}
                            />
                          </div>
                          <span className={styles.progressBarPct}>
                            {Math.round((progressCounts.lettersWritten / Math.max(1, Math.max(progressCounts.companiesFound, targetFound))) * 100)} %
                          </span>
                        </div>
                      )}
                      {(launchedMode === "drafts" || launchedMode === "pipeline") && (
                        <div className={styles.progressBarItem}>
                          <div className={styles.progressBarLabel}>
                            <span>Brouillons Gmail créés</span>
                            <span className={styles.progressBarValue}>
                              {progressCounts.draftsCreated} / {Math.max(progressCounts.companiesFound, targetFound)}
                            </span>
                          </div>
                          <div className={styles.progressBarTrack}>
                            <div
                              className={styles.progressBarFill}
                              style={{
                                width: `${Math.min(100, (progressCounts.draftsCreated / Math.max(1, Math.max(progressCounts.companiesFound, targetFound))) * 100)}%`,
                              }}
                            />
                          </div>
                          <span className={styles.progressBarPct}>
                            {Math.round((progressCounts.draftsCreated / Math.max(1, Math.max(progressCounts.companiesFound, targetFound))) * 100)} %
                          </span>
                        </div>
                      )}
                    </div>
                  ) : progressCounts && !launchedMode ? (
                    <div className={styles.progressBars}>
                      <div className={styles.progressBarItem}>
                        <div className={styles.progressBarLabel}>
                          <span>Alternance Hunter – emails trouvés</span>
                          <span className={styles.progressBarValue}>
                            {progressCounts.companiesFound} / {targetFound}
                          </span>
                        </div>
                        <div className={styles.progressBarTrack}>
                          <div
                            className={styles.progressBarFill}
                            style={{
                              width: `${Math.min(100, (progressCounts.companiesFound / Math.max(1, targetFound)) * 100)}%`,
                            }}
                          />
                        </div>
                        <span className={styles.progressBarPct}>
                          {Math.round(Math.min(100, (progressCounts.companiesFound / Math.max(1, targetFound)) * 100))} %
                        </span>
                      </div>
                      <div className={styles.progressBarItem}>
                        <div className={styles.progressBarLabel}>
                          <span>Lettres de motivation générées</span>
                          <span className={styles.progressBarValue}>
                            {progressCounts.lettersWritten} / {Math.max(progressCounts.companiesFound, targetFound)}
                          </span>
                        </div>
                        <div className={styles.progressBarTrack}>
                          <div
                            className={styles.progressBarFill}
                            style={{
                              width: `${Math.min(100, (progressCounts.lettersWritten / Math.max(1, Math.max(progressCounts.companiesFound, targetFound))) * 100)}%`,
                            }}
                          />
                        </div>
                        <span className={styles.progressBarPct}>
                          {Math.round((progressCounts.lettersWritten / Math.max(1, Math.max(progressCounts.companiesFound, targetFound))) * 100)} %
                        </span>
                      </div>
                      <div className={styles.progressBarItem}>
                        <div className={styles.progressBarLabel}>
                          <span>Brouillons Gmail créés</span>
                          <span className={styles.progressBarValue}>
                            {progressCounts.draftsCreated} / {Math.max(progressCounts.companiesFound, targetFound)}
                          </span>
                        </div>
                        <div className={styles.progressBarTrack}>
                          <div
                            className={styles.progressBarFill}
                            style={{
                              width: `${Math.min(100, (progressCounts.draftsCreated / Math.max(1, Math.max(progressCounts.companiesFound, targetFound))) * 100)}%`,
                            }}
                          />
                        </div>
                        <span className={styles.progressBarPct}>
                          {Math.round((progressCounts.draftsCreated / Math.max(1, Math.max(progressCounts.companiesFound, targetFound))) * 100)} %
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className={styles.logsToggleWrap}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => setShowLogsSection((prev) => !prev)}
                >
                  {showLogsSection ? "Masquer les logs" : "Afficher les logs"}
                </button>
              </div>

              {showLogsSection ? (
                <>
                  {isTerminalFullscreen ? (
                    <div
                      className={styles.terminalBackdrop}
                      onClick={() => setIsTerminalFullscreen(false)}
                    />
                  ) : null}
                  <div
                    className={`${styles.terminalShell} ${terminalFlash ? styles.terminalFlash : ""} ${
                      isTypingLogs ? styles.terminalShellTyping : ""
                    } ${isTerminalFullscreen ? styles.terminalFullscreen : ""}`}
                  >
                    <div className={styles.terminalHeader}>
                      <span className={styles.dotRed} />
                      <span className={styles.dotYellow} />
                      <span className={styles.dotGreen} />
                      <strong>Logs en direct</strong>
                      <span className={styles.terminalStatus}>
                        {isRunning ? "Execution en cours..." : "Execution terminee"}
                      </span>
                      <button
                        className={styles.secondaryBtn}
                        type="button"
                        onClick={() => setAutoScrollLogs((prev) => !prev)}
                      >
                        {autoScrollLogs ? "Defiler auto: oui" : "Defiler auto: non"}
                      </button>
                      <button
                        className={styles.secondaryBtn}
                        type="button"
                        onClick={() => {
                          setAnimatedLogs("");
                          animatedLogsRef.current = "";
                          setRunDetails((prev) =>
                            prev ? { ...prev, logs_tail: [] } : prev,
                          );
                        }}
                      >
                        Clear
                      </button>
                      <button
                        className={styles.secondaryBtn}
                        type="button"
                        onClick={() => setIsTerminalFullscreen((prev) => !prev)}
                      >
                        {isTerminalFullscreen ? "Quitter plein ecran" : "Plein ecran"}
                      </button>
                    </div>
                    <pre
                      ref={logsRef}
                      className={`${styles.logs} ${isTerminalFullscreen ? styles.logsFullscreen : ""} ${
                        isTypingLogs ? styles.logsTyping : ""
                      }`}
                    >
                      {animatedLogs || "Aucun log disponible pour cette recherche."}
                      {isRunning || isTypingLogs ? <span className={styles.cursor}>█</span> : null}
                    </pre>
                  </div>
                </>
              ) : null}
            </>
          )}
        </section>
      </main>
    </div>
  );
}

function DashboardFallback() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <section className={styles.panel}>
          <h2>Chargement du dashboard...</h2>
          <p className={styles.sectionHint}>Verification de la session.</p>
        </section>
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <DashboardContent />
    </Suspense>
  );
}

"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";
import { authClient } from "@/lib/auth-client";

type RunMode = "pipeline" | "hunter" | "generate" | "drafts";
type Zone = "paris" | "cannes" | "auxerre" | "fontainebleau" | "all";

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
  pipeline: "Pipeline complet",
  hunter: "Recherche d'entreprises",
  generate: "Generation des emails",
  drafts: "Creation des brouillons Gmail",
};

const ZONE_LABELS: Record<Zone, string> = {
  all: "Toutes les zones",
  paris: "Paris",
  cannes: "Cannes",
  auxerre: "Auxerre",
  fontainebleau: "Fontainebleau",
};

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

export default function Home() {
  const router = useRouter();
  const [accessState, setAccessState] = useState<
    "checking" | "unauthenticated" | "granted" | "forbidden"
  >("checking");
  const [accessError, setAccessError] = useState("");
  const [gmailConnected, setGmailConnected] = useState(false);
  const [googleAccountLinked, setGoogleAccountLinked] = useState(false);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [mode, setMode] = useState<RunMode>("pipeline");
  const [zone, setZone] = useState<Zone>("all");
  const [dryRun, setDryRun] = useState(false);
  const [maxMinutes, setMaxMinutes] = useState(30);
  const [maxSites, setMaxSites] = useState(1500);
  const [targetFound, setTargetFound] = useState(100);
  const [workers, setWorkers] = useState(20);
  const [useAi, setUseAi] = useState(false);
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
  const logsRef = useRef<HTMLPreElement | null>(null);
  const typingTimerRef = useRef<number | null>(null);
  const animatedLogsRef = useRef("");

  useEffect(() => {
    const saved = window.localStorage.getItem("alternance-ui-theme");
    if (saved === "dark" || saved === "light") {
      setTheme(saved);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("alternance-ui-theme", theme);
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
        throw new Error(data.detail ?? "Impossible de recuperer la liste des executions.");
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

  const refreshRunDetails = useCallback(async (runId?: string | null) => {
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
        throw new Error(data.detail ?? `Impossible de recuperer le run ${runIdToLoad}.`);
      }
      setRunDetails(data as RunStatusResponse);
    } finally {
      setIsRefreshingDetails(false);
    }
  }, [activeRunId]);

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

  const activeRun = useMemo(
    () => runs.find((run) => run.run_id === activeRunId) ?? null,
    [runs, activeRunId],
  );
  const isRunning = runDetails ? !END_STATUSES.has(runDetails.status) : false;
  const logsText = runDetails?.logs_tail.join("\n") ?? "";
  const draftsRequireGmail = mode === "drafts" && !gmailConnected;

  useEffect(() => {
    animatedLogsRef.current = animatedLogs;
  }, [animatedLogs]);

  useEffect(() => {
    if (accessState !== "granted") {
      return;
    }
    const intervalMs = isRunning ? 2000 : 5000;
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
        zone,
        dry_run: dryRun,
        max_minutes: maxMinutes,
        max_sites: maxSites,
        target_found: targetFound,
        workers,
        use_ai: useAi,
      };
      const response = await fetch("/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await safeJson<{ run_id?: string; detail?: string; message?: string }>(
        response,
      )) as { run_id?: string; detail?: string; message?: string };
      if (!response.ok || !data.run_id) {
        throw new Error(data.detail ?? data.message ?? "Echec du lancement du run.");
      }

      setInfo(`Execution lancee : ${data.run_id}`);
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
        callbackURL: "/",
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
        throw new Error(data.detail ?? data.message ?? "Impossible d'annuler ce run.");
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

  if (accessState === "unauthenticated") {
    return (
      <div className={`${styles.page} ${theme === "dark" ? styles.pageDark : ""}`}>
        <main className={styles.main}>
          <section className={styles.panel}>
            <p className={styles.eyebrow}>Alternance Pipeline</p>
            <h1>Bienvenue</h1>
            <p className={styles.panelHint}>
              Connectez-vous avec votre compte Google invite pour acceder au dashboard et lancer
              vos executions.
            </p>
            <div className={styles.controls}>
              <button className={styles.primaryBtn} type="button" onClick={() => router.push("/login")}>
                Se connecter
              </button>
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
        {/* Header global orientee produit (titre + proposition de valeur). */}
        <header className={styles.headerCard}>
          <div>
            <p className={styles.eyebrow}>Tableau de bord</p>
            <h1>Pilotage du pipeline alternance</h1>
            <p className={styles.panelHint}>
              Configurez le pipeline, lancez une execution et suivez les resultats en temps reel.
            </p>
          </div>
          <button
            className={styles.secondaryBtn}
            type="button"
            onClick={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}
          >
            {theme === "light" ? "Activer le mode sombre" : "Activer le mode clair"}
          </button>
        </header>

        <div className={styles.topGrid}>
          <section className={styles.panel}>
            <h2>Configuration du pipeline</h2>
            <p className={styles.sectionHint}>
              Definissez les parametres principaux avant de lancer une execution.
            </p>
            <form id="pipeline-config-form" className={styles.form} onSubmit={onSubmit}>
              <div className={styles.inputGrid}>
                <label>
                  Mode du pipeline
                  <select value={mode} onChange={(e) => setMode(e.target.value as RunMode)}>
                    {(Object.keys(MODE_LABELS) as RunMode[]).map((option) => (
                      <option key={option} value={option}>
                        {MODE_LABELS[option]}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Zone geographique
                  <select value={zone} onChange={(e) => setZone(e.target.value as Zone)}>
                    {(Object.keys(ZONE_LABELS) as Zone[]).map((option) => (
                      <option key={option} value={option}>
                        {ZONE_LABELS[option]}
                      </option>
                    ))}
                  </select>
                </label>

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
                  <span>Execution simulee (dry run)</span>
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
                  <span>Utiliser IA pour enrichir les resultats</span>
                  <span className={styles.switchControl}>
                    <input
                      type="checkbox"
                      checked={useAi}
                      onChange={(e) => setUseAi(e.target.checked)}
                    />
                    <span className={styles.switchTrack} aria-hidden="true" />
                  </span>
                </label>
              </fieldset>
            </form>
          </section>

          <section className={styles.panel}>
            <h2>Controles du pipeline</h2>
            <p className={styles.sectionHint}>
              Lancez un nouveau pipeline ou rechargez la liste et les details des executions.
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
                  disabled={isConnectingGoogle}
                >
                  {isConnectingGoogle ? "Connexion Google..." : "Connecter Gmail"}
                </button>
              ) : null}
            </div>
            <div className={styles.controls}>
              <button
                className={styles.primaryBtn}
                form="pipeline-config-form"
                type="submit"
                disabled={isLaunchingRun || draftsRequireGmail}
              >
                {isLaunchingRun
                  ? "Lancement en cours..."
                  : draftsRequireGmail
                    ? "Connexion Gmail requise"
                    : "Lancer le pipeline"}
              </button>
              <button
                className={styles.secondaryBtn}
                type="button"
                onClick={() => void refreshAll()}
                disabled={isRefreshingRuns || isRefreshingDetails}
              >
                {isRefreshingRuns || isRefreshingDetails
                  ? "Rafraichissement..."
                  : "Rafraichir"}
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

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Executions recentes</h2>
            {isRefreshingRuns ? <span className={styles.loadingText}>Mise a jour...</span> : null}
          </div>
          {runs.length === 0 ? (
            <p className={styles.emptyState}>
              Aucune execution pour le moment. Configurez les parametres puis lancez un pipeline.
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

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Details de execution</h2>
            <button
              className={styles.dangerBtn}
              type="button"
              onClick={onCancelRun}
              disabled={!activeRun || END_STATUSES.has(activeRun.status) || isCancellingRun}
            >
              {isCancellingRun ? "Annulation..." : "Annuler l'execution"}
            </button>
          </div>
          {!activeRunId ? (
            <p className={styles.emptyState}>
              Selectionnez une execution dans le tableau pour afficher les details et les logs.
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
                  <dt>PID</dt>
                  <dd>{runDetails.pid ?? "n/a"}</dd>
                </div>
                <div>
                  <dt>Code de sortie</dt>
                  <dd>{runDetails.exit_code ?? "n/a"}</dd>
                </div>
                <div>
                  <dt>Zone</dt>
                  <dd>{runDetails.zone ?? "-"}</dd>
                </div>
              </dl>
              <p className={styles.command}>
                Commande executee : <code>{runDetails.command.join(" ")}</code>
              </p>
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
                    {autoScrollLogs ? "Defiler automatiquement: oui" : "Defiler automatiquement: non"}
                  </button>
                  <button
                    className={styles.secondaryBtn}
                    type="button"
                    onClick={() => setIsTerminalFullscreen((prev) => !prev)}
                  >
                    {isTerminalFullscreen ? "Quitter le plein ecran" : "Plein ecran"}
                  </button>
                </div>
                <pre
                  ref={logsRef}
                  className={`${styles.logs} ${isTerminalFullscreen ? styles.logsFullscreen : ""} ${
                    isTypingLogs ? styles.logsTyping : ""
                  }`}
                >
                  {animatedLogs || "Aucun log disponible pour cette execution."}
                  {isRunning || isTypingLogs ? <span className={styles.cursor}>█</span> : null}
                </pre>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

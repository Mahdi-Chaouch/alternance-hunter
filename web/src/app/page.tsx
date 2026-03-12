"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";

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
};

const END_STATUSES = new Set(["succeeded", "failed", "cancelled"]);
type ThemeMode = "light" | "dark";

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

export default function Home() {
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [mode, setMode] = useState<RunMode>("pipeline");
  const [zone, setZone] = useState<Zone>("all");
  const [dryRun, setDryRun] = useState(false);
  const [maxMinutes, setMaxMinutes] = useState(30);
  const [maxSites, setMaxSites] = useState(1500);
  const [targetFound, setTargetFound] = useState(100);
  const [workers, setWorkers] = useState(20);
  const [useAi, setUseAi] = useState(false);
  const [submitting, setSubmitting] = useState(false);
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

  const refreshRuns = useCallback(async () => {
    const response = await fetch("/api/runs?limit=30", { cache: "no-store" });
    const data = (await safeJson<{ runs: RunListItem[]; detail?: string }>(
      response,
    )) as { runs?: RunListItem[]; detail?: string };
    if (!response.ok) {
      throw new Error(data.detail ?? "Impossible de recuperer la liste des runs.");
    }
    const nextRuns = [...(data.runs ?? [])].reverse();
    setRuns(nextRuns);
    if (!activeRunId && nextRuns[0]?.run_id) {
      setActiveRunId(nextRuns[0].run_id);
    }
  }, [activeRunId]);

  const refreshRunDetails = useCallback(async () => {
    if (!activeRunId) {
      setRunDetails(null);
      return;
    }
    const response = await fetch(`/api/runs/${activeRunId}?tail=400`, {
      cache: "no-store",
    });
    const data = (await safeJson<RunStatusResponse & { detail?: string }>(
      response,
    )) as Partial<RunStatusResponse> & { detail?: string };
    if (!response.ok) {
      throw new Error(data.detail ?? `Impossible de recuperer le run ${activeRunId}.`);
    }
    setRunDetails(data as RunStatusResponse);
  }, [activeRunId]);

  const refreshAll = useCallback(async () => {
    setError("");
    try {
      await refreshRuns();
      await refreshRunDetails();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue.";
      setError(message);
    }
  }, [refreshRuns, refreshRunDetails]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const activeRun = useMemo(
    () => runs.find((run) => run.run_id === activeRunId) ?? null,
    [runs, activeRunId],
  );
  const isRunning = runDetails ? !END_STATUSES.has(runDetails.status) : false;
  const logsText = runDetails?.logs_tail.join("\n") ?? "";

  useEffect(() => {
    animatedLogsRef.current = animatedLogs;
  }, [animatedLogs]);

  useEffect(() => {
    const intervalMs = isRunning ? 2000 : 5000;
    const intervalId = window.setInterval(() => {
      void refreshAll();
    }, intervalMs);
    return () => window.clearInterval(intervalId);
  }, [isRunning, refreshAll]);

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
    setSubmitting(true);
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

      setInfo(`Run lance: ${data.run_id}`);
      setActiveRunId(data.run_id);
      await refreshAll();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function onCancelRun() {
    if (!activeRunId) {
      return;
    }
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
    }
  }

  return (
    <div className={`${styles.page} ${theme === "dark" ? styles.pageDark : ""}`}>
      <main className={styles.main}>
        <section className={styles.topbar}>
          <p>Interface de pilotage du pipeline</p>
          <button
            className={styles.secondaryBtn}
            type="button"
            onClick={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}
          >
            {theme === "light" ? "Mode sombre" : "Mode clair"}
          </button>
        </section>

        <section className={styles.panel}>
          <h1>Alternance Pipeline Dashboard</h1>
          <p className={styles.panelHint}>
            Lance un run du pipeline puis suis son execution et ses logs en direct.
          </p>
          <form className={styles.form} onSubmit={onSubmit}>
            <label>
              Mode
              <select value={mode} onChange={(e) => setMode(e.target.value as RunMode)}>
                <option value="pipeline">pipeline</option>
                <option value="hunter">hunter</option>
                <option value="generate">generate</option>
                <option value="drafts">drafts</option>
              </select>
            </label>
            <label>
              Zone
              <select value={zone} onChange={(e) => setZone(e.target.value as Zone)}>
                <option value="all">all</option>
                <option value="paris">paris</option>
                <option value="cannes">cannes</option>
                <option value="auxerre">auxerre</option>
                <option value="fontainebleau">fontainebleau</option>
              </select>
            </label>
            <div className={styles.row}>
              <label>
                Max minutes
                <input
                  type="number"
                  min={1}
                  value={maxMinutes}
                  onChange={(e) => setMaxMinutes(Number(e.target.value))}
                />
              </label>
              <label>
                Max sites
                <input
                  type="number"
                  min={1}
                  value={maxSites}
                  onChange={(e) => setMaxSites(Number(e.target.value))}
                />
              </label>
            </div>
            <div className={styles.row}>
              <label>
                Target found
                <input
                  type="number"
                  min={1}
                  value={targetFound}
                  onChange={(e) => setTargetFound(Number(e.target.value))}
                />
              </label>
              <label>
                Workers
                <input
                  type="number"
                  min={1}
                  value={workers}
                  onChange={(e) => setWorkers(Number(e.target.value))}
                />
              </label>
            </div>
            <div className={styles.toggles}>
              <label>
                <input
                  type="checkbox"
                  checked={dryRun}
                  onChange={(e) => setDryRun(e.target.checked)}
                />
                Dry run
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={useAi}
                  onChange={(e) => setUseAi(e.target.checked)}
                />
                Use AI
              </label>
            </div>
            <button className={styles.primaryBtn} type="submit" disabled={submitting}>
              {submitting ? "Lancement..." : "Lancer un run"}
            </button>
          </form>

          {info ? <p className={styles.info}>{info}</p> : null}
          {error ? <p className={styles.error}>{error}</p> : null}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Runs recents</h2>
            <button
              className={styles.secondaryBtn}
              type="button"
              onClick={() => void refreshAll()}
            >
              Rafraichir
            </button>
          </div>
          <div className={styles.runList}>
            {runs.length === 0 ? (
              <p>Aucun run pour le moment.</p>
            ) : (
              runs.map((run) => (
                <button
                  key={run.run_id}
                  className={`${styles.runItem} ${activeRunId === run.run_id ? styles.activeRun : ""}`}
                  type="button"
                  onClick={() => setActiveRunId(run.run_id)}
                >
                  <span>{run.run_id.slice(0, 10)}...</span>
                  <span>{run.status}</span>
                </button>
              ))
            )}
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Details du run</h2>
            <button
              className={styles.secondaryBtn}
              type="button"
              onClick={onCancelRun}
              disabled={!activeRun || END_STATUSES.has(activeRun.status)}
            >
              Annuler
            </button>
          </div>
          {!runDetails ? (
            <p>Selectionne un run pour afficher les details.</p>
          ) : (
            <>
              <dl className={styles.metaGrid}>
                <div>
                  <dt>ID</dt>
                  <dd>{runDetails.run_id}</dd>
                </div>
                <div>
                  <dt>Statut</dt>
                  <dd>{runDetails.status}</dd>
                </div>
                <div>
                  <dt>PID</dt>
                  <dd>{runDetails.pid ?? "n/a"}</dd>
                </div>
                <div>
                  <dt>Exit code</dt>
                  <dd>{runDetails.exit_code ?? "n/a"}</dd>
                </div>
              </dl>
              <p className={styles.command}>
                Commande: <code>{runDetails.command.join(" ")}</code>
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
                } ${
                  isTerminalFullscreen ? styles.terminalFullscreen : ""
                }`}
              >
                <div className={styles.terminalHeader}>
                  <span className={styles.dotRed} />
                  <span className={styles.dotYellow} />
                  <span className={styles.dotGreen} />
                  <strong>Terminal live</strong>
                  <span className={styles.terminalStatus}>
                    {isRunning ? "en cours..." : "termine"}
                  </span>
                  <button
                    className={styles.secondaryBtn}
                    type="button"
                    onClick={() => setAutoScrollLogs((prev) => !prev)}
                  >
                    {autoScrollLogs ? "Auto-scroll on" : "Auto-scroll off"}
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
                  {animatedLogs || "Pas de logs pour ce run."}
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

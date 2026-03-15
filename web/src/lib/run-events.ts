import { Pool } from "pg";
import { getDatabaseUrl, isProduction } from "./env";

const DATABASE_URL = getDatabaseUrl();

const globalForRunEvents = globalThis as unknown as { runEventsPool?: Pool };

const runEventsPool =
  globalForRunEvents.runEventsPool ??
  new Pool({
    connectionString: DATABASE_URL,
  });

if (!isProduction) {
  globalForRunEvents.runEventsPool = runEventsPool;
}

let tableReady = false;

export async function ensureRunEventsTable(): Promise<void> {
  if (tableReady) return;
  await runEventsPool.query(`
    CREATE TABLE IF NOT EXISTS run_events (
      id BIGSERIAL PRIMARY KEY,
      run_id TEXT NOT NULL,
      owner_user_id TEXT NOT NULL DEFAULT '',
      owner_email TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'queued',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await runEventsPool.query(`
    CREATE INDEX IF NOT EXISTS run_events_created_at_idx ON run_events (created_at);
  `);
  tableReady = true;
}

export async function insertRunEvent(params: {
  runId: string;
  ownerUserId: string;
  ownerEmail: string;
  status?: string;
}): Promise<void> {
  await ensureRunEventsTable();
  await runEventsPool.query(
    `INSERT INTO run_events (run_id, owner_user_id, owner_email, status)
     VALUES ($1, $2, $3, $4)`,
    [
      params.runId,
      params.ownerUserId ?? "",
      params.ownerEmail ?? "",
      params.status ?? "queued",
    ],
  );
}

export type RunsByDay = { date: string; count: number };

export async function getRunEventsStats(): Promise<{
  total_runs: number;
  runs_by_day: RunsByDay[];
  unique_users: number;
}> {
  await ensureRunEventsTable();
  const [totalRes, dayRes, usersRes] = await Promise.all([
    runEventsPool.query<{ total_runs: string }>(
      `SELECT COUNT(*)::text as total_runs FROM run_events`,
    ),
    runEventsPool.query<{ date: string; count: string }>(
      `SELECT date_trunc('day', created_at)::date::text as date, COUNT(*)::text as count
       FROM run_events
       WHERE created_at >= NOW() - INTERVAL '30 days'
       GROUP BY date_trunc('day', created_at)
       ORDER BY date ASC`,
    ),
    runEventsPool.query<{ unique_users: string }>(
      `SELECT COUNT(DISTINCT owner_email)::text as unique_users FROM run_events WHERE owner_email != ''`,
    ),
  ]);
  const total_runs = parseInt(totalRes.rows?.[0]?.total_runs ?? "0", 10);
  const unique_users = parseInt(usersRes.rows?.[0]?.unique_users ?? "0", 10);
  const runs_by_day: RunsByDay[] = (dayRes.rows ?? []).map((r) => ({
    date: r.date,
    count: parseInt(r.count, 10),
  }));
  return { total_runs, runs_by_day, unique_users };
}

export type RunEventRow = { run_id: string; owner_email: string; created_at: string };

export async function getLastRunEvents(limit: number): Promise<RunEventRow[]> {
  await ensureRunEventsTable();
  const result = await runEventsPool.query<RunEventRow>(
    `SELECT run_id, owner_email, created_at::text as created_at
     FROM run_events ORDER BY created_at DESC LIMIT $1`,
    [Math.min(limit, 100)],
  );
  return result.rows ?? [];
}

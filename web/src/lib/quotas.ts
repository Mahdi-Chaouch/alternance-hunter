/**
 * Per-user daily quotas: runs/day and uploads/day.
 * Uses existing run_events table for runs; upload_events table for uploads.
 */

import { pgPool } from "./db";
import { ensureRunEventsTable } from "./run-events";

function getEnvInt(name: string, defaultValue: number): number {
  const raw = process.env[name]?.trim();
  if (raw === undefined || raw === "") return defaultValue;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) || n < 0 ? defaultValue : n;
}

/** Max runs per user per calendar day (UTC). */
export const QUOTA_RUNS_PER_DAY = getEnvInt("QUOTA_RUNS_PER_DAY", 30);

/** Max uploads per user per calendar day (UTC). */
export const QUOTA_UPLOADS_PER_DAY = getEnvInt("QUOTA_UPLOADS_PER_DAY", 50);

let uploadEventsTableReady = false;

async function ensureUploadEventsTable(): Promise<void> {
  if (uploadEventsTableReady) return;
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS upload_events (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pgPool.query(`
    CREATE INDEX IF NOT EXISTS upload_events_user_created_idx
    ON upload_events (user_id, created_at);
  `);
  uploadEventsTableReady = true;
}

/** Count runs created today (UTC) for the given user. */
export async function getRunsTodayCount(userId: string): Promise<number> {
  await ensureRunEventsTable();
  const result = await pgPool.query<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM run_events
     WHERE owner_user_id = $1
       AND created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`,
    [userId || ""],
  );
  const count = result.rows?.[0]?.count;
  return parseInt(count ?? "0", 10);
}

export type QuotaCheckResult =
  | { allowed: true; current: number; limit: number }
  | { allowed: false; current: number; limit: number };

export async function checkRunsQuota(userId: string): Promise<QuotaCheckResult> {
  const current = await getRunsTodayCount(userId);
  const limit = QUOTA_RUNS_PER_DAY;
  return { allowed: current < limit, current, limit };
}

/** Count uploads created today (UTC) for the given user. */
export async function getUploadsTodayCount(userId: string): Promise<number> {
  await ensureUploadEventsTable();
  const result = await pgPool.query<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM upload_events
     WHERE user_id = $1
       AND created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`,
    [userId || ""],
  );
  const count = result.rows?.[0]?.count;
  return parseInt(count ?? "0", 10);
}

export async function checkUploadsQuota(userId: string): Promise<QuotaCheckResult> {
  const current = await getUploadsTodayCount(userId);
  const limit = QUOTA_UPLOADS_PER_DAY;
  return { allowed: current < limit, current, limit };
}

/** Record one upload event for the user (call after successful upload). */
export async function recordUploadEvent(userId: string): Promise<void> {
  await ensureUploadEventsTable();
  await pgPool.query(
    `INSERT INTO upload_events (user_id) VALUES ($1)`,
    [userId || ""],
  );
}

export async function deleteUploadEventsForUser(userId: string): Promise<void> {
  await ensureUploadEventsTable();
  await pgPool.query(`DELETE FROM upload_events WHERE user_id = $1`, [userId]);
}

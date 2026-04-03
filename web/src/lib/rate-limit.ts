/**
 * PostgreSQL-backed rate limiting per user.
 * Uses fixed 1-minute windows with atomic upserts — works across all Vercel instances.
 * Falls back gracefully (allow) if the DB is unreachable, to avoid blocking users on infra issues.
 */

import { Pool } from "pg";
import { getDatabaseUrl, isProduction } from "./env";

const DATABASE_URL = getDatabaseUrl();

const globalForRateLimit = globalThis as unknown as { rateLimitPool?: Pool };

const rateLimitPool =
  globalForRateLimit.rateLimitPool ??
  new Pool({ connectionString: DATABASE_URL });

if (!isProduction) {
  globalForRateLimit.rateLimitPool = rateLimitPool;
}

const WINDOW_MS = 60 * 1_000;

let tableReady = false;

async function ensureTable(): Promise<void> {
  if (tableReady) return;
  await rateLimitPool.query(`
    CREATE TABLE IF NOT EXISTS rate_limit_counters (
      key         TEXT        NOT NULL,
      window_start TIMESTAMPTZ NOT NULL,
      count       INTEGER     NOT NULL DEFAULT 0,
      PRIMARY KEY (key, window_start)
    )
  `);
  await rateLimitPool.query(`
    CREATE INDEX IF NOT EXISTS rate_limit_window_idx
      ON rate_limit_counters (window_start)
  `);
  tableReady = true;
}

function getEnvInt(name: string, defaultValue: number): number {
  const raw = process.env[name]?.trim();
  if (raw === undefined || raw === "") return defaultValue;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) || n < 1 ? defaultValue : n;
}

/** Max requests per minute for general API (runs, uploads, list, etc.). */
export const RATE_LIMIT_API_PER_MINUTE = getEnvInt(
  "RATE_LIMIT_API_PER_MINUTE",
  120,
);

/** Max cancel requests per minute per user. */
export const RATE_LIMIT_CANCEL_PER_MINUTE = getEnvInt(
  "RATE_LIMIT_CANCEL_PER_MINUTE",
  5,
);

/** Max support form submissions per minute per client IP (Discord webhook). */
export const RATE_LIMIT_SUPPORT_PER_MINUTE = getEnvInt(
  "RATE_LIMIT_SUPPORT_PER_MINUTE",
  5,
);

export type RateLimitResult =
  | { allowed: true; remaining: number; resetAt: number }
  | { allowed: false; remaining: 0; resetAt: number };

/**
 * Check and consume one request for the given user and scope.
 * Returns allowed/remaining/resetAt. When allowed is false, caller should return 429.
 * Never throws — returns allowed:true on DB errors to avoid blocking legitimate users.
 */
export async function checkRateLimit(
  userId: string,
  scope: "api" | "cancel" | "support",
  limit: number,
): Promise<RateLimitResult> {
  // Fixed window aligned to the minute boundary
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / WINDOW_MS) * WINDOW_MS);
  const resetAt = windowStart.getTime() + WINDOW_MS;
  const key = `${userId}:${scope}`;

  try {
    await ensureTable();

    // Async cleanup of expired windows (1% of requests, non-blocking)
    if (Math.random() < 0.01) {
      rateLimitPool
        .query(`DELETE FROM rate_limit_counters WHERE window_start < $1`, [
          new Date(now - WINDOW_MS * 2),
        ])
        .catch(() => {});
    }

    const result = await rateLimitPool.query<{ count: string }>(
      `INSERT INTO rate_limit_counters (key, window_start, count)
       VALUES ($1, $2, 1)
       ON CONFLICT (key, window_start) DO UPDATE
         SET count = rate_limit_counters.count + 1
       RETURNING count`,
      [key, windowStart],
    );

    const newCount = parseInt(result.rows[0]?.count ?? "1", 10);

    if (newCount > limit) {
      return { allowed: false, remaining: 0, resetAt };
    }

    return { allowed: true, remaining: Math.max(0, limit - newCount), resetAt };
  } catch {
    // DB unavailable — fail open to avoid blocking users
    return { allowed: true, remaining: 0, resetAt };
  }
}

/** Seconds until reset (for Retry-After header). */
export function retryAfterSeconds(resetAt: number): number {
  return Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
}

/** Removes rate-limit rows for this user (all time windows). */
export async function deleteRateLimitRowsForUser(userId: string): Promise<void> {
  const id = userId.trim();
  if (!id) return;
  try {
    await ensureTable();
    await rateLimitPool.query(
      `DELETE FROM rate_limit_counters WHERE key = $1 OR key = $2`,
      [`${id}:api`, `${id}:cancel`],
    );
  } catch {
    // same fail-open spirit as checkRateLimit
  }
}

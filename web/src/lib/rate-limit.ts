/**
 * In-memory rate limiting per user.
 * Keys are scoped by userId + scope (e.g. "api", "cancel").
 * Uses fixed 1-minute windows; old entries are pruned on access.
 */

const WINDOW_MS = 60 * 1000;

type Entry = { count: number; windowStart: number };

const store = new Map<string, Entry>();

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

/** Max cancel requests per minute per user (cancel burst). */
export const RATE_LIMIT_CANCEL_PER_MINUTE = getEnvInt(
  "RATE_LIMIT_CANCEL_PER_MINUTE",
  5,
);

function prune(key: string, now: number): void {
  const entry = store.get(key);
  if (!entry) return;
  if (now - entry.windowStart >= WINDOW_MS) {
    store.delete(key);
  }
}

export type RateLimitResult =
  | { allowed: true; remaining: number; resetAt: number }
  | { allowed: false; remaining: 0; resetAt: number };

/**
 * Check and consume one request for the given user and scope.
 * Returns allowed/remaining/resetAt. When allowed is false, caller should return 429.
 */
export function checkRateLimit(
  userId: string,
  scope: "api" | "cancel",
  limit: number,
): RateLimitResult {
  const key = `${userId}:${scope}`;
  const now = Date.now();
  prune(key, now);

  const entry = store.get(key);
  const inCurrentWindow = entry && now - entry.windowStart < WINDOW_MS;

  if (!inCurrentWindow) {
    store.set(key, { count: 1, windowStart: now });
    const resetAt = now + WINDOW_MS;
    return {
      allowed: true,
      remaining: Math.max(0, limit - 1),
      resetAt,
    };
  }

  const newCount = (entry!.count ?? 0) + 1;
  entry!.count = newCount;
  const resetAt = entry!.windowStart + WINDOW_MS;

  if (newCount > limit) {
    return { allowed: false, remaining: 0, resetAt };
  }

  return {
    allowed: true,
    remaining: Math.max(0, limit - newCount),
    resetAt,
  };
}

/** Seconds until reset (for Retry-After header). */
export function retryAfterSeconds(resetAt: number): number {
  return Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
}

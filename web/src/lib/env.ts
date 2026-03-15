/**
 * Production secrets policy: in production, required env vars must be set;
 * no sensitive fallbacks (hardcoded secrets or localhost defaults).
 */

export const isProduction = process.env.NODE_ENV === "production";

/**
 * Returns the value for `key` from env. In production, throws if missing or empty.
 * In development, returns env value or `devDefault` (use only non-sensitive dev defaults).
 */
export function getRequiredEnv(key: string, devDefault?: string): string {
  const value = (process.env[key] ?? "").trim();
  if (isProduction) {
    if (!value) {
      throw new Error(
        `[Production] Missing required env: ${key}. Set ${key} in your environment.`,
      );
    }
    return value;
  }
  return value || (devDefault ?? "");
}

/**
 * Returns env value or undefined. Use when the var is optional in both dev and prod.
 */
export function getOptionalEnv(key: string): string | undefined {
  const value = (process.env[key] ?? "").trim();
  return value || undefined;
}

const DEV_DATABASE_URL =
  "postgres://postgres:postgres@127.0.0.1:5432/alternance_mails";

/**
 * DATABASE_URL for Postgres. In production it must be set; in development falls back to local default.
 */
export function getDatabaseUrl(): string {
  const value = (process.env.DATABASE_URL ?? "").trim();
  if (isProduction && !value) {
    throw new Error(
      "[Production] DATABASE_URL is required. Set it in your environment.",
    );
  }
  return value || DEV_DATABASE_URL;
}

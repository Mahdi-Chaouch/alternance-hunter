import { pgPool } from "./db";

let tableReady = false;

async function ensureTable(): Promise<void> {
  if (tableReady) return;
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  tableReady = true;
}

async function getSetting(key: string, defaultValue: string): Promise<string> {
  await ensureTable();
  const result = await pgPool.query<{ value: string }>(
    `SELECT value FROM app_settings WHERE key = $1`,
    [key],
  );
  return result.rows[0]?.value ?? defaultValue;
}

async function setSetting(key: string, value: string): Promise<void> {
  await ensureTable();
  await pgPool.query(
    `INSERT INTO app_settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
    [key, value],
  );
}

export async function getWhitelistEnabled(): Promise<boolean> {
  const val = await getSetting("whitelist_enabled", "true");
  return val !== "false";
}

export async function setWhitelistEnabled(enabled: boolean): Promise<void> {
  await setSetting("whitelist_enabled", enabled ? "true" : "false");
}

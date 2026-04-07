import { pgPool } from "./db";
import { getWhitelistEnabled } from "./app-settings";

const INVITED_EMAILS_ENV_KEYS = ["AUTH_ALLOWED_EMAILS", "INVITED_EMAILS"] as const;

let tableReady = false;

function parseEnvEmails(): string[] {
  for (const key of INVITED_EMAILS_ENV_KEYS) {
    const raw = process.env[key];
    if (!raw) continue;
    const list = raw
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .filter((v) => v.length > 0);
    if (list.length > 0) return list;
  }
  return [];
}

export async function ensureInvitedEmailsTable(): Promise<void> {
  if (tableReady) return;
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS invited_emails (
      email TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  tableReady = true;
}

export async function seedInvitedEmailsFromEnv(): Promise<number> {
  await ensureInvitedEmailsTable();
  const envEmails = parseEnvEmails();
  if (envEmails.length === 0) return 0;
  let inserted = 0;
  for (const email of envEmails) {
    try {
      await pgPool.query(
        `INSERT INTO invited_emails (email) VALUES ($1) ON CONFLICT (email) DO NOTHING`,
        [email],
      );
      const r = await pgPool.query(
        `SELECT 1 FROM invited_emails WHERE email = $1`,
        [email],
      );
      if (r.rowCount && r.rowCount > 0) inserted++;
    } catch {
      // ignore duplicate or error
    }
  }
  return inserted;
}

export type InvitedEmailRow = { email: string; created_at: string };

export async function getInvitedEmails(): Promise<InvitedEmailRow[]> {
  await ensureInvitedEmailsTable();
  const result = await pgPool.query<InvitedEmailRow>(
    `SELECT email, created_at::text as created_at FROM invited_emails ORDER BY created_at DESC`,
  );
  const rows = result.rows ?? [];
  if (rows.length === 0) {
    const envList = parseEnvEmails();
    if (envList.length > 0) {
      await seedInvitedEmailsFromEnv();
      const again = await pgPool.query<InvitedEmailRow>(
        `SELECT email, created_at::text as created_at FROM invited_emails ORDER BY created_at DESC`,
      );
      return again.rows ?? [];
    }
  }
  return rows;
}

export async function addInvitedEmail(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return false;
  await ensureInvitedEmailsTable();
  await pgPool.query(
    `INSERT INTO invited_emails (email) VALUES ($1) ON CONFLICT (email) DO NOTHING`,
    [normalized],
  );
  return true;
}

export async function removeInvitedEmail(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  await ensureInvitedEmailsTable();
  const result = await pgPool.query(
    `DELETE FROM invited_emails WHERE email = $1`,
    [normalized],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function isInvitedEmail(email: string | null | undefined): Promise<boolean> {
  const normalized = (email ?? "").trim().toLowerCase();
  if (!normalized) return false;
  const whitelistEnabled = await getWhitelistEnabled();
  if (!whitelistEnabled) return true;
  await ensureInvitedEmailsTable();
  const result = await pgPool.query(
    `SELECT 1 FROM invited_emails WHERE email = $1 LIMIT 1`,
    [normalized],
  );
  if ((result.rowCount ?? 0) > 0) return true;
  const envEmails = parseEnvEmails();
  if (envEmails.length > 0) {
    const set = new Set(envEmails);
    return set.has(normalized);
  }
  return false;
}

export async function getInvitedEmailsCount(): Promise<number> {
  await ensureInvitedEmailsTable();
  const result = await pgPool.query(
    `SELECT COUNT(*)::int as c FROM invited_emails`,
  );
  const c = result.rows?.[0]?.c;
  return typeof c === "number" ? c : 0;
}

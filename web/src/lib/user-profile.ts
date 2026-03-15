import { Pool } from "pg";

type StoredUserProfile = {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  linkedin_url: string;
  portfolio_url: string;
  subject_template: string;
  body_template: string;
  run_mode: string;
  run_zone: string;
  run_sector: string;
  run_specialty: string;
  run_dry_run: boolean;
  run_max_minutes: number;
  run_max_sites: number;
  run_target_found: number;
  run_workers: number;
  run_use_ai: boolean;
  updated_at: string;
};

type UserProfileInput = {
  firstName: string;
  lastName: string;
  linkedinUrl: string;
  portfolioUrl: string;
  subjectTemplate: string;
  bodyTemplate: string;
  runMode: string;
  runZone: string;
  runSector: string;
  runSpecialty: string;
  runDryRun: boolean;
  runMaxMinutes: number;
  runMaxSites: number;
  runTargetFound: number;
  runWorkers: number;
  runUseAi: boolean;
};

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@127.0.0.1:5432/alternance_mails";

const globalForProfile = globalThis as unknown as { userProfilePool?: Pool };

const userProfilePool =
  globalForProfile.userProfilePool ??
  new Pool({
    connectionString: DATABASE_URL,
  });

if (process.env.NODE_ENV !== "production") {
  globalForProfile.userProfilePool = userProfilePool;
}

let profileTableReady = false;

async function ensureUserProfileTable(): Promise<void> {
  if (profileTableReady) {
    return;
  }
  await userProfilePool.query(`
    CREATE TABLE IF NOT EXISTS run_user_profiles (
      user_id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      first_name TEXT NOT NULL DEFAULT '',
      last_name TEXT NOT NULL DEFAULT '',
      linkedin_url TEXT NOT NULL DEFAULT '',
      portfolio_url TEXT NOT NULL DEFAULT '',
      subject_template TEXT NOT NULL DEFAULT '',
      body_template TEXT NOT NULL DEFAULT '',
      run_mode TEXT NOT NULL DEFAULT 'pipeline',
      run_zone TEXT NOT NULL DEFAULT 'all',
      run_sector TEXT NOT NULL DEFAULT 'it',
      run_specialty TEXT NOT NULL DEFAULT '',
      run_dry_run BOOLEAN NOT NULL DEFAULT FALSE,
      run_max_minutes INTEGER NOT NULL DEFAULT 30,
      run_max_sites INTEGER NOT NULL DEFAULT 1500,
      run_target_found INTEGER NOT NULL DEFAULT 100,
      run_workers INTEGER NOT NULL DEFAULT 20,
      run_use_ai BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await userProfilePool.query(`
    ALTER TABLE run_user_profiles
      ADD COLUMN IF NOT EXISTS run_mode TEXT NOT NULL DEFAULT 'pipeline',
      ADD COLUMN IF NOT EXISTS run_zone TEXT NOT NULL DEFAULT 'all',
      ADD COLUMN IF NOT EXISTS run_dry_run BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS run_max_minutes INTEGER NOT NULL DEFAULT 30,
      ADD COLUMN IF NOT EXISTS run_max_sites INTEGER NOT NULL DEFAULT 1500,
      ADD COLUMN IF NOT EXISTS run_target_found INTEGER NOT NULL DEFAULT 100,
      ADD COLUMN IF NOT EXISTS run_workers INTEGER NOT NULL DEFAULT 20,
      ADD COLUMN IF NOT EXISTS portfolio_url TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS run_use_ai BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS run_sector TEXT NOT NULL DEFAULT 'it',
      ADD COLUMN IF NOT EXISTS run_specialty TEXT NOT NULL DEFAULT '';
  `);
  profileTableReady = true;
}

export async function getUserProfile(userId: string): Promise<StoredUserProfile | null> {
  await ensureUserProfileTable();
  const result = await userProfilePool.query<StoredUserProfile>(
    `SELECT user_id, email, first_name, last_name, linkedin_url, subject_template, body_template,
            portfolio_url, run_mode, run_zone, run_sector, run_specialty, run_dry_run, run_max_minutes, run_max_sites,
            run_target_found, run_workers, run_use_ai, updated_at
     FROM run_user_profiles
     WHERE user_id = $1`,
    [userId],
  );
  return result.rows[0] ?? null;
}

export async function upsertUserProfile(
  userId: string,
  email: string,
  input: UserProfileInput,
): Promise<StoredUserProfile> {
  await ensureUserProfileTable();
  const result = await userProfilePool.query<StoredUserProfile>(
    `INSERT INTO run_user_profiles
      (user_id, email, first_name, last_name, linkedin_url, portfolio_url, subject_template, body_template,
       run_mode, run_zone, run_sector, run_specialty, run_dry_run, run_max_minutes, run_max_sites, run_target_found, run_workers,
       run_use_ai, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW())
     ON CONFLICT (user_id)
     DO UPDATE SET
       email = EXCLUDED.email,
       first_name = EXCLUDED.first_name,
       last_name = EXCLUDED.last_name,
       linkedin_url = EXCLUDED.linkedin_url,
       portfolio_url = EXCLUDED.portfolio_url,
       subject_template = EXCLUDED.subject_template,
       body_template = EXCLUDED.body_template,
       run_mode = EXCLUDED.run_mode,
       run_zone = EXCLUDED.run_zone,
       run_sector = EXCLUDED.run_sector,
       run_specialty = EXCLUDED.run_specialty,
       run_dry_run = EXCLUDED.run_dry_run,
       run_max_minutes = EXCLUDED.run_max_minutes,
       run_max_sites = EXCLUDED.run_max_sites,
       run_target_found = EXCLUDED.run_target_found,
       run_workers = EXCLUDED.run_workers,
       run_use_ai = EXCLUDED.run_use_ai,
       updated_at = NOW()
     RETURNING user_id, email, first_name, last_name, linkedin_url, portfolio_url,
               subject_template, body_template, run_mode, run_zone, run_sector, run_specialty, run_dry_run,
               run_max_minutes, run_max_sites, run_target_found, run_workers, run_use_ai,
               updated_at`,
    [
      userId,
      email,
      input.firstName.trim(),
      input.lastName.trim(),
      input.linkedinUrl.trim(),
      input.portfolioUrl.trim(),
      input.subjectTemplate,
      input.bodyTemplate,
      input.runMode,
      input.runZone,
      input.runSector,
      input.runSpecialty.slice(0, 200),
      input.runDryRun,
      input.runMaxMinutes,
      input.runMaxSites,
      input.runTargetFound,
      input.runWorkers,
      input.runUseAi,
    ],
  );
  return result.rows[0];
}

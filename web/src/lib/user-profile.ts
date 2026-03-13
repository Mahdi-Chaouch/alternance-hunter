import { Pool } from "pg";

type StoredUserProfile = {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  linkedin_url: string;
  subject_template: string;
  body_template: string;
  updated_at: string;
};

type UserProfileInput = {
  firstName: string;
  lastName: string;
  linkedinUrl: string;
  subjectTemplate: string;
  bodyTemplate: string;
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
      subject_template TEXT NOT NULL DEFAULT '',
      body_template TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  profileTableReady = true;
}

export async function getUserProfile(userId: string): Promise<StoredUserProfile | null> {
  await ensureUserProfileTable();
  const result = await userProfilePool.query<StoredUserProfile>(
    `SELECT user_id, email, first_name, last_name, linkedin_url, subject_template, body_template, updated_at
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
      (user_id, email, first_name, last_name, linkedin_url, subject_template, body_template, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (user_id)
     DO UPDATE SET
       email = EXCLUDED.email,
       first_name = EXCLUDED.first_name,
       last_name = EXCLUDED.last_name,
       linkedin_url = EXCLUDED.linkedin_url,
       subject_template = EXCLUDED.subject_template,
       body_template = EXCLUDED.body_template,
       updated_at = NOW()
     RETURNING user_id, email, first_name, last_name, linkedin_url, subject_template, body_template, updated_at`,
    [
      userId,
      email,
      input.firstName.trim(),
      input.lastName.trim(),
      input.linkedinUrl.trim(),
      input.subjectTemplate,
      input.bodyTemplate,
    ],
  );
  return result.rows[0];
}

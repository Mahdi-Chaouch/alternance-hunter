-- Recruiting database schema (companies/jobs/contacts extracted from scraping)
-- Target: Postgres. Tables are created in the default "public" schema.
--
-- This schema is intentionally conservative and safe to run multiple times.
-- Companies, contacts and job_posts are SHARED across all users.
-- User-specific data stays in scrape_runs and candidatures (SQLite).

BEGIN;

CREATE TABLE IF NOT EXISTS scrape_runs (
  id BIGSERIAL PRIMARY KEY,
  run_id TEXT NULL,
  user_key TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ NULL,
  zone TEXT NULL,
  focus TEXT NULL,
  sector TEXT NULL,
  mode TEXT NULL
);

CREATE TABLE IF NOT EXISTS companies (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  website TEXT NULL,
  domain TEXT NOT NULL,
  sector TEXT NULL,
  location TEXT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (domain)
);

CREATE INDEX IF NOT EXISTS idx_companies_sector ON companies(sector);
CREATE INDEX IF NOT EXISTS idx_companies_location ON companies(location);

CREATE TABLE IF NOT EXISTS job_posts (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  location TEXT NULL,
  job_url TEXT NOT NULL,
  source_url TEXT NULL,
  posted_date DATE NULL,
  scraped_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'open',
  confidence REAL NOT NULL DEFAULT 0,
  UNIQUE (company_id, job_url)
);

CREATE INDEX IF NOT EXISTS idx_job_posts_company_id ON job_posts(company_id);

CREATE TABLE IF NOT EXISTS contacts (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  contact_kind TEXT NOT NULL DEFAULT 'unknown',
  is_hr BOOLEAN NOT NULL DEFAULT FALSE,
  source_url TEXT NULL,
  scraped_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confidence REAL NOT NULL DEFAULT 0,
  raw_context TEXT NULL,
  UNIQUE (company_id, email)
);

CREATE INDEX IF NOT EXISTS idx_contacts_company_id ON contacts(company_id);

-- Optional: mapping between extracted job posts and extracted contacts.
CREATE TABLE IF NOT EXISTS job_applications (
  id BIGSERIAL PRIMARY KEY,
  job_post_id BIGINT NOT NULL REFERENCES job_posts(id) ON DELETE CASCADE,
  contact_id BIGINT NULL REFERENCES contacts(id) ON DELETE SET NULL,
  UNIQUE (job_post_id)
);

COMMIT;

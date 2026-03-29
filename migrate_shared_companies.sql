-- Migration: rendre les tables companies/contacts/job_posts communes (shared) entre tous les users.
-- À exécuter UNE SEULE FOIS sur la base de données existante.
-- Les données user-spécifiques (scrape_runs, candidatures) ne sont pas touchées.

BEGIN;

-- 1. Ajouter les nouvelles colonnes sector et location sur companies
ALTER TABLE companies ADD COLUMN IF NOT EXISTS sector TEXT NULL;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS location TEXT NULL;

-- 2. Dédupliquer companies : garder le plus récent (last_seen_at) par domain
DELETE FROM companies c1
USING companies c2
WHERE c1.domain = c2.domain AND c1.id > c2.id;

-- 3. Supprimer l'ancienne contrainte user_key+domain et la remplacer
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_user_key_domain_key;
ALTER TABLE companies ADD CONSTRAINT companies_domain_key UNIQUE (domain)
  DEFERRABLE INITIALLY IMMEDIATE;

-- 4. Supprimer la colonne user_key de companies
ALTER TABLE companies DROP COLUMN IF EXISTS user_key;

-- 5. Créer les index secteur/location
CREATE INDEX IF NOT EXISTS idx_companies_sector ON companies(sector);
CREATE INDEX IF NOT EXISTS idx_companies_location ON companies(location);
DROP INDEX IF EXISTS idx_companies_user_key;

-- 6. Dédupliquer contacts : garder le plus récent (scraped_date) par (company_id, email)
DELETE FROM contacts c1
USING contacts c2
WHERE c1.company_id = c2.company_id
  AND c1.email = c2.email
  AND c1.id > c2.id;

-- 7. Supprimer l'ancienne contrainte et ajouter la nouvelle sur contacts
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_user_key_company_id_email_key;
ALTER TABLE contacts ADD CONSTRAINT contacts_company_id_email_key UNIQUE (company_id, email)
  DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE contacts DROP COLUMN IF EXISTS user_key;
DROP INDEX IF EXISTS idx_contacts_user_key;

-- 8. Dédupliquer job_posts : garder le plus récent par (company_id, job_url)
DELETE FROM job_posts j1
USING job_posts j2
WHERE j1.company_id = j2.company_id
  AND j1.job_url = j2.job_url
  AND j1.id > j2.id;

-- 9. Supprimer l'ancienne contrainte et ajouter la nouvelle sur job_posts
ALTER TABLE job_posts DROP CONSTRAINT IF EXISTS job_posts_user_key_company_id_job_url_key;
ALTER TABLE job_posts ADD CONSTRAINT job_posts_company_id_job_url_key UNIQUE (company_id, job_url)
  DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE job_posts DROP COLUMN IF EXISTS user_key;
DROP INDEX IF EXISTS idx_job_posts_user_key;

-- 10. Nettoyer job_applications si user_key présent
ALTER TABLE job_applications DROP COLUMN IF EXISTS user_key;
ALTER TABLE job_applications DROP CONSTRAINT IF EXISTS job_applications_user_key_job_post_id_key;
ALTER TABLE job_applications ADD CONSTRAINT job_applications_job_post_id_key UNIQUE (job_post_id)
  DEFERRABLE INITIALLY IMMEDIATE;

COMMIT;

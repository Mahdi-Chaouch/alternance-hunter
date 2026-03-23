# Alternance Mails Pipeline

Projet pour automatiser la recherche d'entreprises, la generation de lettres de motivation et la creation de brouillons Gmail, avec une interface web Next.js.

## Structure du projet

- `alternance_hunter.py`: collecte des cibles (scraping / recherche)
- `generate_lm.py`: generation des lettres de motivation
- `create_gmail_drafts.py`: creation des brouillons Gmail avec pieces jointes
- `pipeline.py`: orchestrateur CLI (modes `hunter`, `generate`, `drafts`, `pipeline`)
- `backend_api.py`: API FastAPI pour piloter le pipeline a distance
- `web/`: app Next.js (UI de pilotage)

## Prerequis

- Python 3.11+
- Node.js 20+
- Dependances Python:

```bash
pip install -r requirements.txt
```

- Dependances frontend:

```bash
cd web
npm install
```

## Variables d'environnement

Copier le template puis adapter:

```bash
cp .env.example .env
```

Variables principales:

- `PIPELINE_API_TOKEN` (ou `API_TOKEN`): token de securite pour l'API
- `OPENAI_API_KEY`: requis uniquement si `--use-ai` est active
- `PIPELINE_API_BASE_URL`: URL du backend (utile pour tooling local)
- `AUTH_ALLOWED_EMAILS`: allowlist invite-only des emails autorises sur le dashboard web
- `FRANCE_TRAVAIL_CLIENT_ID` / `FRANCE_TRAVAIL_CLIENT_SECRET` / `FRANCE_TRAVAIL_SCOPE`: credentials API Offres France Travail

## Lancement local

### Option 1: CLI directe

```bash
python pipeline.py --mode pipeline --zone all
```

### Option 2: API backend

```bash
uvicorn backend_api:app --host 127.0.0.1 --port 8000
```

### Option 3: Frontend Next.js

Voir `web/README.md` pour le detail.

## Deploiement

- Frontend (`web/`) -> Vercel
- Backend Python -> service separe (free tier choisi actuellement, migration VPS des que les seuils de charge/fiabilite sont depasses)
- PostgreSQL -> requis pour Better Auth (sessions + comptes OAuth)

Guide public/prive: `docs/PUBLIC_PRIVATE_SETUP.md`.
Decision backend: `docs/BACKEND_HOSTING_DECISION.md`.
Acces API Offres FT: `docs/FRANCE_TRAVAIL_OFFRES_ACCESS.md`.

## Securite et publication

- Les secrets et donnees generees sont ignores via `.gitignore`
- Fichiers sensibles typiques: `secrets/credentials.json`, `secrets/token.json`, `assets/CV.pdf`
- Le frontend est en mode **invite-only**: seuls les emails listes dans `AUTH_ALLOWED_EMAILS` peuvent se connecter
- Les brouillons Gmail utilises par le web sont lies au compte Google de chaque utilisateur (pas de token partage)
- En production, forcer HTTPS pour proteger les cookies de session Better Auth
- Mettre en rotation reguliere: `PIPELINE_API_TOKEN`, `BETTER_AUTH_SECRET`, credentials OAuth Google
- Checklist de publication: `PUBLICATION_CHECKLIST.md`

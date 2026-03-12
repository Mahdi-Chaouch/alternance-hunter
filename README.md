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
- Backend Python -> service separe (VM/VPS/Render/Railway/Fly.io)

Guide public/prive: `docs/PUBLIC_PRIVATE_SETUP.md`.

## Securite et publication

- Les secrets et donnees generees sont ignores via `.gitignore`
- Fichiers sensibles typiques: `secrets/credentials.json`, `secrets/token.json`, `assets/CV.pdf`
- Checklist de publication: `PUBLICATION_CHECKLIST.md`

# Alternance Pipeline Web App (Next.js)

Cette app Next.js permet de piloter le backend Python du pipeline:

- lancer un run (`POST /runs`)
- suivre les runs recents (`GET /runs`)
- suivre le detail d'un run + logs (`GET /runs/{id}`)
- annuler un run (`POST /runs/{id}/cancel`)

## 1) Prerequis

- Node.js 20+
- Le backend Python (`backend_api.py`) doit etre accessible depuis la web app

## 2) Variables d'environnement

Copier `.env.example` vers `.env.local` puis adapter:

```bash
cp .env.example .env.local
```

Variables:

- `PIPELINE_API_BASE_URL`: URL du backend Python (ex: `http://127.0.0.1:8000`)
- `PIPELINE_API_TOKEN`: token API attendu par `backend_api.py`

## 3) Lancer en local

```bash
npm install
npm run dev
```

Ouvrir `http://localhost:3000`.

## 4) Deploiement Vercel

1. Importer le dossier `web` dans un projet Vercel.
2. Conserver les commandes par defaut:
   - Install: `npm install`
   - Build: `npm run build`
   - Output: `.next`
3. Ajouter dans Vercel (Project Settings > Environment Variables):
   - `PIPELINE_API_BASE_URL`
   - `PIPELINE_API_TOKEN`
4. Deployer.

Important:

- Le backend Python doit etre deploye/securise a part (service VM, Render, Railway, Fly.io, etc.).
- Le token reste cote serveur (routes Next.js `/api/*`) et n'est pas expose au navigateur.

## 5) Endpoints Next.js internes

L'app utilise des routes proxy internes:

- `POST /api/runs`
- `GET /api/runs?limit=30`
- `GET /api/runs/:runId?tail=400`
- `POST /api/runs/:runId/cancel`

Ces routes injectent automatiquement le header `x-api-token` vers le backend Python.

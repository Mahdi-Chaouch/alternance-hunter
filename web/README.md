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
- `DATABASE_URL`: URL de connexion PostgreSQL pour Better Auth
- `BETTER_AUTH_SECRET`: secret de signature/chiffrement des sessions Better Auth
- `BETTER_AUTH_URL`: URL serveur de l'app (ex: `http://localhost:3000`)
- `NEXT_PUBLIC_BETTER_AUTH_URL`: URL publique utilisee par le client Better Auth
- `GOOGLE_CLIENT_ID`: client ID OAuth Google
- `GOOGLE_CLIENT_SECRET`: client secret OAuth Google
- `AUTH_ALLOWED_EMAILS`: liste d'emails autorises (separes par des virgules) pour l'acces invite-only

Important pour Google OAuth:

- Ajouter dans la console Google le scope Gmail `https://www.googleapis.com/auth/gmail.compose`.
- Activer l'acces offline (refresh token) pour permettre la creation de brouillons sur la duree.
- Configurer les redirect URIs OAuth avec les 2 callbacks:
  - local: `http://localhost:3000/api/auth/callback/google`
  - prod: `https://<your-domain>/api/auth/callback/google`

## 2.1) Schema Better Auth (PostgreSQL)

Generer le schema SQL Better Auth:

```bash
npm run auth:generate
```

Appliquer les migrations Better Auth sur la base:

```bash
npm run auth:migrate
```

Le schema SQL genere est ecrit dans `web/db/auth-schema.sql`.

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
   - `DATABASE_URL`
   - `BETTER_AUTH_SECRET`
   - `BETTER_AUTH_URL` (ex: `https://app.example.com`)
   - `NEXT_PUBLIC_BETTER_AUTH_URL` (meme valeur publique)
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `AUTH_ALLOWED_EMAILS`
4. Deployer.

Important:

- Le backend Python doit etre deploye/securise a part (service VM, Render, Railway, Fly.io, etc.).
- Le token reste cote serveur (routes Next.js `/api/*`) et n'est pas expose au navigateur.

## 5) Hardening securite (prod)

- Generer un `BETTER_AUTH_SECRET` long et aleatoire (>= 32 bytes).
- Limiter `AUTH_ALLOWED_EMAILS` aux seules personnes autorisees (pas de wildcard).
- Faire tourner periodiquement `PIPELINE_API_TOKEN` et les credentials OAuth Google.
- Verifier que le backend Python n'est appele que par les routes server-side Next.js (jamais depuis le client).
- Controler les variables Vercel apres chaque release (pas de placeholder `change-me` en production).

## 6) Endpoints Next.js internes

L'app utilise des routes proxy internes:

- `POST /api/runs`
- `GET /api/runs?limit=30`
- `GET /api/runs/:runId?tail=400`
- `POST /api/runs/:runId/cancel`

Ces routes injectent automatiquement le header `x-api-token` vers le backend Python.

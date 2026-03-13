# Setup GitHub public/privé + Vercel

## Réponse courte

Non, **le repo complet tel quel** ne doit pas être déployé directement sur Vercel.

- La partie Next.js (`web/`) fonctionne bien sur Vercel.
- La partie backend Python (jobs longs, scraping, OAuth Gmail) doit rester sur un service séparé (VM/VPS/Render/Fly/Railway).

## Architecture recommandée

- **Repo privé (actuel)**: source complète (frontend + backend + scripts).
- **Repo public (nouveau)**: frontend uniquement (`web/`), sans secrets ni données.
- **Vercel**: connecté au repo public (ou à `web/` en root directory), avec variables d'environnement.
- **Backend Python**: free tier retenu actuellement (migration VPS prévue dès que volume/durée/fiabilité dépassent les seuils).

Voir aussi: `docs/BACKEND_HOSTING_DECISION.md` pour la matrice de choix (volume, durée, fiabilité).

## Variables Vercel (repo public)

- `PIPELINE_API_BASE_URL` -> URL publique du backend Python privé
- `PIPELINE_API_TOKEN` -> token API (uniquement côté serveur Next.js)
- `DATABASE_URL` -> PostgreSQL Better Auth
- `BETTER_AUTH_SECRET` -> secret de session Better Auth (long et aléatoire)
- `BETTER_AUTH_URL` -> URL publique de l'app (ex: `https://app.example.com`)
- `NEXT_PUBLIC_BETTER_AUTH_URL` -> URL publique côté client (même valeur)
- `GOOGLE_CLIENT_ID` -> OAuth Google
- `GOOGLE_CLIENT_SECRET` -> OAuth Google
- `AUTH_ALLOWED_EMAILS` -> allowlist invite-only (emails séparés par virgules)

## Setup rapide

1. Créer un repo GitHub public (ex: `alternance-mails-web-public`).
2. Depuis le repo privé, lancer:

```powershell
.\scripts\export-public-web.ps1 `
  -PublicRepoUrl "https://github.com/<user>/alternance-mails-web-public.git" `
  -Branch "main"
```

3. Dans Vercel, importer ce repo public.
4. Configurer OAuth Google:
   - scope Gmail: `https://www.googleapis.com/auth/gmail.compose`
   - offline access / refresh token activé
   - redirect URI production: `https://<votre-domaine>/api/auth/callback/google`
5. Ajouter les variables d'environnement listées ci-dessus.
6. Déployer.

## Ce que fait le script

- Exporte uniquement le sous-dossier `web/` avec historique Git (`git subtree split`).
- Push ce contenu vers le repo public ciblé.
- Ne publie pas le backend Python, les secrets, les exports, ni les outputs.

## Rotation de secrets

Si un token/secret a déjà été commité dans l'historique, il faut:

1. Le régénérer (rotation).
2. Nettoyer l'historique avant publication publique (filter-repo/BFG).

## Checklist sécurité avant mise en production

- Vérifier que `AUTH_ALLOWED_EMAILS` est minimal et maintenu à jour.
- Vérifier que `BETTER_AUTH_URL` et `NEXT_PUBLIC_BETTER_AUTH_URL` pointent vers le domaine HTTPS final.
- Vérifier que `PIPELINE_API_TOKEN` n'est jamais exposé côté client (uniquement routes `/api/*` server-side).
- Planifier une rotation régulière des secrets: `PIPELINE_API_TOKEN`, `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_SECRET`.
- Contrôler les redirect URIs OAuth Google (local + prod uniquement, pas de wildcard).

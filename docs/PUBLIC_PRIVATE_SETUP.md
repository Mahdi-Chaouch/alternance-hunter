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

## Setup rapide

1. Créer un repo GitHub public (ex: `alternance-mails-web-public`).
2. Depuis le repo privé, lancer:

```powershell
.\scripts\export-public-web.ps1 `
  -PublicRepoUrl "https://github.com/<user>/alternance-mails-web-public.git" `
  -Branch "main"
```

3. Dans Vercel, importer ce repo public.
4. Ajouter les variables d'environnement listées ci-dessus.
5. Déployer.

## Ce que fait le script

- Exporte uniquement le sous-dossier `web/` avec historique Git (`git subtree split`).
- Push ce contenu vers le repo public ciblé.
- Ne publie pas le backend Python, les secrets, les exports, ni les outputs.

## Rotation de secrets

Si un token/secret a déjà été commité dans l'historique, il faut:

1. Le régénérer (rotation).
2. Nettoyer l'historique avant publication publique (filter-repo/BFG).

# GitHub publication checklist (private/public)

This repository now ignores runtime data, personal files, and secrets by default.

## Before sharing

1. Copy `.env.example` to `.env` and fill values locally.
2. Put Gmail OAuth files only in `secrets/`:
   - `secrets/credentials.json`
   - `secrets/token.json`
3. Keep personal files out of Git:
   - `assets/CV.pdf`
   - generated outputs and logs
   - exported contact data

## If secrets were committed in old commits

Ignoring files prevents future leaks, but does not erase past history.

- Rotate exposed credentials/tokens first.
- Rewrite Git history before making a public repo (with `git filter-repo` or BFG).
- Re-clone after rewrite and force-push only if all collaborators agree.

## Optional pre-publish safety checks

- `git status --short`
- `git ls-files | rg -i "(\.env|credentials|token|secret|outputs/|data/exports/)"`
- `rg -i "(api[_-]?key|token|secret|password)" .`

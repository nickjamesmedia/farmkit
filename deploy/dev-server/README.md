# Farmkit dev preview server (homebrain)

Iterate without burning Netlify build minutes:

1. Make changes in the repo (work on `main` or a feature branch — no need to
   push per tweak).
2. `./dev-deploy.sh` (repo root) — builds against the **DEV** Supabase project
   ("FarmKit Dev 26", full clone of prod data + RLS as of 2026-07-06) into
   `frontend/dist-dev`, which this nginx container serves live.
3. Open http://10.0.0.148:8789 (LAN) or dev.farmkit.app once routed via
   NPM/Tailscale.

Env: `frontend/.env.devfarm.local` (gitignored) holds the dev project URL +
publishable key. Dev logins are in the usual gitignored creds file.

Ship to prod: merge/push `main` → Netlify builds once (production branch must
be set to `main` in the Netlify UI).

Container: `docker compose up -d` in this directory (name `farmkit_dev`).

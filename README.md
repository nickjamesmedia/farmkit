# Farm Kit
Low-cost, open-source farm equipment maintenance tracker for small and medium farms.

Farm Kit is a simple web app that helps farms track equipment, log maintenance, and manage users. Built to stay affordable, easy to use, and easy to host. This repo is the open-source version; farms can self-host for free or use a managed option later.

---

## Project goals
- Keep long-term costs as low as possible  
- Make setup simple for any farm  
- Support many users without per-user fees  
- Keep the app easy to maintain and extend  
- Allow farmers to self-host if they want  
- Provide a template so new farms can get running fast  

---

## Tech stack
- **React** (frontend)  
- **Supabase** (Postgres + Auth + API)  
- **Netlify / Vercel** (hosting)  
- **PWA-friendly** frontend for mobile use  

---

## Documentation
Project docs live in `farmkit\docs` (relative to the repo root):
- `farmkit\.agent`: AI agent docs (context, memory, etc)
- `farmkit\docs\dev`: developer docs
- `farmkit\docs\User`: user instructions

`farmkit\AGENTS.md` contains the core instructions for AI agents working on this project.

---

## Core features (v1)
- Admin and general user roles  
- Add/edit equipment, locations, users  
- Log maintenance tasks  
- Search and filter equipment  
- Export logs  
- Simple, mobile-friendly UI  

---

## Data model
See `docs/dev/data_model.md`.

---

## Seeding the database

- Supabase SQL editor: run `supabase/seed_sample_data.sql`
- Or `psql "$SUPABASE_DB_URL" -f supabase/seed_sample_data.sql`
- Refresh the app at `http://localhost:5173/` (logged in) to see seeded records.

## Inviting users (server-side)
- Requires service role key (never expose to frontend).
- Send an invite and upsert `app_users`:
```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx ts-node supabase/invite_user.ts user@example.com admin "First" "Last"
```
The script uses `auth.admin.inviteUserByEmail`, upserts `app_users` with the returned `auth_user_id`, and defaults role to `user` if not specified.

To wire the frontend “Send login email” button (Manage Users page):
- Provide an HTTP endpoint (e.g., Netlify/Vercel function) at `VITE_INVITE_ENDPOINT` (defaults to `/api/send-invite`).
- That endpoint must call Supabase `auth.admin.inviteUserByEmail` using the service role key and upsert `app_users` (similar to `supabase/invite_user.ts`), returning 200 on success or an error JSON: `{ "error": "message" }`.
- Do NOT expose the service role key to the browser; keep it only in your serverless function/secret store.

---

## License
AGPL-3.0 License.  
You can use, modify, self-host, or build on Farm Kit freely.

---

## Status
Early development (Alpha). Expect changes as the app takes shape.

## Release notes
- 0.0.4: First live deploy (alpha)
- 0.0.5: Equipment slug routing, quick search updates
- 0.0.6: Responsive nav polish for mobile/tablet
- 0.0.7: Locations/Buildings UI, Admin Tools + activity feed, primary “Add Log” button

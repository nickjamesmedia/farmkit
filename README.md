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
Project docs live in `docs/` and `.agent/`:
- `.agent/`: AI agent docs (context, memory, tasks, decisions)
- `docs/dev/`: developer docs
- `docs/user/`: user instructions

`AGENTS.md` contains the core instructions for AI agents working on this project.

---

## Core features (current)
- Admin/manager/user roles with farm memberships  
- Equipment, sub-farm, and building tracking  
- Maintenance logging with per-log detail page  
- User management (memberships, roles, account mode)  
- Search and filter equipment  
- Simple, mobile-friendly UI  

---

## Data model
See `docs/dev/data_model.md`.

---

## Key routes (current)
- `/dashboard`: dashboard (legacy `/app` redirects here)
- `/equipment`, `/equipment/:slug`: equipment list and detail
- `/maintenance`: maintenance dashboard
- `/maintenance/add`: add log
- `/maintenance/log/:id`: log detail/edit
- `/account`: account settings
- `/farm`: read-only farm info
- `/admin/farm`: farm setup (admin)
- `/sub-farms`, `/buildings`: sub-farm/building lists (legacy `/locations` redirects)

---

## Seeding the database

- Supabase SQL editor: run `supabase/seed_v0_1_demo.sql`
- Or `psql "$SUPABASE_DB_URL" -f supabase/seed_v0_1_demo.sql`
- Refresh the app at `http://localhost:5173/` (logged in) to see seeded records.

## Inviting users (server-side)
- Requires Supabase migration `0004_team_invites.sql` and Edge Function `invite-team-member`.
- Farm admins invite users from `/team` by email, role, account mode, and optional display name.
- The browser calls the Edge Function; the service-role key stays server-side only.
- The Edge Function validates the caller's JWT, checks Admin role for the target farm, sends the Supabase Auth invite email, and writes `user_profiles`, `farm_memberships`, and `farm_team_invites`.
- Invite links should redirect to `/welcome`, where invitees set a password and activate their invited memberships.

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

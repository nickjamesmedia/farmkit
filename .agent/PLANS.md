#.agent/PLANS.md

# Plans

## Active plan: Team page + secure invites
**Status:** In progress
**Owner:** Codex
**Started:** 2026-07-03

### Goal
Merge "People" and "Manage Users" into one farm-admin-friendly Team page, remove raw auth-user-id from the normal workflow, and add a secure Supabase-backed invite path for farm admins.

### Non-goals
- Full enterprise identity management, SSO, MFA management, or password-reset administration.
- Custom branded invite emails; use Supabase Auth invite emails first.
- Changing the existing role model or weakening RLS as the access-control boundary.

### Assumptions
- `farm_memberships`, `people`, `roles`, and `user_profiles` remain the canonical v0.1 membership model.
- Farm admins can manage account access; managers can manage the "Person who did the work" list but cannot invite or change login access.
- A Supabase Edge Function can use the service-role key server-side after validating the caller's JWT and farm-admin role.

### Work items (ordered)
1) Add a SQL migration/RPC that lets farm admins list team members with email addresses without exposing raw `auth.users` access to the client.
2) Add a Supabase Edge Function that validates the caller, sends a Supabase invite email, and writes `user_profiles`/`farm_memberships` safely.
3) Replace separate Users/People navigation with one Team page while keeping old routes redirected for compatibility.
4) Add invite/set-password handling for invitees and keep auth-user-id visible only in an advanced/support disclosure.
5) Build and update `.agent/` status notes.

### Acceptance criteria
- `/team` is the primary page for people + account access.
- Admins can invite a user by email with role/account mode/display name; the browser never handles a service-role key.
- Team members are listed by name/email/role/status instead of requiring raw auth user IDs.
- People without login can still be added/removed/restored for maintenance-log attribution.
- `/users` and `/people` do not remain separate primary destinations.

### Validation
- Run `npm run build` in `frontend/`.
- Review SQL/Edge Function paths for rollback/deploy notes.
- 2026-07-04 verification: `git diff --check` passes; `npm --prefix frontend run build` passes; changed-file ESLint passes from `frontend/`; deployed function CORS preflight returns `200 ok`; unauthenticated POST returns `401 UNAUTHORIZED_NO_AUTH_HEADER`.

### Progress notes
- 2026-07-04: After Supabase/Netlify plugin install, Supabase tools still do not expose Edge Function secret management or Auth redirect URL configuration. Supabase CLI remains unauthenticated (`Access token not provided`). Netlify plugin can access site `farmkit-njmit` (`485352af-9661-47c1-8ff8-5a2b5fed7f1f`); public Vite Supabase build env vars were upserted for Netlify builds. Netlify MCP source upload/deploy command failed with `500 Internal Server Error` after repeated upload progress; a second attempt from a clean temp source copy without `node_modules`, `dist`, `.netlify`, or env files also stalled in upload and was interrupted. Production remained on deploy `6a486073c4045c0dadc05c39`.
- 2026-07-04: Supabase MCP tools were available in the follow-up Codex session. Applied production migration `team_invites` to project `rjhffpxijysfuusriqwg`; verified `farm_team_invites`, invite email columns, and Team invite RPCs exist. Deployed Edge Function `invite-team-member` version 1 with `verify_jwt=true`; unauthenticated POST returns `401 UNAUTHORIZED_NO_AUTH_HEADER`. Remaining backend config is setting Edge Function secret `FARMKIT_INVITE_REDIRECT_URL=https://farmkit.app/welcome` and confirming Supabase Auth redirect allow-list includes `https://farmkit.app/welcome`; this connector does not expose secret/Auth config write tools, and local CLI auth is not present.
- 2026-07-04: New Codex session tried Supabase tool discovery twice; no callable Supabase MCP tools were exposed. `npx supabase@latest` is available, but CLI deploy is blocked by missing `SUPABASE_ACCESS_TOKEN`/CLI login. Project ref was confirmed from the frontend Supabase URL. Local validation still passes: frontend build, changed-file lint, and `git diff --check`.
- 2026-07-03: Implemented locally. Frontend build passes; changed-file lint passes. Full lint still has pre-existing errors outside this change set. Supabase migration/function deployment and live invite smoke test remain pending because no Supabase CLI/connector is available in this host session.

---

## Backlog plans (inactive)
_Add new plans here when needed. Keep only one Active plan at a time._

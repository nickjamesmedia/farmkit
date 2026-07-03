# Backlog (Plan Queue)

Track **multiple potential plans** at once without breaking the rule that there is **only one Active plan** in `.agent/PLANS.md`.

## How to use this file
- Add new ideas to the **Plan Queue** table and create a **Plan Brief** section below.
- "Shape" a plan here until it's **Ready** (goal + non-goals + acceptance criteria are clear).
- When starting work, **promote** the plan into `.agent/PLANS.md` as the single Active plan and update the queue entry here to point at it (do not delete the backlog entry).

## Conventions
- **Plan IDs:** `P-YYYYMMDD-###` (example: `P-20260202-001`)
- **Statuses:**
  - `idea` -> raw capture, not shaped
  - `shaping` -> being clarified (assumptions/non-goals open)
  - `ready` -> can be promoted to Active
  - `next` -> preferred next-up when current plan completes
  - `blocked` -> waiting on a dependency/decision
  - `parked` -> intentionally paused; revisit later
  - `promoted` -> moved into `.agent/PLANS.md` (link the section)
  - `done` -> finished; keep brief for history

---

## Current
- **Active plan:** See `.agent/PLANS.md`
- **Next candidates:** (fill from queue)
  - `P-20260202-001` - Hostname-based multi-tenant routing (subdomain-first)
  - `P-20260202-002` - Users page revamp + secure email invites (user management foundation)

---

## Plan Queue (index)

| ID | Status | Priority | Title | Target | Owner | Notes / Link |
|---|---|---|---|---|---|---|
| P-20260202-001 | shaping | P0 | Hostname-based multi-tenant routing (subdomain-first) | v0.1 beta prerequisite | Codex + Human | See brief below |
| P-20260202-002 | shaping | P0 | Users page revamp + secure email invites | v0.1 beta prerequisite | Codex + Human | See brief below |
| P-________-___ | idea | P? | __________________________________ | v? | ______ | (link to brief section below) |

**Priority key (suggested):** `P0` now / `P1` next / `P2` later / `P3` maybe

---

## Plan Briefs (details)

### P-20260202-002 - Users page revamp + secure email invites
**Status:** shaping  
**Owner:** Codex + Human  
**Target (version/milestone):** v0.1 beta prerequisite (onboarding + admin usability)  
**Created:** 2026-02-02  
**Last updated:** 2026-02-02  

**Problem / Why now**
- `/users` is currently not usable for a non-technical farm admin (requires "Auth user ID", unclear statuses, no invite workflow).
- v0.1 beta onboarding requires a secure, repeatable way to invite farm staff by email and manage roles/access without leaking security boundaries into the UI (RLS stays the boundary).

**Goal**
- Make `/users` a real user management screen for farm admins:
  - Invite users by email (with role + access scope) and track invite status.
  - View and manage existing users with farmer-friendly labels (name/email), not raw `auth_user_id`.
  - Provide safe actions: resend invite, disable/suspend, remove access, and (optionally) delete membership.
- Add an invite mechanism that is hard to abuse:
  - Admin-only (enforced in RLS and in the invite backend).
  - Rate-limited + audited (per inviter + per farm + per email).
  - No service-role keys in the client.

**Non-goals**
- Full "enterprise IAM" (SCIM, SSO, org charts, etc).
- Designing a new roles/permissions model; use existing `roles` and `farm_memberships` as-is.
- Using UI filtering as access control (RLS remains the source of truth).
- Building multi-tenant hostname routing (covered by `P-20260202-001`).

**Assumptions**
- Supabase Auth is the auth provider, and farm admins cannot call `supabase.auth.admin.*` from the client.
- Current membership model is canonical: `public.farm_memberships` + `public.roles` + `public.user_profiles`. (`supabase/schema.sql`)
- `/users` is an admin-only route already (see `frontend/src/App.tsx`).

**Scope (in)**
- UX: Replace "Auth user ID" as the primary identifier with email + display name.
  - Keep `auth_user_id` available behind an "Advanced" disclosure for debugging/support.
- Invites:
  - Provide an admin-only "Invite user" form (email, role, account mode, optional display name).
  - Backend mechanism to send an email invite and create/update app rows (`user_profiles`, `farm_memberships`).
  - "Resend invite" with cooldown.
  - "Revoke invite" (disable membership / mark invite revoked) before acceptance.
- Abuse prevention:
  - Rate limits (e.g., per inviter per hour/day; per target email per day; per farm per day).
  - Audit trail for who invited/rescinded and when.

**Scope (out)**
- Password reset flows and MFA management (leave to Supabase Auth UX for v0.1).
- Self-service user join requests (invite-only for v0.1).
- Perfect branding of invite emails (ok to ship with Supabase default templates first).

**Required decisions (open)**
- Invite scope defaults:
  - Invite to the parent farm only vs invite to one or more child farm locations.
  - If inviting to child farms, should membership be created only for selected farms or also for parent metadata access?
- Email identity storage:
  - Add `user_profiles.email` (and populate it) vs add `farm_memberships.invited_email` for display/audit.
- Email delivery approach:
  - Use Supabase Auth invite emails (fastest) vs custom invites via an email provider (more control).

**Implementation tasks (step-by-step)**
1) Data model + audit (minimal)
   - Decide whether we need a dedicated `farm_invites` table (recommended for rate limiting + audit + resend), or whether `farm_memberships.status='invited'` is sufficient for v0.1.
   - If adding a table, include: `farm_id`, `email`, `role_id`, `account_mode`, `created_by_auth_user_id`, `created_at`, `last_sent_at`, `revoked_at`, `accepted_at`, `status`, and basic uniqueness constraints.
2) Secure invite backend (no client secrets)
   - Implement an admin-only backend path to send invites:
     - Preferred: Supabase Edge Function that validates the caller's JWT and checks they are an Admin for the target farm, then calls `supabase.auth.admin.inviteUserByEmail(...)` and writes the membership rows.
     - Include rate limiting checks before sending email.
   - Replace/retire `supabase/invite_user.ts` (currently upserts legacy `app_users`) or update it to the v0.1 tables as a dev-only helper.
3) `/users` UX redesign (no theme redesign)
   - Update `frontend/src/pages/ManageUsers.tsx` to:
     - List users by display name + email, role, status, last seen, account mode, and access scope (farms/locations).
     - Provide actions: edit role, disable/enable, resend/revoke invite, remove access.
     - Hide `auth_user_id` behind "Advanced".
   - Ensure all writes go through RLS-safe paths (direct table writes where safe; invite flow via backend).
4) Validation
   - Manual test with at least: parent-farm admin, manager, standard user.
   - Verify abuse prevention: rate limits trigger, resend cooldown, audit records created.
   - Verify RLS: non-admin cannot list users or send invites even if they call the function directly.

**Dependencies**
- Confirmation of v0.1 membership + RLS write policies for `farm_memberships` (admin-only).
- Decision on where invites live (Supabase edge function vs another server surface).

**Risks / edge cases**
- Email visibility: Supabase does not expose other users' emails to clients by default; we must store email in an app table if the UI needs it.
- Inviting an email that already exists in Supabase Auth: backend must handle "already registered" and still grant membership safely (no duplicate invites/spam).
- Open redirect and link safety if we generate invite links manually (validate return URLs/domains).

**Acceptance criteria**
- A farm Admin can invite a user by email from `/users` without needing an Auth User ID.
- Invited users show up in the list with status "Invited" and can be resent/revoked safely.
- Existing users are shown with farmer-friendly fields (name/email), and admin can change role and disable access.
- Invite flow cannot be abused by non-admins; rate limiting is in place; all actions are auditable.

**Validation approach**
- Manual: exercise invite/resend/revoke and confirm correct rows in `farm_memberships` (and invite/audit table if added).
- Manual: confirm non-admin access blocked by RLS and backend checks.

**Notes / links**
- Current `/users` page: `frontend/src/pages/ManageUsers.tsx`
- Current routing guard: `frontend/src/App.tsx`
- Schema tables: `supabase/schema.sql` (`roles`, `user_profiles`, `farm_memberships`)
- Existing dev invite helper (legacy): `supabase/invite_user.ts`

### P-20260202-001 - Hostname-based multi-tenant routing (subdomain-first)
**Status:** shaping  
**Owner:** Codex + Human  
**Target (version/milestone):** v0.1 beta prerequisite (managed hosting)  
**Created:** 2026-02-02  
**Last updated:** 2026-02-02  

**Problem / Why now**
- v0.1 beta launch requires tenant isolation and routing based on hostname so each farm can use `https://{farmSlug}.farmkit.app/*`.
- We also want the data model and auth flow to be ready for near-future custom domains `https://{customer-domain}/*` without redoing core routing.

**Goal**
- Canonical tenant URL: `https://{farmSlug}.farmkit.app/*` where `{farmSlug}` matches `public.farms.slug`.
- Resolve tenant by `window.location.hostname` (not by URL path).
- Keep security boundaries unchanged: all reads/writes remain enforced by existing farm-scoped tables + `farm_id` columns + `farm_memberships` + current Supabase RLS.
- Be future-ready for verified custom domains per farm with minimal extra work later.

**Non-goals**
- Path-based tenant aliases, path redirects, or legacy URL support (we have not launched yet).
- Redesigning farm-scoped RLS from scratch (only minimal additions for domain mapping / resolution).
- Building a full automated custom-domain verification and onboarding pipeline in v0.1 (design for it; implement the smallest v1 UX).

**Assumptions**
- Frontend is React + Vite + TS (`frontend/`).
- Backend is Supabase Postgres + Auth; current RLS policies are in `supabase/rls_policies_dev.sql`.
- Existing schema includes `public.farms.slug` and all farm-scoped tables include `farm_id` enforced by RLS.
- Managed hosting will serve one SPA for many hosts (wildcard subdomains).

**Scope (in)**
- DNS + domain records for `farmkit.app` and `*.farmkit.app` (GoDaddy).
- Hosting edge configuration to accept wildcard subdomains and route all hosts to the same SPA.
- Frontend tenant resolution by hostname and wiring tenant `farm_id` into the existing app context.
- Add a small domain mapping table + helper RPC for hostname -> `farm_id`.
- Auth redirect strategy that works for many tenant hosts now, and does not block custom domains later.
- Minimal admin UX to view/request domains.

**Scope (out)**
- Any non-managed-hosting self-host guidance beyond documenting required DNS/host behavior.
- Per-tenant path routing (e.g. `/t/{farmSlug}`) or redirects.
- Any security decisions based on hostname (hostname is context only).

**Required decisions (recommendations)**
- Wildcard DNS: require `*.farmkit.app` as a must-have for canonical subdomain routing (recommended: yes).
  - Reason: it makes every `{farmSlug}.farmkit.app` resolvable without per-tenant DNS and keeps onboarding trivial.
- Auth callback host: use a single callback origin `https://auth.farmkit.app/auth/callback` (recommended: yes).
  - Reason: scales without needing to register every tenant host (and later, every custom domain) as an auth redirect URL.

**Implementation tasks (step-by-step)**

#### DNS / domain setup (GoDaddy)
1) Decide hosting provider for the SPA edge (Vercel or Netlify; both are already configured in `frontend/`).
2) In GoDaddy DNS:
   - Apex `farmkit.app`: use the provider-recommended `A` (or `ALIAS/ANAME` if supported by DNS provider) record(s).
   - Wildcard subdomain: create `CNAME` for `*` (i.e., `*.farmkit.app`) pointing to the provider's domain target.
   - Add explicit `CNAME` for `auth.farmkit.app` pointing to the same provider target (even if wildcard exists, keep it explicit for clarity).
   - Future (custom domains): customer domain uses `CNAME` to the managed hosting target plus a `TXT` verification record (example: `_farmkit-verification` -> `{token}`) to prove control before activation.
3) Reserve/avoid tenant slugs that collide with infrastructure subdomains (at minimum: `www`, `auth`, `api`, `admin`, `static`).

#### Hosting edge setup
1) Configure the host to accept:
   - `farmkit.app` (optional marketing/landing later; for now it can serve the SPA)
   - `auth.farmkit.app` (auth callback + login entry)
   - `*.farmkit.app` wildcard (all tenant hosts)
2) Ensure SPA fallback rewrites apply for every hostname (already present via `frontend/vercel.json` and `frontend/netlify.toml`).
3) Ensure HTTPS + valid TLS certificates for wildcard + auth host (provider-managed).
4) Confirm caching/CDN behavior is safe for multi-host (do not cache personalized HTML across hosts; default SPA hosting is usually fine).

#### Frontend routing + tenant resolution (React + Vite + TS)
1) Add a tenant resolution module that:
   - reads `hostname = window.location.hostname.toLowerCase()`
   - resolves `farm_id` via `farm_domains` (see DB section) before loading farm-scoped data
2) Replace "default farm" selection logic with hostname-first behavior:
   - If hostname matches a known tenant: set `activeFarmId` to that farm.
   - If hostname is `localhost` (or a non-tenant dev host): fall back to the existing default-farm logic or show a farm picker.
3) Unknown host handling:
   - Dev: show a helpful error plus a farm picker (do not auto-guess).
   - Prod: show a 404-ish "Unknown farm domain" screen (no redirects).
4) Vite dev host support:
   - Update Vite dev server config to allow `*.localhost` hosts (so `farmSlug.localhost:5173` works).
5) Audit all Supabase queries to ensure they remain farm-scoped by `farm_id` (RLS remains the enforcement).

#### Supabase schema + RLS changes (minimal)
1) Add `public.farm_domains` (recommended) to map `hostname -> farm_id`:
   - Columns (suggested):
     - `id uuid pk default gen_random_uuid()`
     - `farm_id uuid not null references public.farms(id) on delete cascade`
     - `hostname text not null` (store lowercase)
     - `domain_type text not null` check in (`canonical`, `custom`)
     - `status text not null` check in (`active`, `pending`, `disabled`)
     - `is_primary boolean not null default false`
     - `verification_token text` (for future custom-domain verification)
     - `verified_at timestamptz` (null until verified for `custom`)
     - `created_at timestamptz not null default now()`, `created_by_auth_user_id uuid references auth.users(id) on delete set null`
   - Constraints/indexes:
     - unique on `hostname` (case-insensitive via lowercasing-at-write)
     - index on `farm_id`
2) Keep canonical domains in sync:
   - Backfill: insert `{slug}.farmkit.app` canonical host rows for all existing farms.
   - Add trigger(s) on `public.farms` insert + slug update to upsert the canonical `farm_domains` row.
3) Add a small RPC for runtime resolution:
   - `public.farmkit_resolve_farm_id_for_hostname(hostname text)` -> returns `farm_id uuid` (and optionally `farm_slug`/`farm_name` for login branding).
   - Make it `security definer` and grant execute to `anon` + `authenticated` so the frontend can resolve without exposing a full domain list.
4) RLS impact:
   - No changes expected to existing farm-scoped table policies (they are enforced by `farm_id` + membership).
   - Add RLS policies only for `farm_domains` management (admin-only insert/update/delete; select admin-only or farm-member-only depending on UX needs).

**Why not reuse `farm_details.app_url` for routing? (pros/cons)**
- Pros:
  - Already exists and is editable in the current admin UI (`Farm Setup`).
- Cons (why `farm_domains` is still recommended):
  - Only supports one URL per farm; cannot represent multiple domains (canonical + custom + future aliases).
  - No place for verification status, tokens, history, or "primary" selection.
  - Couples routing and branding/contact settings in a single row, making future custom-domain onboarding messier.

#### Auth / redirect strategy (scales to many hosts + future custom domains)
1) Use one auth callback origin: `auth.farmkit.app` (single redirect URL allowlist entry in Supabase Auth).
2) Canonical subdomains (`*.farmkit.app`) session strategy (MVP-friendly):
   - Store auth session in a cookie with `Domain=.farmkit.app` so all tenant subdomains can read the same session (no per-tenant re-login).
   - Keep the tenant host as context only; queries remain scoped by `farm_id` and enforced by RLS.
3) Redirect return target safety:
   - Callback page accepts `returnHost` + `returnPath` and validates:
     - allow `*.farmkit.app` (excluding reserved infra subdomains), and
     - later, allow custom domains only if `farm_domains.status=active` and `verified_at is not null`.
   - If invalid, fall back to `farmkit.app` with an error message (no open redirects).
4) Future custom domain support (design now, implement later):
   - If cookie sharing is not possible across custom domains, use the same callback host and add a one-time handoff mechanism (short-lived exchange code) to set session on the custom domain without exposing long-lived tokens.

#### Admin UX for managing tenant domains (minimal v1)
1) Add a "Domains" section to the existing admin farm settings screen:
   - Show canonical domain (read-only): `{slug}.farmkit.app`.
   - Allow requesting one custom domain (create `farm_domains` row with `domain_type=custom`, `status=pending`, `verification_token` generated).
   - Show DNS instructions (CNAME + TXT) and current status (pending/active/disabled).
2) Keep "verification" manual for v0.1:
   - Farmkit operator confirms DNS + adds the domain to the hosting provider + flips `status=active` and sets `verified_at`.

#### Test plan + rollout checklist
1) Local dev tests:
   - Confirm Vite serves on `http://{farmSlug}.localhost:5173` after allowing hosts.
   - Confirm tenant resolution sets the expected `farm_id` and all farm-scoped queries stay within that farm.
   - Confirm a user who is not a member of a farm cannot read/write that farm's data even if they change the hostname (RLS check).
2) Managed hosting smoke tests:
   - Confirm wildcard DNS resolves and TLS is valid for multiple subdomains.
   - Confirm `auth.farmkit.app` callback works and returns to the originating tenant host.
3) Supabase auth config checklist:
   - Add `https://auth.farmkit.app/auth/callback` (and local dev callback) to allowed redirect URLs.
   - Confirm Site URL and any "additional redirect URLs" do not require enumerating tenant hosts.
4) Rollout steps (first staging, then prod):
   - Deploy SPA with host-based tenant resolution behind a staging domain first (if available).
   - Add wildcard DNS + domain aliases at the host.
   - Backfill canonical `farm_domains` rows and verify resolution RPC works for a known farm slug.
   - Manual test with at least: admin user, manager user, shared account, and a user with memberships in two farms.

**Dependencies**
- Choose hosting provider for managed hosting edge (Vercel vs Netlify).
- Confirm Supabase Auth redirect allowlist behavior and the desired OAuth providers for beta.
- Decide which subdomains are reserved and enforce slug validation accordingly.

**Risks / edge cases**
- Hostname spoofing: treat hostname as context only; never rely on it for access control (RLS remains the boundary).
- Vite dev server blocks unknown hosts by default; must allow `*.localhost` to test subdomains locally.
- Slug changes: ensure canonical domain rows stay in sync if `farms.slug` changes.
- Custom domains: verification and avoiding open redirects must be designed before enabling.

**Acceptance criteria**
- Visiting `https://{farmSlug}.farmkit.app/*` always resolves to the correct `farm_id` based on hostname (no path-based tenant selection).
- A logged-in user cannot read/write cross-farm data even if they change hostnames (RLS enforcement remains correct).
- Unknown host behavior is defined and implemented (dev vs prod).
- Auth redirect strategy does not require enumerating every tenant host and does not block future custom domains.
- `farm_domains` (or equivalent) exists with a clear path to custom domain verification later.

**Validation approach**
- Manual: local dev multi-host tests (`*.localhost`) + RLS audit page checks.
- Manual: staging/preview deployment with at least two farm slugs and two user accounts to confirm isolation.

**Notes / links**
- Current schema reference: `supabase/schema.sql` (contains `public.farms.slug`, `public.farm_memberships`, and farm-scoped `farm_id` tables).
- Current RLS reference: `supabase/rls_policies_dev.sql` (farm access is enforced by membership + `farm_id`).

### P-________-___ - ________________________________
**Status:** idea | shaping | ready | next | blocked | parked | promoted | done  
**Owner:** ________  
**Target (version/milestone):** v?  
**Created:** YYYY-MM-DD  
**Last updated:** YYYY-MM-DD  

**Problem / Why now**
- 

**Goal**
- 

**Non-goals**
- 

**Assumptions**
- 

**Scope (in)**
- 

**Scope (out)**
- 

**Dependencies**
- 

**Risks / edge cases**
- 

**Acceptance criteria**
- 

**Validation approach**
- 

**Notes / links**
- 

---

## Parking lot / open questions (append-only)
> Add newest items at the top.

- YYYY-MM-DD: ________________________________________________

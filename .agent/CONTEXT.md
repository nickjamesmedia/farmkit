#.agent/CONTEXT.md

# Farmkit — Context

## Current
- **Status:** Alpha prototype (current release: **v0.0.8**) with working UI/features, but early code quality varies due to fast iteration.
- **Project:** **Farm Kit / Farmkit** — a low-cost, open-source farm equipment maintenance tracker for small and medium farms.
- **Primary near-term target:** **v0.1.0 Beta** launch with an initial tester farm partner.
- **Core beta use case:** **Equipment + Buildings + Maintenance tracking**.

---

## What Farmkit is
Farmkit is a simple web app that helps farms:
- Track equipment and related details (location, status, metadata)
- Log maintenance work and history
- Manage users and roles
- Search/filter and export logs
- Use the app comfortably on mobile (PWA-friendly UI)

Farmkit is intended to stay **affordable**, **easy to host**, and **easy to extend**. The open-source repo supports **self-hosting**, with a possible managed option later.

---

## Who it’s for
- Small and medium farms that want a straightforward maintenance tracker
- Farms that may have:
  - Multiple operators
  - Shared devices (e.g., shop tablet / break-room computer)
  - A desire to avoid per-user pricing and complex software

Example farm profiles being considered include grain operations, mixed farms (grain + cattle), dairy, and storage-heavy workflows.

---

## Product shape and scope boundaries

### Farm structure (important)
Farmkit supports a **primary farm account (HQ/parent)** with **one or more farm locations** nested under it.

- The **primary farm** is the “top-level” account used for billing/ownership/admin and overall management.
- A **farm** represents a **single farm location** (a real-world place/site).
- If a customer has multiple locations, each location is a **child farm** linked to the primary farm.
- Users, permissions, and modules are managed from the **primary farm**, but data (equipment/buildings/logs) can be scoped to a specific farm location as needed.

This nested model is part of core product intent (not experimental).

### Core modules (ship by default)
For v0.1.0 beta, the “core” set is:
- **Equipment**
- **Buildings / Locations**
- **Maintenance logs**

### Modular design (directional)
Farmkit aims to be **modular per primary farm account**:
- Core modules: on by default
- Optional modules: can be enabled/disabled per primary farm
- Future: community modules and integrations (not required for v0.x)

**Admin UX requirement:** admins can enable/disable modules via settings (as this becomes real, it should be implemented without forcing unused features into every farm).

### Account types (directional)
Farmkit must support both:
- **Personal accounts** (email-based auth)
- **Shared accounts** (shared login patterns; still needs attribution)

**Key rule:** maintenance logs must capture a **person name** even when using shared accounts.

---

## Admin and permissions expectations (beta-critical)
Admin needs to be able to do core operations entirely from the UI:
- Primary farm settings & setup
- Add/manage farm locations (child farms)
- Manage farm access
- Manage users (add/edit/remove)
- Module toggles (as they come online)
- “Danger Zone” actions where destructive operations are explicit and separate

User removal should support:
- **Suspend** (temporary)
- **Delete user but keep logs** (default behavior)
- **Delete user and purge entries** (explicit, separate, harder-to-do path)

---

## Roles and security (current)
Initial roles are:
- **Admin:** full access to settings, users, and all modules
- **Manager:** operational management within assigned scope; limited admin tools
- **User:** standard day-to-day access (personal or shared accounts)

The v0.0.7 prototype relied on UI-level role filtering; Phase 0 removes that and RLS will replace it.

**Future-friendly note:** expect more roles later or admin-defined custom roles; avoid hardcoding assumptions that block this.

---

## Tech stack (current direction)
- **Frontend:** React
- **Backend:** Supabase (Postgres + Auth + API)
- **Hosting:** Netlify or Vercel (or similar)
- **UX:** Mobile-friendly, PWA-friendly frontend

This context describes the intended stack as currently planned; if the repo diverges, document the reality and update this file.

---

## Roadmap (directional; not a commitment)
- **v0.1.0:** Beta launch foundation + core modules + primary/child farm structure + admin UX usable end-to-end
- **v0.2:** Containers / Storage / light inventory
- **v0.3:** Fields / Crops / Irrigation
- **v0.4:** Livestock
- **v0.5:** Map tools (lite)
- **v0.6:** Reporting / import-export
- **v0.7:** Notifications / tasks / reminders
- **v0.8:** Simple assistant features
- **v1.0:** Full release
- **v2.0:** Integrations

---

## Non-goals (for now)
These items may be interesting later, but are explicitly **out of scope** unless the human promotes them into the active plan:

- Enterprise asset management parity (complex scheduling, full CMMS workflows)
- Deep accounting, invoicing, payroll, or farm financial management
- Real-time machine telemetry/sensor ingestion as a baseline requirement
- Complex GIS mapping or precision-ag toolchains as a prerequisite for core value
- Perfectly generalized “universal entity” abstraction across all future modules
- Multi-tenant enterprise org hierarchies and delegated admin trees (beyond primary farm + child farm locations)

---

## Working assumptions (subject to change)
- The v0.0.7 prototype behavior is treated as **reference**, but not as “correct by default.”
- Beta success is defined by **real farm usage** more than architectural purity.
- Simple, obvious UX beats advanced features early (especially on mobile).
- Supabase remains the backend for v0.x unless explicitly changed.
- We will prefer **incremental refactors** over rewrites:
  - isolate and stabilize modules
  - introduce naming conventions and patterns gradually
  - add tests/validation only where they pay off immediately
- The repo will converge toward “self-host friendly defaults” and low operational burden.

---

## Versioning (SemVer)
- Current alpha release is **v0.0.8**.
- Next alpha patch will be **v0.0.9** once current tasks are complete.
- Pre-1.0 work follows SemVer (`MAJOR.MINOR.PATCH`) with optional `-alpha.N` / `-beta.N` tags.

---

## Repo inventory (current)
**Top-level map**
- `.agent/`: workflow docs (plans, tasks, decisions, constraints, review checklist)
- `agents/skills/`: local Codex skills for repo workflows
- `docs/`: dev + user docs (`docs/dev`, `docs/user`)
- `frontend/`: React app (Vite)
- `supabase/`: schema + seed SQL and a helper script

**Entry points**
- `frontend/src/main.tsx`: frontend bootstrap
- `frontend/src/App.tsx`: app shell + routes
- `frontend/index.html`: Vite HTML entry
- `supabase/schema.sql`: database schema
- `supabase/invite_user.ts`: user invite helper
- `supabase/seed_sample_data.sql`: seed data

**Hot zones (frequent edits)**
- `frontend/src/pages/`: page-level UI + flows
- `frontend/src/components/`: shared UI pieces
- `frontend/src/lib/supabaseClient.ts`: data access client

**Risk zones (auth/data/permissions)**
- `supabase/schema.sql`: data model + constraints
- `frontend/src/lib/supabaseClient.ts`: auth + data access wiring
- `frontend/src/pages/ManageUsers.tsx`: user management UI

---

## Notes (append-only)
> Add new notes at the top of this section. Do not delete old notes.

- 2026-02-01: Clarified module model: modules are configured at the parent farm and inherited by child farms; new modules are disabled by default when introduced for existing farms; modules can be nested (e.g., Containers -> Buildings, Storage & Bins). Disabling a module should hide its data (via RLS) and related UI elements without breaking other modules.

- 2026-02-01: Clarified farm hierarchy: two levels only for now (parent farm + child farms; no child-of-child). ERP (emergency response planning) info is intended to be broadly visible to users for any farm location they work at, including parent ERP info when a user is only a member of a child farm.

- 2026-02-01: Post-v0.1 beta (v0.2 direction): add Fields module (fields nested under Locations per farm), add Livestock module, expand Buildings surfacing under Locations for nested farms, and add Storage & Bins module built on the Containers table family.

- 2026-01-18: Initial RLS policies drafted and reported working in the dev environment.

- 2026-01-18: Local repo path is now `H:\_NJM\Clients\farmkit\farmkit_app`, tied to `https://github.com/nickjamesmedia/farmkit`; prior local path `G:\Dev\farmkit` is being removed.


- 2026-01-13: Dev server: run `npm run dev` from `frontend/`; app is served at `http://localhost:5173` (corrected date).

- 2026-01-12: Dev server: run `npm run dev` from `frontend/`; app is served at `http://localhost:5173`.

- 2026-01-11: Added local skill `archive-plans` under `agents/skills/` to standardize plan archiving.

- 2026-01-03: Bumped current alpha to v0.0.8 as the post-prototype clean start.

- 2026-01-03: Documented SemVer usage and marked v0.0.7 as the prototype epoch (now v0.0.8).

- 2026-01-03: Noted that v0.0.7 used UI-level role filtering; Phase 0 removed UI gating and RLS must enforce access control.

- 2026-01-03: Added Roles and security section with initial Admin/Manager/User roles and future custom-role expectation.
- 2026-01-03: Added [Repo inventory](#repo-inventory) section with top-level map, entry points, and risk zones.
- 2026-01-03: Removed internal tester farm name from public context; refer to “initial tester farm partner” instead.
- 2026-01-03: Split former v0.5 comma-delimited roadmap items into separate versions (v0.5–v0.8).
- 2026-01-03: Clarified farm hierarchy model: primary farm (HQ/parent) with nested child farm locations; this is core product intent (not experimental).
- 2026-01-03: Added Non-goals, Working assumptions, and append-only Notes section to match repo workflow expectations.
- 2026-01-02: Initial planning notes emphasize modular modules, shared-account attribution, and admin “danger zone” patterns.
- 2026-01-??: Prototype reached v0.0.7 with working flows but inconsistent structure due to rapid iteration.

---

## Sources for this context
- README and project overview notes
- 2026-01-02 planning/dev log cleanup notes

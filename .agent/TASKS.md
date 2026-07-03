#.agent/TASKS.md



# Tasks



## Current (ordered)

- [ ] **Add DB-level admin child-farm enrollment** (schema helper + triggers + backfill; ensure revocation on demotion/removal)

- [ ] **Apply v0.1 schema + dev RLS in Supabase** (`supabase/schema.sql`, `supabase/rls_policies_dev.sql`) and run ERP data migration if needed

- [ ] **Manual verification pass (v0.1 beta readiness)** (parent admin, child user, shared account; module toggles + ERP visibility)

- [ ] **Frontend cleanup + manual testing pass** (post-deploy wiring)

- [ ] **Define v0.1 beta page list + IA** (target screens, flows, and nav)

- [ ] **Revise v0.1 beta data model** (tables, relationships, and schema deltas)



- [ ] **Plan: hostname-based multi-tenant routing (subdomain-first)** (`P-20260202-001`, required before v0.1 beta launch)

- [ ] **Plan: Users page revamp + secure email invites** (`P-20260202-002`, v0.1 beta prerequisite)

## Done

- [x] **Archive active plan and reset PLANS template** (2026-02-08)

- [x] **Create `create-backlog-plan` agent skill** (2026-02-02)

- [x] **Add `.agent/BACKLOG.md` template for multi-plan tracking** (2026-02-02)

- [x] **Add Quick Links section (portable) + rename `/app` to `/dashboard`** (2026-02-01)

- [x] **Finalize v0.1 module model + inheritance** (parent-configured modules, nested Containers submodules, ERP visibility, two-level farm hierarchy) (2026-02-01)

- [x] **Decide on maintenance log audit columns** (added `maintenance_logs.updated_by_auth_user_id` to schema) (2026-02-01)

- [x] **Define and implement dev RLS policies** (`supabase/rls_policies_dev.sql`) (2026-02-01)

- [x] **Archive active plan and reset PLANS template** (2026-01-31)

- [x] **Wire v0.1 schema to current frontend pages** (update data access to new tables)

- [x] **Update README with current routes and features**

- [x] **Add read-only Farm Info page and update /farm routing**

- [x] **Update nav order and farm links**

- [x] **Share nav profile + farm data via context to stop placeholder flashes**

- [x] **Align Equipment header and Add button inline**

- [x] **Archive active plan and reset PLANS template** (2026-01-19)

- [x] **Add maintenance log actions on equipment detail page**

- [x] **Make modals scrollable on small screens**

- [x] **Skip equipment list modal and go to equipment detail**

- [x] **Rename Home nav button to Dashboard**

- [x] **Link equipment on maintenance log detail page**

- [x] **Add maintenance log detail page and wire edit/delete actions**

- [x] **Make Account page read-only for shared accounts**

- [x] **Always show Person selector on Add Maintenance Log**

- [x] **Default personal maintenance logs to the user's person record**

- [x] **Rename Recent Maintenance Logs heading on Home**

- [x] **Initial dev RLS policies reported working in dev environment**
- [x] **Show person name on maintenance logs list**

- [x] **Add New Log button to Maintenance header**

- [x] **Show parent farm name in nav**

- [x] **Allow child-farm members to read parent farm metadata in RLS**
- [x] **Allow shared accounts to update their own maintenance logs**
- [x] **Filter Home recent logs by current user and add edit/delete actions**

- [x] **Add /maintenance dashboard with paged logs and actions**
- [x] **Increase Home recent logs to 20 and add “see all” link**

- [x] **Restrict shared accounts in RLS (no profile edits, no log edits)**
- [x] **Sort recent maintenance logs newest-to-oldest on Home**

- [x] **Gate module tables by farm_modules enabled flag in RLS**
- [x] **Tighten My Farms hierarchy alignment on Account page**

- [x] **Clean up Farm Modules layout on Farm Setup page**

- [x] **Add Farm Modules section on Farm Setup page**

- [x] **Nest child farms under parent farms on Locations page**

- [x] **Show all farms on Locations page (no UI filtering)**

- [x] **Draft dev-only RLS SQL policies file** (`supabase/rls_policies_dev.sql`)
- [x] **Add membership details + profile metadata to Account page**

- [x] **Enhance RLS audit page with farm/person names**
- [x] **Show account farms without UI filtering (RLS will govern)**

- [x] **Show parent + child farms in Account memberships**

- [x] **Add dev-only RLS audit page** (`/dev/rls`)
- [x] **Update UI branding to `farmkit` (lowercase)** (version badge + title)

- [x] **Show farm memberships on Account page**

- [x] **Ignore dev+org VS Code workspace file**


- [x] **Ignore local NB VS Code workspace file**

- [x] **Archive active plan and reset PLANS template** (2026-01-18)
- [x] **Draft v0.1 RLS planning doc** (`docs/dev/rls_plan.md`)
- [x] **Add VS Code workspace extension recommendation (Codex)**

- [x] **Add VS Code workspace extension recommendation (ESLint)**

- [x] **Add VS Code task to auto-start frontend dev server on folder open**

- [x] **Archive active plan and reset PLANS template** (2026-01-13)

- [x] **Expand v0.1 seed data for people linkage + multi-farm coverage** (roles, memberships, equipment, maintenance logs)

- [x] **Document v0.1 demo seed data** (dev docs overview)

- [x] **Plan v0.1 backend schema + seed data** (Supabase SQL + demo data coverage)

- [x] **Create prototype and pre-beta branches** (`v0.0.7-protoype` snapshot + `pre-0.1-beta` workstream)

- [x] **Create chat-thread closeout skill** (log relevant discussion details and commit changes)

- [x] **Create plan-archiving skill and document in agent docs**

- [x] **Archive active plan and reset PLANS template**

- [x] **Remove UI role-based filtering (temporary admin view)** (first step toward RLS migration)

- [x] **Define version control restraints and instructions** (branching, reviews, and commit hygiene)

- [x] **Plan RLS migration** (replace UI-only role filtering with RLS; document scope and approach)

- [x] **Create new working branch for post-prototype work** (mark v0.0.7 as prototype epoch; define branch name)

- [x] **Document roles/security model** (Admin, Manager, User; future custom roles noted)

- [x] **Confirm `.agent/` file set is complete** (DECISIONS / PLANS / TASKS / REVIEW_CHECKLIST present and aligned)

- [x] **Write "Repo Inventory" note** (top-level map + key entry points + hot/risk zones) and link it from `.agent/CONTEXT.md` Notes

- [x] **Define minimal conventions** (naming, folders, where decisions live) and capture in `.agent/DECISIONS.md`

- [x] Drafted `AGENTS.md` contract for AI/Human workflow

- [x] Drafted `.agent/CONTEXT.md` (scope, farm hierarchy, roadmap, non-goals, assumptions, notes)

- [x] Drafted `.agent/CONSTRAINTS.md` (guardrails + privacy rules)



---



## Notes (append-only)

- 2026-02-08: Archived the current active plan; heavier bug testing and optimization is deferred until just before v0.1 beta release.

- 2026-01-03: Task list initialized to drive repo retrofit work in small, reviewable steps.

- 2026-01-13: v0.1 schema wiring complete; manual smoke pass still pending.

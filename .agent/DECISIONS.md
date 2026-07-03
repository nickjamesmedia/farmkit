#.agent/DECISIONS.md

# Decisions (append-only)

> Add new decisions at the top. Do not rewrite history; append corrections as new entries.

## 2026-02-02 - DB-level admin child-farm enrollment (inherited membership rows)
**Context:** Parent-farm Admins need to appear as members of child farms (UI + membership lists), and we want this to stay true even when child farms are added later.  
**Decision:** Add `farm_memberships.inherited_from_farm_id` and implement schema-level triggers to auto-enroll **active parent-farm Admins** into all child farms by creating **inherited membership rows**. Cleanly revoke these inherited rows when the parent Admin membership is removed/demoted/disabled. Provide a backfill helper (`public.farmkit_ensure_admin_child_farm_memberships()`).  
**Consequences:** This supersedes the earlier â€œAdmin membership is effective for child farms (UI-only)â€ approach. Membership lists can now rely on explicit rows. Inherited memberships may not have `person_id` (by design for now), and any schema change must be applied in Supabase before expecting the UI to reflect child memberships automatically.

## 2026-02-01 - v0.1 role permissions correction (Managers can create buildings)
**Context:** We need managers to be able to create and edit buildings during beta operations, while keeping destructive actions admin-only.  
**Decision:** Managers can **add and edit** buildings; only Admin can **delete** buildings.  
**Consequences:** RLS allows `containers` + `building_details` inserts for managers (when Buildings module is enabled). Frontend hides the Delete action unless the user is an admin.

## 2026-02-01 - Frontend module gating via ModuleGate (UX only)
**Context:** We need a consistent way to hide/disable module-related UI elements (nav links, quick links, page actions) without repeating module-check logic everywhere.  
**Decision:** Use `frontend/src/components/ModuleGate.tsx` as the default pattern for module-based UI gating in the frontend.  
**Consequences:** `ModuleGate` is for UX only; RLS remains the security boundary. When touching legacy UI, prefer using `ModuleGate` (or related helpers) for module visibility, but avoid expanding scope into mass refactors.

## 2026-02-01 - Admin membership is effective for child farms (UI + context)
**Context:** Admins are assigned at the parent farm but need to see/manage child farm locations without being explicitly listed as a member for each child.  
**Decision:** Treat an Admin membership on the parent farm as an effective membership across all child farms for UX (e.g., show child farms on `/farm` and show “Inherited” membership on `/account`).  
**Consequences:** RLS remains the source of truth for access. We avoid duplicating membership rows for each child farm (no sync/revocation complexity), but UI should clearly label inherited membership as such.

## 2026-02-01 - v0.1 role permissions (Admin vs Manager vs User)
**Context:** v0.1 beta needs a clear, enforceable permission split that matches the intended product workflow and avoids relying on UI-only filtering.  
**Decision:**  
- **Admin:** full access; only role allowed to configure farms (create child farms), farm setup/settings, module toggles, and building creation/deletion.  
- **Manager:** can add/edit/remove equipment and can edit buildings, but cannot create/delete farms or buildings.  
- **User:** read-mostly; can create and edit their own maintenance logs (and shared accounts can edit only their own logs) but cannot manage equipment/farms/buildings.  
**Consequences:** RLS enforces these restrictions; frontend additionally hides admin routes/links and redirects unauthorized users for UX (not as a security boundary).

## 2026-02-01 - Managers cannot manage users (v0.1)
**Context:** v0.1 beta should limit user administration to farm admins.  
**Decision:** Managers cannot add/update/delete `farm_memberships` (user management); Admin-only.  
**Consequences:** `/users` is admin-only in the frontend, and `farm_memberships` write policies are admin-only in RLS.

## 2026-02-01 - ERP moved to module-gated farm_erp table
**Context:** ERP info must be broadly readable for farms a user works at, but also needs to be disableable via modules without leaking via always-readable metadata tables.  
**Decision:** Move ERP fields out of `farm_details` into a dedicated `farm_erp` table and gate access to `farm_erp` via the `erp` module in RLS. Drop ERP columns from `farm_details` to avoid accidental leakage when ERP is disabled.  
**Consequences:** Existing data in `farm_details` ERP columns must be migrated into `farm_erp` before dropping columns. Frontend reads ERP from `farm_erp` and shows ERP UI only when `erp` is enabled.

## 2026-02-01 - Parent-configured modules, nested modules, and ERP visibility
**Context:** We need a module system that can grow over time without breaking existing farms or forcing unused features. We also need a clear farm hierarchy and role inheritance model to inform RLS and frontend behavior.  
**Decision:** Modules are configured at the parent farm and inherited by child farms/members. New modules introduced later should be disabled by default for existing farms. Modules may be nested (e.g., Containers -> Buildings, Storage & Bins). ERP (emergency response planning) info is treated as broadly viewable by users for locations they work at (including parent farm ERP visibility for child-farm members).  
**Consequences:** RLS and module gating should support inherited module toggles and nested module semantics (including row-level gating where needed). We should separate parent metadata/ERP visibility from parent module-data access where appropriate, and enforce the two-level farm hierarchy intent in schema/RLS over time.

## 2026-01-19 - Split farm info vs farm setup routes
**Context:** The nav farm name should link to a read-only farm info view, while the editable setup page remains admin-focused.  
**Decision:** Keep `/farm` as read-only farm info and move editable Farm Setup to `/admin/farm`; update nav links and dashboard actions accordingly.  
**Consequences:** Users see farm info by default; admins must use `/admin/farm` for edits.

## 2026-01-18 - Child-farm members can read parent farm details
**Context:** Users assigned only to a child farm still need parent-farm context in the UI.  
**Decision:** Allow child-farm memberships to read the parent `farms` and `farm_details` rows.  
**Consequences:** Parent farm metadata is visible to users with only child-farm membership; write access remains unchanged.

## 2026-01-18 - Shared accounts can update their own maintenance logs
**Context:** Shared logins need to close their own maintenance logs (status updates).  
**Decision:** Allow shared accounts to update maintenance logs they created while still blocking deletes and profile edits.  
**Consequences:** Shared logins can close or adjust their own entries but cannot modify other users' logs.

## 2026-01-18 - Shared accounts are restricted (no profile edits, no log edits)
**Context:** Shared logins need tighter controls than personal user accounts.  
**Decision:** Shared accounts cannot insert/update/delete their own `user_profiles` rows and can only insert maintenance logs (no updates or deletes).  
**Consequences:** Shared logins can record work but cannot alter profile metadata or change existing maintenance entries.

## 2026-01-18 - No in-app top-level farm creation (for now)
**Context:** v0.1 focuses on RLS enforcement and does not include public signup or automated farm provisioning.  
**Decision:** Block top-level farm creation in the app; only child farms can be created under an existing parent farm.  
**Consequences:** New farm onboarding requires an out-of-band/admin process until a future signup flow is built.

## 2026-01-18 - Use security definer helpers for dev RLS checks
**Context:** RLS policies need to resolve parent-farm access and cross-farm membership checks, which requires reading `farms`/`farm_memberships` during policy evaluation.  
**Decision:** Use `security definer` helper functions in the dev-only RLS SQL file to evaluate membership and role checks while still scoped to `auth.uid()`.  
**Consequences:** Functions bypass table RLS for the lookup paths; review and harden before production migrations.

## 2026-01-13 - Farm setup edits farms + farm_details (no app_users admin field)
**Context:** The v0.1 schema moves farm contact/branding into `farm_details` and removes `admin_user_id` from `farms`.  
**Decision:** Update the Farm Setup UI to save `farms` (name/slug) and `farm_details` (contact, branding, and location data) and drop the prototype admin-user selector.  
**Consequences:** Admin assignment is handled in Manage Users via `farm_memberships` roles; the Farm Setup page no longer writes to the removed `admin_user_id`.

## 2026-01-13 - Manage Users targets farm_memberships + roles (no invite button)
**Context:** The v0.1 schema replaces `app_users` with `user_profiles` and `farm_memberships`, and invite flow depends on server-side auth.  
**Decision:** Manage Users now edits `farm_memberships` and role assignment directly; the UI no longer triggers invite emails.  
**Consequences:** Invites must be handled via a server-side flow; the frontend focuses on membership management and role/status updates.

## 2026-01-11 - Link users to people via farm_memberships
**Context:** V0.1 requires every user account to have a linked `people` row while shared logins do not map to a person.  
**Decision:** Add `farm_memberships.person_id` as the per-farm link between an auth user and their `people` record; leave `person_id` null for shared accounts.  
**Consequences:** Seeds must create a `people` row per personal user and populate `farm_memberships.person_id`; RLS can rely on the membership link for person attribution.

## 2026-01-11 - Branch naming for prototype snapshot and pre-beta workstream
**Context:** We needed a durable snapshot of the v0.0.7 prototype while continuing work toward v0.1 beta on a separate branch.
**Decision:** Keep `main` as-is, create `v0.0.7-protoype` as the prototype snapshot branch, and use `pre-0.1-beta` as the active workstream branch.
**Consequences:** `v0.0.7-protoype` serves as the frozen prototype reference; `pre-0.1-beta` holds ongoing pre-beta changes.

## 2026-01-03 - Cutover to v0.0.8 alpha (post-prototype)
**Context:** We need a clean start after the v0.0.7 prototype epoch.
**Decision:** v0.0.8 is the first post-prototype alpha; future work follows the new workflow on the post-prototype branch.
**Consequences:** v0.0.7 remains the vibe-coded baseline; v0.0.8+ changes are tracked under the new process.

## 2026-01-03 - Temporarily remove UI role filtering during RLS migration
**Context:** Phase 0 of the RLS migration removes UI-only access gates so we can rebuild security at the data layer.
**Decision:** Show the admin view to all users temporarily; do not use UI role checks as a security boundary.
**Consequences:** Until RLS is in place, access is effectively open within the app; prioritize policy work next.

## 2026-01-03 - Adopt SemVer and mark v0.0.7 as prototype epoch
**Context:** We need consistent versioning and to distinguish the rapid prototype from the structured work ahead.
**Decision:** Use SemVer (`MAJOR.MINOR.PATCH`) for releases; current state is v0.0.7 (prototype epoch), next alpha patch will be v0.0.8 after current tasks complete.
**Consequences:** Future releases follow SemVer; v0.0.7 is treated as the last vibe-coded prototype baseline.

## 2026-01-03 - Access control enforced by RLS (not UI filtering)
**Context:** The current v0.0.7 prototype filters data in the UI by role, which is not a security boundary.
**Decision:** Use RLS as the source of truth for data access; UI filtering may exist for UX but never for access control.
**Consequences:** Plan migration from UI-only filtering to RLS and avoid new UI-only access gates.

## 2026-01-03 - Initial roles and security model
**Context:** The beta needs a simple, explainable access model aligned with the current product shape.  
**Decision:** Start with three roles: Admin, Manager, and User (personal or shared accounts). Plan for potential future roles or admin-defined custom roles without locking the model.  
**Consequences:** Early implementations should keep role checks minimal and avoid assumptions that prevent expanding roles later.

## 2026-01-03 — Minimal repo conventions (current structure)
**Context:** The repo needs lightweight conventions that match the existing v0.0.7 structure.  
**Decision:** Treat `frontend/` as the React app root; keep page-level screens in `frontend/src/pages`, shared UI in `frontend/src/components`, and Supabase wiring in `frontend/src/lib/supabaseClient.ts`. Keep database SQL in `supabase/` (`schema.sql`, seed data, helpers).  
**Consequences:** New work should follow these paths unless a later decision changes the structure.

## 2026-01-03 — Public docs must not include internal customer/farm names
**Context:** The repo will be public/open-source (or at least shareable) and should not leak internal partner names.  
**Decision:** Public-facing docs use generic terms (e.g., “tester farm partner”) and avoid any identifying names.  
**Consequences:** If examples are needed, use fictional placeholder farms and synthetic data.

## 2026-01-03 — Farm hierarchy is primary farm + nested farm locations (child farms)
**Context:** The product needs to represent multi-location operations under one managed account.  
**Decision:** Model a primary farm (HQ/parent) with one or more child farm locations, managed centrally.  
**Consequences:** Permissions, module toggles, and admin UX must work at the primary-farm level, while data can be scoped per location.

## 2026-01-03 — Incremental retrofit over rewrites
**Context:** v0.0.7 is functional but was built quickly; quality varies.  
**Decision:** Prefer small, isolated improvements with minimal diffs; avoid sweeping refactors.  
**Consequences:** Work will be organized via `.agent/PLANS.md` and executed in slices with validation.

---

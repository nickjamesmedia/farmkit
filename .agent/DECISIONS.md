#.agent/DECISIONS.md

# Decisions (append-only)

> Add new decisions at the top. Do not rewrite history; append corrections as new entries.

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

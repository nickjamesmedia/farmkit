#.agent/CONSTRAINTS.md

# Constraints (Current)

## Hard rules (non-negotiable)
- Follow `AGENTS.md` and the `.agent/` workflow as the source of truth for how work is done here.
- Do **not** commit or paste secrets (API keys, service-role keys, passwords, private URLs, customer PII).
- Do **not** mention internal customer/farm names in public-facing docs or code comments. Use generic wording (e.g., “tester farm partner”).
- Prefer **small, reviewable diffs**. No sweeping rewrites or “cleanup everything” refactors.
- Do not invent requirements, architecture, or tooling. If it’s not in `.agent/` (or explicitly stated by the human), treat it as unknown.
- Access control must be enforced by RLS; UI filtering is not security and must not be used to hide data.
- Application code changes are allowed **only when explicitly requested** or clearly required by the active plan; otherwise keep changes to Markdown artifacts.

## Operating rules (how we work day-to-day)
- Keep “Current” sections at the top of `.agent/` files; move older entries down rather than deleting.
- Maintain **exactly one active plan** in `.agent/PLANS.md`.
- Treat `.agent/DECISIONS.md` and the Notes sections as **append-only** unless the human explicitly requests edits.
- Avoid per-task file explosion: prefer updating existing `.agent/` files over creating new ones.
- No premature optimization or generalization. Implement only what is needed for the next milestone.


## Version control restraints (current)
- Use a branch per workstream; avoid direct commits to `main`.
- Keep commits small and scoped; reference the relevant plan/task when possible.
- Require review before merging changes that affect auth, data model, or permissions.

## Product constraints (scope & behavior)
- Preserve the core product intent:
  - **Primary farm (HQ/parent)** with nested **farm locations (child farms)**
  - Core modules: **Equipment, Buildings/Locations, Maintenance Logs**
  - Maintenance logs must capture a **person name**, including when shared accounts are used.
- Avoid breaking existing prototype workflows without documenting the change and migration path (if applicable).
- Treat anything “enterprise-grade” or “fully generalized” as out of scope unless explicitly promoted into the active plan.

## Tech constraints (directional defaults)
- Assume the current direction is **React + Supabase** unless the human chooses otherwise.
- Avoid introducing major new dependencies, frameworks, or infrastructure without recording a decision in `.agent/DECISIONS.md`.

## Validation expectations
- For doc-only changes: ensure Markdown is readable and consistent with repo conventions.
- For code changes:
  - Run the minimal available checks (lint/test/build) if the repo supports them.
  - If you cannot run checks, explicitly state what was not verified and why.
- For database/auth changes:
  - Require an explicit plan step and a documented migration/rollback approach before editing schema or auth rules.

## Stop conditions
- If constraints conflict, stop and surface the conflict in the active plan (or ask the human).
- If required information is missing or ambiguous, stop and ask rather than guessing.
- If acceptance criteria for the active plan are met, stop—do not expand scope.

## Notes (append-only)
- 2026-01-03: Established Farmkit-specific constraints (privacy re: internal names, child-farm hierarchy is core intent, code changes only when requested/within plan).

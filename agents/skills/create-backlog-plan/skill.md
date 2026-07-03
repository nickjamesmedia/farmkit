---
name: create-backlog-plan
description: Create and maintain backlog plan entries in .agent/BACKLOG.md (plan queue + plan brief) so multiple candidate plans can be tracked while keeping exactly one active plan in .agent/PLANS.md. Use when asked to add a new backlog plan, shape/clarify a plan, triage/prioritize backlog plans, or promote a backlog plan into .agent/PLANS.md.
---

# Create Backlog Plan

## Overview
Maintain a durable queue of "plan candidates" in `.agent/BACKLOG.md` without violating the repo rule: there is only one Active plan, and it lives in `.agent/PLANS.md`.

## Workflow

### 1) Load the current state
Read:
- `AGENTS.md`
- `.agent/CONTEXT.md`
- `.agent/CONSTRAINTS.md`
- `.agent/BACKLOG.md`
- `.agent/PLANS.md` (to ensure the backlog entry does not conflict with the current active plan)

### 2) Decide: create vs update
If the request is ambiguous, ask for:
- Title (short, specific)
- Target milestone/version (if any)
- Owner (human/codex/both)
- Priority (`P0`/`P1`/`P2`/`P3`)
- Status (`idea`/`shaping`/`ready`/`next`/`blocked`/`parked`)
- Any known dependencies or constraints

If this plan already exists, update the existing entry/brief instead of creating a duplicate.

### 3) Choose a Plan ID
Use `P-YYYYMMDD-###` (example: `P-20260202-001`).

Derive `###` by scanning `.agent/BACKLOG.md` for existing IDs on the same date and incrementing:
- If none exist for that date: start at `001`
- Otherwise: max + 1

### 4) Update `.agent/BACKLOG.md`
Make the smallest safe diff:
- Add or update a row in the "Plan Queue (index)" table.
- Add or update the corresponding "Plan Brief" section.

Minimum "ready" bar (before promotion):
- Goal is explicit and testable
- Non-goals are listed (to prevent scope creep)
- Acceptance criteria are concrete (can say "done" without debate)

### 5) Optional: mark as "next"
If the user wants a single "next plan" candidate, set exactly one entry to `next` and downgrade others back to `ready` (or keep them `ready` without `next`).

### 6) Optional: promote to `.agent/PLANS.md`
Only do this when explicitly requested.

Promotion checklist:
1) Copy the plan brief into `.agent/PLANS.md` as the single Active plan (respecting the existing template/structure).
2) Update `.agent/BACKLOG.md` row status to `promoted` and add a short link/note that it is now active in `.agent/PLANS.md`.
3) Do not delete the backlog entry (keep it as history).

### 7) Validation
- Ensure `.agent/BACKLOG.md` renders cleanly (table alignment reasonable, headings readable).
- Ensure Plan ID is unique.
- Ensure the backlog entry does not imply multiple active plans.

## Guardrails
- Do not generate application code unless explicitly requested.
- Do not invent requirements; ask when missing.
- Prefer plain ASCII (avoid smart quotes and special arrows) unless the file already uses them.


# Farmkit Agent Contract (AI/Human Hybrid Workflow)

This repository contains **Farmkit** and is being organized into a deliberate **AI/Human hybrid workflow**.

All agents (Codex or non-Codex) must follow this contract when working here.

---

## Golden rule

**Make thinking and decisions durable in Markdown.**  
Prefer small, reviewable changes over “vibe-coded” rewrites.

---

## Workflow (deliberate, repeatable)

1) **Read**  
   Open `AGENTS.md`, then `.agent/CONTEXT.md` and `.agent/CONSTRAINTS.md` before acting.

2) **Plan**  
   If the task is non-trivial, ambiguous, risky, or touches multiple files, write or update a plan in `.agent/PLANS.md`.  
   - Maintain **one active plan at a time**.
   - Clearly state **assumptions** and **non-goals**.
   - Prefer retrofit plans: incremental cleanup around the existing prototype.

3) **Execute**  
   Make the **smallest safe change set** that advances the active plan.  
   Avoid speculative edits, rewrites, mass refactors, or pre-optimization.

4) **Verify**  
   Run, describe, or reason through **minimal validation checks** appropriate to the change.  
   Record results (or limitations if full verification isn’t possible).

5) **Report**  
   Summarize what changed and update:
   - `.agent/TASKS.md` (status and next steps)
   - `.agent/DECISIONS.md` (when tradeoffs or irreversible choices were made)

---

## Guardrails (anti-drift, anti-overgeneration)

- Do not invent architecture, features, or files beyond the request and constraints.
- Avoid “vibe coding”: no speculative rewrites, mass refactors, or placeholder content.
- Prefer clarity over completeness; **pause and ask** when requirements are ambiguous.
- Keep outputs minimal and scoped; only touch files necessary for the task.
- Treat **RLS as the source of truth for access control**; UI filtering is not security and should not be used to hide data.

---

## Versioning (SemVer)

- Use `MAJOR.MINOR.PATCH` (SemVer) for releases.
- Current prototype epoch is **v0.0.7**; next alpha patch is **v0.0.8** after current tasks complete.
- Pre-1.0 may use `-alpha.N` / `-beta.N` tags when needed.

---

## Retrofit rules (for the existing v0.0.7 prototype)

- Treat the current prototype as **valuable evidence**, even if messy.
- Prefer **isolated improvements** (one module/area at a time) over sweeping reorganizations.
- When cleaning up:
  - Document intent in `.agent/DECISIONS.md` if behavior or structure changes materially.
  - Keep the smallest possible diff that improves readability, safety, or testability.
- Don’t “standardize” anything (stack, tooling, architecture) unless the repo already has it or the human explicitly chooses it.

---

## Uncertainty & stop conditions

- If required information is missing, **stop and ask** rather than guessing.
- If the plan no longer fits constraints, **revise the plan before executing**.
- When the plan’s acceptance criteria are met, **stop** and report—do not continue expanding scope.

---

## Directory-level overrides

- Instructions apply in this order:  
  nearest `AGENTS.md` → `.agent/CONSTRAINTS.md` → `.agent/CONTEXT.md` → root `AGENTS.md`.
- If a subdirectory contains its own `AGENTS.md`, follow it for work in that subtree.
- If no overrides exist, the root files are authoritative.

---

## Collaboration conventions

- Use `.agent/` files as the **shared source of truth** across humans and agents.
- Treat `.agent/` entries as **append-only** unless explicitly instructed otherwise.
- Keep “current” sections at the top of each file; older notes remain below.
- Keep plans and task lists **actionable** (clear next step, definition of done).

---

## What not to do

- Do not generate application code unless explicitly requested.
- Do not assume a framework, language, backend, database, or deployment target.
- Do not remove, rewrite, or reorganize unrelated content without approval.


## Module architecture rule (UI)

When adding a module that is backed by a database table, follow the established
pattern:

1. The module gets a **main page with a tabular view** of its data (with
   filtering/sorting once the list can grow).
2. **Rows are clickable** and open a **quick-view modal** for the item
   (lightweight edit/archive where appropriate).
3. The modal has a **"Detailed view" action** that navigates to the item's own
   page.
4. Register the module in **Search** (new result type + query + route) and gate
   everything behind its `modules` key.

Equipment, Buildings, Locations, and Team all follow this pattern — keep new
modules consistent with it.

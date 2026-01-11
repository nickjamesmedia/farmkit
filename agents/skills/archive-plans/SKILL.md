---
name: archive-plans
description: Archive .agent/PLANS.md and reset it to the standard placeholder template. Use when asked to archive the current plan, reset PLANS.md for the next task, or create a repeatable plan-archiving workflow in this repo.
---

# Archive Plans

## Overview
Archive the current `.agent/PLANS.md` into `.agent/archives/plans/` with a date-stamped filename, then reset `.agent/PLANS.md` to the standard placeholder template and update agent docs.

## Workflow
1) Read `.agent/PLANS.md` and confirm it is the file to archive.
2) Create `.agent/archives/plans/` if missing.
3) Copy `.agent/PLANS.md` to `.agent/archives/plans/YYYY-MM-DD-plans.md` using local date.
4) Replace `.agent/PLANS.md` with the placeholder template (see below).
5) Update `.agent/TASKS.md` (mark done) and `.agent/DECISIONS.md` only if a material tradeoff is made.
6) Add a note in `.agent/CONTEXT.md` (append-only) if the archive location or workflow changes.
7) Validate: ensure Markdown renders cleanly and the archive file exists.

## Placeholder Template (use verbatim, update placeholders later)
```markdown
#.agent/PLANS.md

# Plans

## Active plan: _TBD_
**Status:** Not started  
**Owner:** _TBD_  
**Started:** _YYYY-MM-DD_

### Goal
_TBD_

### Non-goals
- _TBD_

### Assumptions
- _TBD_

### Work items (ordered)
1) _TBD_

### Acceptance criteria
- _TBD_

### Validation
- _TBD_

---

## Backlog plans (inactive)
_Add new plans here when needed. Keep only one Active plan at a time._
```

## Notes
- Keep diffs minimal and avoid non-ASCII unless the file already uses it.
- Prefer `apply_patch` for single-file edits.

#.agent/PLANS.md

# Plans

## Active plan: Create chat-thread closeout skill
**Status:** Completed  
**Owner:** AI-led, human-approved  
**Started:** 2026-01-11

### Goal
Create a reusable skill that standardizes closing out chat threads by logging relevant discussion details in the appropriate Markdown files and committing the related changes.

### Non-goals
- Reworking unrelated `.agent/` processes or content.
- Changing repo workflow beyond documenting the closeout procedure.
- Implementing app code changes.

### Assumptions
- Skill will live in `agents/skills/` and be packaged in `agents/skills/dist/`.
- Closeout logging focuses on `.agent/` Markdown files unless the thread explicitly touches other docs.

### Work items (ordered)
1) Confirm skill name, location, and packaging expectations.
2) Initialize skill structure and write concise `SKILL.md`.
3) Add any helper references if needed (prefer none).
4) Package the skill for distribution.
5) Update `.agent/TASKS.md` and `.agent/DECISIONS.md` if needed.

### Acceptance criteria
- Skill exists with valid `SKILL.md` and clear trigger description.
- Packaged `.skill` file is created in `agents/skills/dist/`.
- `.agent/TASKS.md` reflects completion; `.agent/DECISIONS.md` updated if tradeoffs are made.

### Validation
- Skill folder structure validated by inspection and packaging.
- Markdown updates are readable and consistent.

---

## Backlog plans (inactive)
### Create plan-archiving skill + update agent docs
**Status:** Completed  
**Owner:** AI-led, human-approved  
**Started:** 2026-01-11

#### Goal
Create a reusable skill that standardizes archiving `.agent/PLANS.md`, then reference it in the appropriate agent docs.

#### Non-goals
- Reworking unrelated `.agent/` processes or content.
- Changing how plans are written beyond a minimal template reset.

#### Assumptions
- Skill will live in the repo unless you want it in `$CODEX_HOME/skills`.
- Only `.agent/` docs need updates (no app code changes).

#### Work items (ordered)
1) Confirm skill location and packaging/install expectations.
2) Initialize skill (name, structure) and write concise `SKILL.md`.
3) Add any helper scripts or references if needed (prefer none).
4) Update relevant agent docs to reference the new skill.
5) Record task status and any decisions.

#### Acceptance criteria
- Skill exists with valid `SKILL.md` and clear trigger description.
- Agent docs reference the skill in the agreed locations.
- `.agent/TASKS.md` reflects completion; `.agent/DECISIONS.md` updated if tradeoffs are made.

#### Validation
- Skill folder structure validated by inspection (or packaged if required).
- Markdown updates are readable and consistent.
_Add new plans here when needed. Keep only one Active plan at a time._

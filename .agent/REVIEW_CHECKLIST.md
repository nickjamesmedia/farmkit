#.agent/REVIEW_CHECKLIST.md

# Review checklist (use for PRs / change reviews)

## Scope & intent
- [ ] The change matches the active plan in `.agent/PLANS.md` (or is explicitly requested).
- [ ] Scope is small and reviewable; no drive-by refactors.
- [ ] Assumptions are stated (in PR description or `.agent/` docs) when relevant.

## Safety & constraints
- [ ] No secrets, tokens, or sensitive data added.
- [ ] No internal customer/farm names added to public docs or comments.
- [ ] RLS policies enforce access control; no UI-only filtering used as a security boundary.
- [ ] Changes respect `.agent/CONSTRAINTS.md`.

## Product behavior
- [ ] Behavior changes (if any) are intentional and documented.
- [ ] Farm hierarchy (primary farm + child farm locations) remains consistent.
- [ ] Maintenance logs still capture a person name (including shared-account use).

## Quality & maintainability
- [ ] Naming and folder choices reduce confusion (not increase it).
- [ ] Any new patterns are documented in `.agent/DECISIONS.md` if they affect future work.
- [ ] Dead code / unused exports are avoided where easy.

## Validation
- [ ] Minimal checks run (lint/test/build), or unverified items are listed with reasons.
- [ ] If schema/auth changes: migration/rollback is documented and reviewed.

## Docs & workflow hygiene
- [ ] `.agent/TASKS.md` updated (moved items to Done, added next steps).
- [ ] `.agent/DECISIONS.md` updated if a meaningful tradeoff was made.
- [ ] `.agent/CONTEXT.md` Notes updated if project understanding changed.

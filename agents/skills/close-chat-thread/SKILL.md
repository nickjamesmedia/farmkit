---
name: close-chat-thread
description: Close out a chat or support thread by capturing key discussion details into the relevant Markdown logs (.agent/TASKS.md, .agent/DECISIONS.md, .agent/CONTEXT.md, .agent/PLANS.md or other repo docs as applicable) and committing only the thread-related changes; use when a user asks to wrap up, close out, or finalize a thread and wants logging plus a git commit.
---

# Close Chat Thread

## Overview
Standardize thread closeout: capture decisions, tasks, context updates, and verification notes in the right Markdown files, then commit the related changes cleanly.

## Workflow

### 1) Identify thread artifacts
- Summarize: key decisions, task status changes, context updates, and any files touched.
- Note any missing info that blocks accurate logging; ask before proceeding.

### 2) Update Markdown logs (append-only where required)
- `.agent/TASKS.md`: add new tasks, mark completed work, and note next steps.
- `.agent/DECISIONS.md`: append when tradeoffs or irreversible choices were made.
- `.agent/CONTEXT.md`: add Notes items for durable context changes; keep Current sections at the top.
- `.agent/PLANS.md`: ensure exactly one active plan and update status/acceptance where needed.
- Other docs: update only when the thread explicitly referenced or changed them.

### 3) Verify minimally
- For doc-only changes, ensure Markdown is readable and consistent.
- Record any validation limitations in the closeout summary.

### 4) Commit the thread changes
- Check `git status` and confirm a non-`main` branch (per repo constraints).
- Stage only thread-related files; if unrelated changes exist, ask whether to include or leave them.
- Use a short, descriptive commit message referencing the thread topic.
- Do not amend or squash unless explicitly requested.

## Closeout response
- Summarize what changed and list the updated files.
- Mention verification performed (or why it was skipped).
- Confirm the commit hash and message.

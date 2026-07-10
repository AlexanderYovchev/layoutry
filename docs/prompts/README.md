# Prompts

This directory archives significant Claude Code prompts that successfully
built or fixed something meaningful in Layoutry — a record of what worked,
so a future session can reuse or adapt a proven approach instead of
rediscovering it.

## When to save a prompt

Save a prompt here when it drove a complete, successful unit of work — a
milestone, a feature slice, a nontrivial bug fix, or a structural change
like this one. Do not save routine, small, or unsuccessful prompts; this is
a curated record of what worked, not a full session transcript log.

## Convention

- File name: `YYYY-MM-DD-short-description.md`
  (e.g. `2026-07-10-repository-architecture.md`).
- Each file should include, at minimum:
  - The prompt text itself (verbatim or lightly trimmed for length).
  - What it produced (a one- or two-line summary, or a link to the
    relevant commit/PR once the project is committing regularly).
  - Any milestone it relates to (see
    [docs/roadmap/milestones.md](../roadmap/milestones.md)).
- Do not include secrets, credentials, or environment-specific paths in a
  saved prompt.

Nothing has been saved yet — this convention starts with the next
successful feature-building prompt.

# Architecture Decision Records

This directory records significant, approved architectural decisions for
Layoutry using lightweight ADRs.

## When to write one

Write an ADR when a decision is hard to reverse, affects multiple features,
or would otherwise need to be re-litigated from scratch by someone reading
the code later — for example, choosing the editor's state-management
approach, the document model's shape, or a dependency boundary that
constrains how features are allowed to talk to each other.

Do not write an ADR for a decision that is easily reversible or purely
local to one file. Do not record a decision that has not actually been
approved — an ADR documents a choice that has been made, not a proposal
under discussion.

## Format

Each ADR is a numbered Markdown file, `ADR-NNNN-short-title.md`, containing:

- **Title**
- **Status** — `Proposed`, `Accepted`, `Superseded`, or `Rejected`
- **Context** — the problem or forces at play
- **Decision** — what was decided
- **Consequences** — resulting tradeoffs, both positive and negative
- **Alternatives considered**
- **Date**

## Index

- [ADR-0001](./ADR-0001-feature-based-architecture.md) — Feature-based
  architecture — Accepted
- [ADR-0002](./ADR-0002-electron-desktop-shell.md) — Electron desktop
  shell — Accepted
- [ADR-0003](./ADR-0003-versioned-project-format.md) — Versioned project
  file format — Accepted
- [ADR-0004](./ADR-0004-browser-project-library.md) — Browser project
  library in IndexedDB — Accepted
- [ADR-0005](./ADR-0005-native-project-files.md) — Native project files
  through capability-token IPC — Accepted

# Roadmap: Milestones

High-level milestone sequence for Layoutry. This tracks _what stage the
project is at_, not detailed task breakdowns — implementation commitments
within a milestone are scoped and approved when that milestone starts.

| Milestone | Description                                                            | Status                         |
| --------- | ---------------------------------------------------------------------- | ------------------------------ |
| M0        | Repository and product definition                                      | Complete                       |
| M1        | Technical foundation (Next.js, TypeScript, Tailwind, testing, linting) | Complete, pending final commit |
| M2        | Application shell                                                      | Next                           |
| M3        | Editor document model                                                  | Planned                        |
| M4        | Canvas rendering and selection                                         | Planned                        |
| M5        | Element insertion and manipulation                                     | Planned                        |
| M6        | CSS inspector                                                          | Planned                        |
| M7        | Component library                                                      | Planned                        |
| M8        | HTML/CSS export                                                        | In progress (EXPORT-1.4)       |
| M9        | Local project persistence                                              | Planned                        |
| M10       | Authentication and cloud projects                                      | Planned                        |
| M11       | Subscription and billing                                               | Planned                        |
| M12       | AI assistance                                                          | Planned                        |
| M13       | Production hardening and public release                                | Planned                        |

## Notes

- **M0 — Repository and product definition:** product concept, repository
  initialization, and naming (Layoutry) are settled — see
  [docs/project-idea.md](../project-idea.md).
- **M1 — Technical foundation:** the Next.js App Router + TypeScript strict
  - Tailwind + Zustand + dnd-kit + Zod + Vitest/RTL + Playwright + ESLint +
    Prettier foundation is scaffolded and passing `lint`, `typecheck`, `test`,
    `build`, and `test:e2e` — see
    [docs/reports/foundation-setup.md](../reports/foundation-setup.md). Marked
    complete pending the final commit of this working tree into version
    control.
- **M2 — Application shell:** the next milestone. Scope to be defined when
  work begins; not yet detailed here.
- **M3 and later** are placeholders for sequencing only. None of their
  implementation details are approved yet — see
  [docs/architecture/editor-domain-model.md](../architecture/editor-domain-model.md)
  for the one architectural principle already locked in for M3 (a typed,
  serializable document model as the editor's source of truth).
- **M8 — HTML/CSS export:** EXPORT-1.1 audited the codebase
  ([report](../reports/export-1.1-architecture-audit.txt)); EXPORT-1.2
  delivered the pure HTML/CSS engine, its IR and visual parity tests
  ([export-engine.md](../architecture/export-engine.md),
  [report](../reports/export-1.2-html-css-export-foundation.txt));
  EXPORT-1.3 added the interaction runtime
  ([report](../reports/export-1.3-interaction-runtime.txt)); EXPORT-1.4
  added the Export Code dialog, browser downloads and native desktop saving
  ([export-ui.md](../architecture/export-ui.md),
  [report](../reports/export-1.4-export-ui.txt)). Tailwind (EXPORT-1.5),
  React and Vue follow, each after review.

Defects found during checkpoints but out of their scope are tracked in
[known-issues.md](./known-issues.md).

This file should be updated as milestones complete or scope is approved —
not used to pre-commit to unapproved implementation details.

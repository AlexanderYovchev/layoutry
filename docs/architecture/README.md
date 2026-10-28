# Architecture Documentation

This directory documents how Layoutry's codebase is organized and why. It is
the second source of truth for implementation decisions, right after the
current task prompt and [CLAUDE.md](../../CLAUDE.md) — see
[CLAUDE.md's "Source of Truth" section](../../CLAUDE.md#source-of-truth) for
the full authority order.

## Contents

- [repository-structure.md](./repository-structure.md) — what lives where,
  both today and in the intended target layout.
- [dependency-rules.md](./dependency-rules.md) — which layers may import from
  which, and why the boundaries exist.
- [editor-domain-model.md](./editor-domain-model.md) — the principle that the
  editor's document model, not the rendered canvas, is the source of truth.
- [testing-strategy.md](./testing-strategy.md) — where tests live and what
  they should verify.
- [desktop-shell.md](./desktop-shell.md) — the Electron desktop build: how
  to build, run and test it, its security model, and its alpha limits.
- [project-format.md](./project-format.md) — the versioned `.layoutry`
  project file: structure, validation limits, migration policy, and how a
  loaded project is applied to the editor.
- [desktop-files.md](./desktop-files.md) — native `.layoutry` files in
  the desktop app: secure IPC, atomic writes, external-change detection,
  closing, file association limits.
- [project-storage.md](./project-storage.md) — the browser project library
  (IndexedDB), Save/Open/Import/Download semantics, dirty state and
  storage limitations.
- [project-recovery.md](./project-recovery.md) — automatic recovery
  snapshots: scheduling, browser and desktop storage, retention, the
  recovery dialog, Save integration and crash-recovery limits.
- [project-persistence.md](./project-persistence.md) — the persistence
  subsystem on one page (PROJECT-1.5): architecture, guarantees, known
  limits, dirty state, security boundaries, alpha-tester guidance.
- [export-engine.md](./export-engine.md) — the HTML/CSS Export Engine
  (EXPORT-1.2): shared Canvas styling API, export IR, HTML/CSS generation
  rules, defaults and reset policy, security policy, visual parity testing,
  the interaction runtime (EXPORT-1.3) and known limitations.
- [export-ui.md](./export-ui.md) — the Export Code dialog (EXPORT-1.4):
  snapshot and stale handling, diagnostics, code preview, copy, browser
  downloads, native desktop saving and its security, entitlement boundary,
  offline limits and large-document performance.

## Related documentation

- [docs/decisions/](../decisions/) — Architecture Decision Records (ADRs)
  explaining why a given approach was chosen.
- [docs/roadmap/milestones.md](../roadmap/milestones.md) — the sequence of
  milestones the project is working through.
- [docs/glossary.md](../glossary.md) — short definitions of Layoutry-specific
  terms used throughout this documentation.

## When these documents disagree with the code

If you find code that contradicts this documentation, treat that as a signal
to stop and report the conflict rather than silently following either one —
see the escalation rule in [CLAUDE.md](../../CLAUDE.md).

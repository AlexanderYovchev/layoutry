# ADR-0001: Feature-Based Architecture

**Status:** Accepted

**Date:** 2026-07-10

## Context

Layoutry is a browser-based visual HTML/CSS editor with several distinct,
substantial areas of functionality — an editor engine, a rendering canvas,
a style inspector, a component library, and a code export pipeline — that
will each grow considerably in scope over the project's roadmap (see
[docs/roadmap/milestones.md](../roadmap/milestones.md)). The technical
foundation (Next.js App Router, TypeScript strict, Tailwind, Zustand,
dnd-kit, Zod, Vitest/RTL, Playwright) is in place, but no editor
functionality has been implemented yet, which makes this the point at which
structural decisions are cheapest to make.

Without an explicit organizing principle, a growing editor application
tends toward one of two failure modes: a flat, type-based structure
(`components/`, `hooks/`, `stores/` at the top level) that scales poorly as
unrelated concerns pile into shared folders, or an unstructured
free-for-all where feature code, shared code, and app routing become
tangled with no enforceable boundary.

## Decision

Layoutry adopts a **feature-based architecture**:

- Product functionality is organized under `src/features/*`
  (`editor`, `canvas`, `inspector`, `components-library`, `export`), each
  owning its own components, hooks, stores, types, schemas, and utilities.
- `src/app` is limited to Next.js routing, layouts, and metadata — it
  composes features together but does not contain feature logic.
- Genuinely shared, feature-agnostic code lives in `src/components/ui`
  (UI primitives), `src/components/layout` (app shell), `src/lib`
  (framework-independent utilities), and `src/styles` (design tokens) —
  and only after it is actually shared by more than one consumer, not
  speculatively.
- Explicit dependency direction rules govern what each layer may import
  (see [docs/architecture/dependency-rules.md](../architecture/dependency-rules.md)),
  preventing shared code from depending on features and preventing one
  feature from directly reaching into another's internals.
- The editor's authoritative state is a typed, serializable **document
  model**, not the rendered canvas or DOM — see
  [docs/architecture/editor-domain-model.md](../architecture/editor-domain-model.md).
  This is a foundational consequence of choosing feature boundaries around
  `editor`/`canvas`/`inspector`/`export`: those boundaries only hold if
  there is a single shared model they all read from and write to, rather
  than each feature treating the DOM as ground truth.
- Tests are colocated with the module they test where practical, with
  shared test configuration under `test/` and end-to-end specs under
  `e2e/` — see
  [docs/architecture/testing-strategy.md](../architecture/testing-strategy.md).
- Each feature exposes a **stable public API** through its own `index.ts`
  (created once there is something stable to export, not preemptively),
  rather than allowing unrestricted deep imports into another feature's
  internal files.

## Consequences

**Positive:**

- Each feature can be reasoned about, tested, and modified largely in
  isolation, with the dependency rules making unintended coupling visible
  rather than silent.
- The document-model principle keeps the door open for persistence,
  undo/redo, export, validation, migration, and future collaboration
  without a later rewrite of the rendering layer.
- New contributors (human or Claude Code) can find where a given piece of
  functionality belongs without guessing, and CLAUDE.md gives an explicit,
  checkable rule set rather than relying on convention alone.

**Negative / tradeoffs:**

- More directories and boundary discipline up front than a flat structure
  would require, for functionality that is still largely unbuilt — accepted
  as a deliberate tradeoff because retrofitting boundaries after features
  exist and are entangled is significantly more expensive.
- Stable public APIs (`index.ts` per feature) add a small amount of
  indirection once features have real exports; this is intentionally
  deferred until each feature actually has something worth exposing, so
  the cost is paid incrementally rather than all at once.

## Alternatives considered

- **Flat, type-based structure** (`components/`, `hooks/`, `stores/` at the
  top level, ungrouped by feature). Rejected: does not scale to an editor
  application with several large, semi-independent subsystems, and gives no
  natural place to enforce that e.g. `inspector` cannot directly mutate
  `canvas` state.
- **Canvas-as-source-of-truth** (rendering directly from/to the DOM, e.g.
  via `contentEditable` or direct DOM mutation, without a separate document
  model). Rejected: blocks persistence, undo/redo, deterministic export,
  validation, and future collaboration, all of which are on the roadmap
  (see [docs/roadmap/milestones.md](../roadmap/milestones.md)).
- **No enforced dependency direction** (any module may import any other).
  Rejected: without explicit rules, shared UI and `lib` code tend to
  accumulate feature-specific dependencies over time, which quietly breaks
  the isolation the feature-based structure is meant to provide.

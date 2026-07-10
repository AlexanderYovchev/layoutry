# Dependency Rules

This document defines which parts of the codebase are allowed to import
from which other parts. The goal is a one-directional dependency graph with
no cycles, so any feature can be reasoned about, tested, and eventually
extracted without untangling the rest of the app.

## Allowed direction

```
src/app
  → src/components (ui, layout)
  → src/features/*
  → src/lib
  → src/styles

src/components/layout
  → src/components/ui
  → src/lib

src/features/*
  → src/components/ui
  → src/lib
  → its own internal files

src/components/ui
  → src/lib   (nothing else)

src/lib
  → (nothing in the app — framework-independent only)
```

## Rules

1. **`src/app` may import** components, features, lib, and styles. It
   composes routes out of them; it must not implement editor domain logic
   itself.
2. **`src/components/layout` may import** shared UI (`src/components/ui`)
   and `src/lib`. It must not import from `src/features/*` — the app shell
   should not know about a specific feature's internals.
3. **`src/features/*` may import** shared UI, `src/lib`, and their own
   internal files. A feature may not import another feature's internal
   files directly — see cross-feature access below.
4. **`src/components/ui` must not import product features.** Primitives
   like Button or Dialog have to stay usable by any feature, which is
   impossible if they depend on one.
5. **`src/lib` must not import product features** or React component code
   that isn't framework-independent. It is the layer everything else can
   safely depend on.
6. **One feature must not directly mutate another feature's internal
   state.** For example, `inspector` must not reach into `canvas`'s DOM or
   `canvas`'s Zustand store directly. Cross-feature interaction goes through
   `editor`, which orchestrates canvas and inspector (see
   [CLAUDE.md](../../CLAUDE.md) for the editor's orchestration role), or
   through a feature's public `index.ts` API.

## Cross-feature imports

Prefer importing another feature's stable public API
(`@/features/<feature>` re-exported from that feature's `index.ts`) over
reaching into `@/features/<feature>/components/SomeInternal`. Deep internal
imports create hidden coupling that breaks the moment the owning feature
refactors its internals. This is a strong preference, not yet an enforced
lint rule — until a feature has a real `index.ts`, there is nothing to
import from except internals, which is expected at this early stage.

## Avoiding premature abstraction

- Do not extract shared code into `src/lib` or `src/components/ui` until at
  least two real call sites need it. A single feature's helper belongs
  inside that feature.
- Do not create catch-all files (`helpers.ts`, `common.ts`, `misc.ts`, or
  similar). Prefer small, descriptively named files scoped to one
  responsibility.

## Do not pre-scaffold

Do not create a feature subfolder (`schemas/`, `stores/`, `generators/`,
etc.) or a feature's `index.ts` before there is real content to put in it.
An empty folder or a barrel file with nothing meaningful to export
documents nothing and adds noise. See
[repository-structure.md](./repository-structure.md) for which subfolders
currently exist versus which are described as future additions.

## Circular dependencies

Avoid them structurally by respecting the direction above rather than
detecting them after the fact. If two features seem to need each other,
that is a signal the shared concern belongs in `editor` (for orchestration)
or `lib`/`components/ui` (for a genuinely shared, feature-agnostic piece),
not that a cycle is acceptable.

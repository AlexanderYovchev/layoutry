# ADR-0003: Versioned Project File Format

**Status:** Accepted

**Date:** 2026-10-26

## Context

Layoutry keeps its document only in memory; closing or reloading loses
it. Browser storage, desktop `.layoutry` files and later cloud storage all
need one persisted representation. A file format is hard to change once
users hold files in it. Project files may also come from other people, so
they are untrusted input.

## Decision

- A single JSON envelope:
  `{ format: "layoutry-project", formatVersion, project, document }`.
  - `project` holds only the id, name and timestamps.
  - `document` is the editor's existing `EditorElementNode` tree,
    unchanged. There is no second model and no conversion layer.
- An explicit integer `formatVersion` (currently 1), handled by a simple
  version dispatcher.
  - Newer versions are refused, never loaded best-effort.
  - Migrations upgrade one step at a time and may never drop authored
    content.
- Strict validation on load with Zod, the repository's existing
  dependency.
  - Every object is strict: unknown fields are rejected.
  - Compile-time drift guards tie the schema to the TypeScript model.
  - Size, depth and count limits are enforced, and prototype-pollution
    keys are rejected.
  - Untrusted text is pre-scanned iteratively before any recursive
    validation.
- A new `src/features/project` feature owns the format, serialization,
  loading and limits. It depends on `editor` (types, schema, rules);
  `editor` never depends on it.
- The editor store gains one atomic `replaceDocument` and a
  reference-based saved baseline for dirty tracking. History is
  snapshot-based and immutable, so reference identity is exact.

## Consequences

**Positive:**

- One format for every storage target.
- Loading is pure and all-or-nothing, so a bad file cannot corrupt the
  open document.
- Schema/model drift is caught at compile time.
- Canonical key ordering gives deterministic files and clean diffs.

**Negative / tradeoffs:**

- Every new authored field requires a format version bump and, from
  version 2 on, a migration step.
- The strict schema rejects files that an older, more permissive reader
  might have accepted. This is intentional, because accepting them would
  silently lose data.

## Alternatives considered

- **Serializing the whole Zustand store:** it would persist session state
  (selection, history, Preview), couple files to UI internals, and make
  them huge.
- **A flat node map instead of the nested tree:** it would introduce a
  second document model and a conversion layer, with no current benefit.
- **Lenient parsing that drops unknown fields:** silent data loss on
  re-save.
- **A migration framework library:** no concrete need for version 1; a
  switch-based dispatcher is enough.

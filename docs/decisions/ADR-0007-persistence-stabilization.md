# ADR-0007: Persistence Stabilization: Snapshot Worker and Migration Chain

**Status:** Accepted

**Date:** 2026-10-27

## Context

PROJECT-1.5 audited the whole persistence subsystem (ADR-0003 to
ADR-0006) before broader alpha testing. Three findings needed decisions
rather than plain fixes:

1. **Recovery snapshots stalled the editor.** They ran without the user
   asking, and caused two main-thread stalls of 160–490 ms each on large
   projects. Profiling the real app showed two causes:
   - serialization with its loader self-check (mostly Zod), plus UTF-8
     encoding for the hash;
   - a full re-render of every Canvas node on each recovery status change.
     `EditorApp` gave dnd-kit a new sensor-options object every render.
2. **The format version dispatcher was a `switch`** that only ever passed
   version 1 through. A future migration had no contract and no tests.
3. **The native write's check-to-replace window** spanned the whole
   temporary write and flush.

## Decision

- **Prepare recovery snapshots in a dedicated Web Worker:**
  - The page posts a structured clone of the captured state, and the
    worker runs the very same `prepareRecoverySnapshot` (serializeProject
    with its self-check, then SHA-256).
  - The coordinator keeps ordering, generations, deduplication and
    storage, so the worker adds no new consistency rules.
  - Any worker trouble (absent, failed start, crash, malformed answer, no
    answer within 60 s) falls back to the same code on the page. Recovery
    never depends on the worker.
- **Fix the re-render at its source:**
  - one constant sensor-options object;
  - stable panel elements in `EditorApp`.
- **Make the dispatcher a step chain** (`migrateProjectFile`) with a
  written contract and tests on synthetic versions. Format 1 stays the
  only real format, and no speculative fields are invented. Frozen
  fixtures from PROJECT-1.1/1.2/1.4 pin compatibility.
- **Re-check the destination right before the rename**, keeping the early
  check. Document the remaining window honestly instead of claiming it is
  closed.
- **Decode project bytes as strict UTF-8** in both runtimes: skip a BOM,
  refuse invalid bytes rather than replace them.

## Consequences

- **Snapshots** no longer produce any task over 50 ms at 5,000 elements,
  10 MB or the node limit.
- **Saves** got 3–4× faster on large projects, because of the re-render
  fix (see project-recovery.md, Performance).
- **The worker** is one more bundle entry. Turbopack compiles
  `new Worker(new URL(…, import.meta.url))` into its own bootstrap, served
  under the existing CSP (`worker-src 'self'`). It also copies the source
  `.ts` into `static/media`: a few kilobytes, never executed.
- **Memory:** while the worker prepares a snapshot, it holds one clone of
  the document.
- **Saves** still serialize on the page (86–360 ms stalls on very large
  projects). They are user-initiated and show "Saving", so this was left
  as is. The same worker could take them on later.
- **Format 2** must still choose how the first save of a migrated file is
  confirmed (see project-format.md).
- **The narrowed write race** is still a race, a documented limitation.

## Alternatives considered

- **Incremental hashing or serialization:** the cost is the loader
  self-check (Zod over the whole document), which isn't incremental.
  Skipping it would weaken snapshot validation, which the brief forbids.
- **Leave serialization on the main thread:** the stalls were real and
  automatic, not user-initiated.
- **Hold the destination open with an exclusive sharing mode during the
  write:** Node can't open a file with `FILE_SHARE_DELETE` while denying
  writers, which the replace would need. A native module would add a
  binary dependency to a portable app.

## Date

2026-10-27

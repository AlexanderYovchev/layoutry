# ADR-0004: Browser Project Library in IndexedDB

**Status:** Accepted

**Date:** 2026-10-26

## Context

PROJECT-1.1 defined the `.layoutry` format but nothing could store it.
Users need New, Save, Save As, Open, Import, Download, Rename and Delete in
the browser, and the same build runs inside the Electron desktop app. Native
desktop files come later (PROJECT-1.3) and must not require rewriting the
editor.

## Decision

- **IndexedDB is the browser project library.**
  - The database is versioned (`layoutry-projects`, version 1).
  - There are two object stores, `summaries` and `documents`, written
    together in one transaction.
  - It stores the canonical `.layoutry` text. Nothing is kept in
    `localStorage`.
- **A small `ProjectRepository` interface separates storage from
  everything else.**
  - Commands, the workflow and the UI only use the interface.
  - The IndexedDB adapter is about 300 lines of plain IndexedDB API code,
    with no wrapper library.
- **The active project session lives in its own store** in the project
  feature: identity, metadata baseline and library revision. The editor
  store keeps only the document and its own baseline.
- **Saved baselines are set only after a write completes**, and only to the
  exact snapshot written. Library operations are serialized per tab.
  Optimistic `updatedAt` revisions, checked inside the write transaction,
  stop one tab overwriting another tab's newer save.
- **Imports:**
  - a file whose id is new to the library keeps its id;
  - a colliding id is imported as a copy by default, or replaces the
    existing project only on explicit request.
- **The editor stays independent:** `ProjectWorkspace` (in the project
  feature) wraps `EditorApp` and passes plain props, so `editor` never
  imports `project`.
- **Desktop close:** the Electron main process keeps its own close
  confirmation and handles `will-prevent-unload`, so the page's
  `beforeunload` can't trap a dirty window.

## Consequences

**Positive:**

- Save/Open works in every modern browser and unchanged in the desktop app.
- A failed or interrupted save never corrupts a stored project or clears
  unsaved state.
- PROJECT-1.3 and a future cloud store plug in behind the same interface.

**Negative / tradeoffs:**

- Browser projects are tied to one browser profile, and clearing site data
  deletes them. The UI and docs recommend `.layoutry` downloads as backups.
- The desktop close prompt still appears even when everything is saved,
  until PROJECT-1.3 adds IPC.
- `fake-indexeddb` was added as a dev dependency, so the real adapter can
  be unit-tested with spec-compliant transactions.

## Alternatives considered

- **localStorage:** synchronous, about 5 MB, strings only, and no
  transactions across records.
- **A wrapper library (idb, Dexie):** not needed for four operations; the
  plain API with one transaction helper is small and fully tested.
- **File System Access API:** Chromium-only, and permission prompts on
  every open. Downloads plus imports cover portability everywhere.
- **Persisting the editor store with a Zustand middleware:** it would
  autosave session state and blur the line between saved and unsaved work.

# ADR-0006: Recovery Snapshots Separate From Saves

**Status:** Accepted

**Date:** 2026-10-28

## Context

Until PROJECT-1.3, unsaved work was lost on a crash, a killed process, a
Windows restart, a browser tab killed by the OS, or an accidental close.
Users need recent work back after these. Two things must not change:
"Saved" means the user saved it, and the PROJECT-1.2/1.3 conflict
protections hold (library revisions, file fingerprints).

## Decision

- **Snapshots, not autosave.** Unsaved work is copied automatically to
  separate recovery storage. It is never written to the project's own
  destination. Snapshots never clear unsaved changes, never change the
  project's location, and never claim the project is saved.
- **One coordinator, two adapters.** A platform-independent coordinator in
  the project feature owns scheduling and policy. A `RecoveryStorage`
  interface has an IndexedDB adapter (browser) and a main-process adapter
  (desktop, five fixed IPC channels in the PROJECT-1.3 style).
- **Timing:** a 2 s debounce and a 30 s maximum wait, plus an immediate
  snapshot when the page is hidden or loses focus. Snapshots are never
  taken mid-drag or for UI-only changes.
- **Format:** the canonical `.layoutry` text inside a small versioned
  record (`recoveryVersion` 1), with a SHA-256 of the text. There is no
  second document schema.
- **Sessions:** every page load is a session. In the browser it is bound to
  a Web Lock, and in the desktop app to the window in the main process. A
  session's snapshots are offered only after it has ended, and in a browser
  only to the one tab that claims them.
- **Browser storage:** a separate IndexedDB database (`layoutry-recovery`),
  so the PROJECT-1.2 library database is never upgraded.
- **Desktop storage:** an app-owned `Recovery` folder in the profile, using
  the same atomic replace as project files.
- **Retention:**
  - at most 5 snapshots per project per session;
  - 128 Mi characters (browser) or 256 MiB (desktop) in total, and 100
    records;
  - never the newest snapshot of a project;
  - never another running session's snapshots.
- **Cleanup:**
  - a session's snapshots go when its project has no unsaved changes;
  - an explicit Don't Save removes them;
  - the user can Discard them;
  - nothing else deletes them.
- **Restore never bypasses conflicts.** A library project restores with the
  revision the crashed session last saw. A file project restores with a
  fresh main-process token whose expected version is the pre-crash
  fingerprint. Nothing is written back automatically.

## Consequences

**Positive:**

- Crashes, kills, Windows restarts and accidental closes lose at most the
  last 2–30 s of edits.
- The meaning of "Saved", conflict detection and the saved project data
  are unchanged.
- Multiple tabs can't overwrite or double-restore each other's work.

**Negative / tradeoffs:**

- Recovery data lives on this device only. It is not encrypted, and not a
  backup.
- Serialization still runs on the renderer thread (about 0.2 s at 10 MB,
  at most every 2–30 s).
- Recovery needs a secure context in browsers (Web Locks, Web Crypto).
  Plain-http deployments show "Recovery unavailable".
- The desktop retention policy is written twice, in `desktop/` and `src/`,
  because the two may not import each other. Tests pin both to the same
  behaviour.

## Alternatives considered

- **True autosave to the project destination:** blurs saved versus
  unsaved, could overwrite files changed elsewhere, and can't be undone
  for the user's real file.
- **localStorage:** a small quota, synchronous, and string-only; the full
  documents don't fit.
- **One shared recovery slot per project:** two tabs would overwrite each
  other, and an old write could replace a newer one.
- **Heartbeat timestamps to detect dead tabs:** guesswork about clocks and
  sleeping tabs. Web Locks are released by the browser itself when a tab
  dies.
- **Upgrading the library database:** an older open tab would block the
  upgrade and break saving.
- **A Web Worker for serialization:** the document must be cloned to the
  worker on the main thread, which costs about the same as serializing.
  Not justified at measured sizes.

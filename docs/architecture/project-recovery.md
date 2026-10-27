# Project Recovery (Automatic Recovery Snapshots)

How Layoutry keeps recent unsaved work recoverable after a crash, a killed
process, a Windows restart or an accidental close (PROJECT-1.4). Saving is
described in [project-storage.md](./project-storage.md) (browser) and
[desktop-files.md](./desktop-files.md) (desktop). The decision is recorded
in [ADR-0006](../decisions/ADR-0006-recovery-snapshots.md).

**Recovery snapshots are not saves.** A snapshot is a separate copy of
unsaved work in recovery storage. It never replaces a library record or a
`.layoutry` file, never clears "Unsaved changes", never changes where the
project is saved, and never bypasses conflict detection. Recovery is
bounded and best effort. It is not a backup and not version history.

```text
Editor + project session ──► recovery coordinator (src/features/project/commands/recoveryCoordinator.ts)
                                   │  serializeProject → SHA-256 → one write at a time
              browser ─────────────┴──────────────── desktop
                 │                                      │
   IndexedDB "layoutry-recovery"          window.layoutryDesktop (5 recovery functions)
   + Web Locks (live tabs)                              │  5 fixed, validated IPC channels
                                                        ▼
                                  main process: <userData>\Recovery\*.layoutry-recovery
```

## Where things live

| Concern                                           | Code                                                                    |
| ------------------------------------------------- | ----------------------------------------------------------------------- |
| Scheduling, capture, ordering, cleanup, discovery | `src/features/project/commands/recoveryCoordinator.ts`                  |
| Timing and retention policy                       | `src/features/project/rules/recoveryPolicy.ts`                          |
| Record types and validation                       | `types/recoveryRecord.ts`, `schemas/recoveryRecordSchema.ts`            |
| Storage boundary                                  | `storage/recoveryStorage.ts`                                            |
| Browser storage                                   | `storage/indexedDbRecoveryStorage.ts`, `storage/recoveryLocks.ts`       |
| Desktop adapter (Zod-validated bridge results)    | `desktop/desktopRecoveryStorage.ts`                                     |
| Restore/Keep/Discard flows                        | `commands/projectWorkflow.ts`, `components/RecoveryDialog.tsx`          |
| Header status                                     | `stores/useRecoveryStore.ts` → `ProjectIdentity` ("Recovery protected") |
| Desktop record file and retention                 | `desktop/recovery/recoveryRecord.ts`                                    |
| Desktop folder access                             | `desktop/recovery/recoveryStore.ts`                                     |
| Desktop sessions, payload checks, original file   | `desktop/recovery/recoveryService.ts`                                   |

## Sessions

Each page load of the editor is one **session**: a browser tab, or the
desktop window's page.

- **Browser:** the tab picks a random 128-bit session id and holds a Web
  Lock named `layoutry-recovery-session:<id>` while the page lives. The
  browser releases the lock when the tab closes, crashes or the browser
  dies.
- **Desktop:** the main process creates the session id and binds it to the
  window. A session ends when its page crashes or reloads, or the window
  closes.

A session's snapshots belong to it alone. When it ends, they become
**orphaned**, and those are what the next start offers. Another running
session's snapshots are never listed, read for restore or deleted.

## Scheduling

| Rule                                                      | Value / behaviour                                                      |
| --------------------------------------------------------- | ---------------------------------------------------------------------- |
| Quiet time after the last change                          | 2 s                                                                    |
| Longest wait during continuous editing                    | 30 s                                                                   |
| Page hidden, window blurred, `pagehide`                   | Snapshot started at once (not awaited; storage can't finish in unload) |
| Drag, resize or drawing in progress                       | Wait until it ends (re-checked every 0.5 s)                            |
| No unsaved changes                                        | Nothing is written                                                     |
| UI-only changes (selection, hover, panels, Preview, Snap) | Never trigger a snapshot                                               |
| Storage failed                                            | Status "Recovery unavailable"; retried after 30 s                      |

Intervals are injectable (`timing`, `clock`) for deterministic tests.

**Edits made after the last completed snapshot can be lost** when the
process dies abruptly: up to about 2 s of quiet editing, or up to 30 s
during continuous editing.

## Snapshot consistency

- **Coherent:** the document, the project metadata and the location are
  read together in one tick. The snapshot is `serializeProject` of exactly
  that state. Serialization self-checks with the real loader, so an
  invalid snapshot is never written.
- **Integrity:** the text is hashed (SHA-256 of its UTF-8 bytes, Web
  Crypto). On desktop the main process recomputes the hash and refuses a
  mismatch, and every read re-verifies length and hash.
- **Ordered:** one recovery operation runs at a time. Each snapshot has a
  higher generation than the last (assigned at capture). Storage refuses
  an older or repeated generation (`stale`), checked inside the same
  IndexedDB transaction or synchronously in the main process.
- **Deduplicated:** if the state is unchanged (same document, metadata and
  location objects), nothing happens. If the content is identical (same
  hash and source, for example a change and its reversal), nothing is
  written.
- **No side effects:** history, selection, the saved baseline and the
  location are never touched.

## Recovery record

Version 1. The project text inside is the canonical `.layoutry` text
(PROJECT-1.1). **`recoveryVersion` versions only the record around it;**
the project text carries its own `formatVersion` and goes through the
normal loader and migrations. A record from a newer Layoutry is reported as
"made by a newer version" and kept, never deleted automatically.

| Field                              | Meaning                                                                             |
| ---------------------------------- | ----------------------------------------------------------------------------------- |
| `recordId`                         | `<sessionId>-<generation>`. Never a path.                                           |
| `sessionId`, `generation`          | The session, and the order within it.                                               |
| `projectId`, `projectName`         | From the project text itself (desktop: never from the payload).                     |
| `savedAt`                          | When the snapshot was committed (ISO 8601 UTC).                                     |
| `source`                           | `unsaved`; `library` + the `revision` the session last saw; `file` + the file name. |
| `size`, `sha256`                   | Length and hash of the project text.                                                |
| `association` (desktop, main only) | The file path and the fingerprint of the version the session last read or wrote.    |

No path is ever inside the project text, and the renderer never receives
`association`.

## Browser storage

- **Database:** `layoutry-recovery`, version 1, kept separate from the
  project library. `layoutry-projects` is never upgraded or touched, so
  PROJECT-1.2 projects can't be affected and an old tab can't block an
  upgrade of the library.
- **Stores:**
  - `summaries` (key `recordId`): the record without its text;
  - `texts` (key `recordId`): `{ recordId, text }`.
- **Transactions:** a snapshot and its retention pass are one
  transaction. A failure (`QuotaExceededError`, abort) commits nothing.
- **Upgrades:** future versions add steps in `onupgradeneeded`. A database
  upgraded by a newer Layoutry is reported as unavailable, and nothing is
  deleted. A blocked upgrade is reported as `blocked`.
- **Unavailable:** no IndexedDB, no Web Locks or no Web Crypto (an insecure
  `http:` origin other than localhost). Recovery is then off; the header
  says "Recovery unavailable" while there are unsaved changes, and the
  editor works normally.
- **No localStorage:** whole documents never go to `localStorage`.

## Desktop storage

- **Folder:** `<user data>\Recovery`, normally
  `%APPDATA%\Layoutry\Recovery`. It is owned by the app and needs no
  elevation. It is never next to the user's `.layoutry` files, and never in
  the app folder (the packaged test checks the extracted folder is
  unchanged).
- **One file per snapshot:** `<recordId>.layoutry-recovery`.
  - Line 1 is the header JSON; the rest is the project text, byte for
    byte.
  - Listing reads only the header.
  - Header `textBytes` must match the file size exactly, so a truncated
    record is detected without reading it all.
- **Writes** reuse the project-file atomic replace (`replaceFileAtomically`):
  exclusive temp file, write, fsync, rename, read-back hash. Temp files of
  interrupted writes (`.<recordId>.<hex>.recovery-tmp`) are removed at
  startup. Only one Layoutry runs per profile.
- **Safety:**
  - record ids are validated before they become file names;
  - the folder must be a real directory, not a junction or link;
  - links inside it are never followed;
  - anything else in the folder is ignored.
- **IPC:** five fixed channels (begin session, write, list, read,
  discard), with sender checks as in PROJECT-1.3. Payloads are checked
  strictly:
  - exact keys;
  - generation 1–999,999,999;
  - SHA-256 hex;
  - project-shaped text of at most 16 Mi characters;
  - `source` limited to `unsaved` / `library` + revision / `file` + token
    - file name.
- **The renderer never names a file.** For a file project, the main
  process takes the path and the last-seen fingerprint from the window's
  own capability token, never from the payload.

## Retention

| Limit                              | Browser           | Desktop         |
| ---------------------------------- | ----------------- | --------------- |
| Snapshots per project, per session | 5 newest          | 5 newest        |
| Global budget                      | 128 Mi characters | 256 MiB on disk |
| Records                            | 100               | 100             |

- **Why these numbers:** the budget holds five snapshots of even the
  largest project the loader accepts (16 Mi characters, up to 48 MiB of
  UTF-8). Real projects are kilobytes to a few megabytes.
- **When retention runs:** right after a snapshot commits, in the same
  transaction (browser) or right after the rename (desktop):
  1. the writing session keeps its 5 newest snapshots per project;
  2. over the budget, the oldest go first: first snapshots that are neither
     the newest nor the second newest of their project, then second-newest
     ones.
- **Never deleted by retention:**
  - the newest snapshot of any project;
  - the snapshot just written;
  - another running session's snapshots;
  - damaged records (the user discards those);
  - saved projects and files.
- **Cleanup:** this session's snapshots are deleted when the project has no
  unsaved changes any more, which is proof the saved copy holds the work
  (see Manual Save integration). Others only go when the user chooses
  Restore or Discard.
- **No expiry:** snapshots are not deleted just because a newer session
  started or time passed.

## Startup detection

1. The session starts (lock or main-process session).
2. The orphaned records are listed. Each orphaned session and project is
   one group.
3. Each group is claimed. In a browser that means holding its session's
   lock, so two tabs started together never offer the same work: one gets
   it.
4. Each group's newest version is validated: read, hash, `parseProjectFile`,
   project id. If it fails, the next newest is tried, and failed versions
   are marked damaged.
5. Work that was in fact saved is dropped silently. This happens after a
   crash between Save and cleanup:
   - **desktop:** the main process compares the file's id, name and
     document with the snapshot (`matchesOriginal`);
   - **browser library projects:** the stored library project is compared
     the same way.
6. Anything left is offered in the recovery dialog before anything else
   opens. A `.layoutry` file named on the command line opens after the
   dialog is answered.

Nothing is restored, replaced or deleted without a choice. The same scan
runs again from **File › Recover Unsaved Work…**.

## Recovery dialog

- **For each group it shows:**
  - the project name;
  - when it was recovered;
  - where it came from: "Never saved", the library, or "From the file
    X.layoutry", never a path;
  - the saved copy's state when it can be checked: "hasn't changed since
    then", "has changed since then. Restoring never overwrites it", or
    "can't be found any more";
  - a **Version** choice when there are several; damaged versions are
    disabled.
- **Restore:**
  1. The chosen version is validated again.
  2. If the open project has unsaved changes, it goes through the usual
     Save / Don't Save / Cancel.
  3. The document is replaced atomically: history, selection and
     transient state are reset.
  4. The restored work keeps its project id and is marked unsaved
     (`savedName = null`).
  5. The work is snapshotted again in this session; only then are the old
     session's copies removed.
- **Keep for Later:** closes the dialog; everything stays. Escape and the
  close button do the same.
- **Discard…:** asks "Discard this recovered work permanently?" first.
- **Damaged work:** can only be discarded.

### Where a restored project saves

| Source      | Location after restore                                                                                                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Never saved | Unsaved: Save asks where (browser: a name; desktop: the Save dialog).                                                                                                                                         |
| Library     | The library project with the **revision the crashed session last saw**. If another tab saved since, Save reports "Project changed elsewhere… Use Save As". A deleted record is recreated, as in PROJECT-1.2.  |
| Native file | The original file, **re-authorized by the main process with the fingerprint of the version the crashed session last saw**. If the file changed or vanished since, Save shows the PROJECT-1.3 conflict dialog. |

Save As always remains available. Recovered content is never written to
the original destination automatically.

## Manual Save integration

- **Successful save:** the editor's saved baseline catches up with the
  document, the project has no unsaved changes, and the coordinator deletes
  this session's snapshots up to that moment, generation by generation.
  - Edits made during the save keep the project unsaved, so their
    snapshots stay.
  - Other sessions' snapshots are never touched.
- **Failed save:** nothing changes, and all snapshots stay.
- **Save As:** the new identity is snapshotted under its new id. The old
  id's snapshots of this session go once everything is saved, because the
  work now lives in the new file.
- **Ordering:** cleanup runs in the same one-at-a-time queue as snapshots,
  so it never races a write.

## Clean shutdown vs crash

| Case                                                    | Policy                                                                                                                                                      |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Saved project closed                                    | Nothing left: this session's snapshots were deleted when it was saved.                                                                                      |
| Close → **Don't Save** (desktop)                        | The coordinator shuts down (no snapshot may start), then all of this session's snapshots are deleted, then the window closes. Other sessions are untouched. |
| New / Open / Import / Restore → **Don't Save**          | After the switch succeeds, this session's snapshots up to that moment are deleted.                                                                          |
| Close with unsaved work in a browser tab ("Leave page") | Snapshots stay; offered next time. The browser can't tell us what was chosen, so uncertain data is kept.                                                    |
| Crash, killed process, browser killed, Windows restart  | Snapshots stay; offered next time.                                                                                                                          |
| Save succeeded but cleanup didn't (crash in between)    | Recognized at the next start as already saved and dropped silently.                                                                                         |
| Renderer crash (desktop)                                | The session ends; the native fallback dialog says recent changes are offered at the next start.                                                             |

## Multi-tab and multi-session

- **Browser:**
  - **Separate records:** every tab writes its own records (session id in
    the key), so tabs never overwrite each other's snapshots, even for the
    same project id.
  - **Locks:** a running tab's lock keeps its snapshots private.
  - **Claims:** claiming ended sessions makes the offer exclusive.
  - **Saving:** ordinary library Save conflict protection (revision check)
    still applies.
- **Desktop:**
  - **Single instance:** there is one window per profile. A second launch
    forwards to it.
  - **Sessions:** a reloaded or crashed page gets a new session; the old
    one is orphaned and offered once.

## Failure handling

| Failure                                        | What happens                                                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| IndexedDB, Web Locks or Web Crypto unavailable | Recovery off; "Recovery unavailable" (with the reason) while unsaved. Editing and saving work normally. |
| Quota exceeded / disk full                     | Nothing committed; status unavailable; retried after 30 s; earlier snapshots intact.                    |
| Recovery folder missing rights, or a junction  | Unavailable; the folder is never used through a link.                                                   |
| Interrupted write                              | Temp file removed at next start; a truncated record is detected and offered only for discarding.        |
| Corrupted record or hash mismatch              | Marked damaged. The next older valid version is offered; damaged-only work can only be discarded.       |
| Newer project format or newer record version   | "Made by a newer version of Layoutry"; kept.                                                            |
| Original file modified or missing              | Shown in the dialog; Save after restore shows the conflict dialog.                                      |
| Failed cleanup                                 | Snapshots kept and retried later; never deleted on doubt.                                               |
| Save fails after restore                       | The work stays unsaved and protected.                                                                   |

## Status in the header

| Shown                  | Meaning                                                                 |
| ---------------------- | ----------------------------------------------------------------------- |
| Saved                  | Manually saved; nothing unsaved.                                        |
| Unsaved changes        | Not saved.                                                              |
| + Recovery protected   | Unsaved, but the latest changes have a recovery copy on this device.    |
| + Recovery unavailable | Unsaved, and no recovery copy can be made right now (tooltip says why). |

There is no toast per snapshot. Restoring, keeping and discarding show one
short toast each.

## Security limits

- **No Node.js in the renderer,** and no path in either direction. The
  renderer only names record ids (validated by pattern), and the main
  process enforces session ownership.
- **Recovery data is user-private application data in the profile.** It is
  readable by the same Windows user, like the PROJECT-1.2 desktop library.
  It is not encrypted.
- **Tampering with `association`:** a process able to edit the Recovery
  folder could point a record at another `.layoutry` path. Restoring would
  then name that file in the header, and Save would still be refused unless
  that file's content matches the recorded fingerprint. Such a process can
  already write the user's files directly.

## Performance

Measured on the development machine (Windows 10, Electron 44), real app,
from the moment a snapshot was triggered (window blur) to "Recovery
protected":

| Project                             | Snapshot latency | Longest main-thread task |
| ----------------------------------- | ---------------- | ------------------------ |
| 500 elements (0.03 MB)              | 51–69 ms         | < 50 ms (none reported)  |
| 5,000 elements (0.3 MB)             | 263–281 ms       | 155–164 ms               |
| 5,000 elements, long texts (9.7 MB) | 463–516 ms       | 191–214 ms               |

- **Desktop store (Vitest, real disk):**
  - header scan of 100 records: 59 ms;
  - verified 10 MB read: 19 ms;
  - 10 MB snapshot write including the retention scan: 260 ms;
  - write plus retention pass at 101 records: 366 ms.
- **Browser:** recovered work is offered about 0.4 s after the editor
  hydrates (dev server; includes IndexedDB open, scan, read, hash and
  validation).
- **Memory:** no copies of the document are kept. The coordinator holds
  references to the last captured state. During a snapshot, one serialized
  text exists (about 2 bytes per character in the renderer, plus one IPC
  copy on desktop) and is released afterwards.
- **Blocking:** serialization and its self-check run on the renderer
  thread, about 0.2 s at 10 MB, at most once per 2–30 s and never per
  keystroke. Snapshots are never taken mid-drag.

A Web Worker could take serialization off the main thread. It isn't
justified yet: it would need the document cloned to the worker, which
costs about the same on the main thread. Revisit if real projects grow far
beyond 10 MB.

## Backing up projects yourself

Recovery copies are kept on this device only and aren't backups. To keep
backups, save `.layoutry` files (desktop) or use **Download Project**
(browser), and copy those files to another drive or a synced folder.

## Testing

| Layer                                                                                   | Where                                                                           |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Scheduling, ordering, dedup, cleanup, close, discovery                                  | `commands/recoveryCoordinator.test.ts` (deterministic clock, injected failures) |
| Restore / Keep / Discard / Don't Save / conflicts / CLI                                 | `commands/projectRecoveryWorkflow.test.ts` (fake-indexeddb, simulated tabs)     |
| Browser storage, tabs, claims, corruption, quota, versions                              | `storage/indexedDbRecoveryStorage.test.ts`                                      |
| Dialog, header, startup in the workspace                                                | `components/RecoveryDialog.test.tsx`, `ProjectWorkspace.recovery.test.tsx`      |
| Desktop format, retention, folder, junctions, failures                                  | `desktop/recovery/*.test.ts` (real temp folders)                                |
| IPC allowlist and preload surface                                                       | `desktop/ipc/registerDesktopIpc.test.ts`                                        |
| Real Chromium: killed browser, tabs, corruption, Keep/Discard                           | `e2e/project-recovery.spec.ts`                                                  |
| Real Electron: renderer crash, killed app, conflict, interrupted write, IPC             | `e2e/desktop/recovery.spec.ts`                                                  |
| Packaged `Layoutry.exe`: killed app, renderer crash + native fallback, real Save dialog | `e2e/packaged/recovery.spec.ts`                                                 |

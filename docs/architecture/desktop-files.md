# Desktop Project Files (`.layoutry` on Windows)

How the desktop app opens and saves native `.layoutry` files (PROJECT-1.3).
The file format is described in [project-format.md](./project-format.md).
The browser library is described in [project-storage.md](./project-storage.md).
The decision is recorded in
[ADR-0005](../decisions/ADR-0005-native-project-files.md).

```text
Editor ─► project workflow / commands ─► serializeProject / parseProjectFile
                                   │
              browser ─────────────┴──────────────── desktop
                 │                                      │
        IndexedDB library             window.layoutryDesktop (preload, sandboxed)
                                                        │  7 fixed IPC channels
                                                        ▼
                                      main process: capability tokens, native
                                      dialogs, atomic writes ─► .layoutry files
```

## Where things live

| Concern                                     | Code                                                                   |
| ------------------------------------------- | ---------------------------------------------------------------------- |
| Reading, fingerprinting and atomic writing  | `desktop/files/projectFileSystem.ts`                                   |
| Opaque per-window file tokens               | `desktop/files/fileCapabilities.ts`                                    |
| Payload validation and dialog orchestration | `desktop/files/projectFileService.ts`                                  |
| Command-line / second-launch files          | `desktop/files/launchArguments.ts`                                     |
| The IPC surface and sender checks           | `desktop/ipc/channels.ts`, `desktop/ipc/registerDesktopIpc.ts`         |
| The page-facing bridge                      | `desktop/preload/preload.ts`                                           |
| Close decisions                             | `desktop/main/closeCoordinator.ts` (with `closeGuard.ts`)              |
| Renderer adapter (Zod-validated results)    | `src/features/project/desktop/desktopProjectFiles.ts`                  |
| File commands and flows                     | `saveToFile`, `openFile` in `projectCommands.ts`; `projectWorkflow.ts` |

## Security boundary

- **The renderer never sees or sends a path.**
  - Paths come only from the native dialogs or the command line.
  - The main process keeps them and gives the page a random 128-bit token
    plus the bare file name.
  - A token works only for the window it was issued to; at most 32 per
    window are kept.
  - Tokens are revoked when the window closes or its renderer crashes.
- **The bridge is fixed.** `window.layoutryDesktop` is a frozen object of
  nine functions plus `apiVersion`. There is no `ipcRenderer`, no generic
  `invoke` and no Node.js.
- **The preload is sandboxed:** `sandbox: true`, `contextIsolation: true`,
  `nodeIntegration: false`, and it can only `require("electron")`. It runs
  in the top frame only. Fuses and CSP are unchanged.
- **Each IPC call is checked twice:**
  - **Sender:** the main window's own top frame, still on
    `app://layoutry/`. Anything else is refused.
  - **Payload:** exactly the expected keys and types; tokens must match
    `[0-9a-f]{32}`; text is at most 16 Mi characters and must parse as
    JSON with `format: "layoutry-project"`. A suggested file name is reduced
    to a bare, sanitized file name, so the dialog's default folder can't be
    steered.
- **Paths are checked:**
  - absolute, ending in `.layoutry`, no NUL characters;
  - opening and saving refuse a symbolic link or junction at the file
    itself;
  - size is checked before reading (48 MiB = 16 Mi characters × 3 bytes);
  - a name typed without the extension gets `.layoutry` added, but only if
    that file doesn't exist yet, because the dialog didn't confirm
    replacing it.
- **Project content is still untrusted:** every opened file goes through
  `parseProjectFile` in the renderer, as in the browser.

## Save semantics (desktop)

| The project is…                             | Save (Ctrl+S)                                                                                  | Save As (Ctrl+Shift+S)                                                                                                                                            |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New (never saved)                           | Native Save dialog. Writes a file and keeps the project id. The project takes the file's name. | Same as Save.                                                                                                                                                     |
| Opened from / saved to a file               | Writes back to that file, with no dialog. Keeps id and `createdAt`; advances `updatedAt`.      | Native Save dialog. Writes a **new project identity** (new id) to the new file and switches to it only after the write succeeded. The original file is untouched. |
| From the Desktop Library (saved before 1.3) | Saves to the library, as in PROJECT-1.2.                                                       | Writes a new identity to a native file. The library copy is untouched.                                                                                            |

- **Desktop library:** the desktop app no longer creates new library
  projects, so Save is never ambiguous. Existing library projects stay
  under **File › Open from Desktop Library…** until the user deletes them.
  There is no automatic migration and no deletion.
- **Save As identity:** Save As always creates a new identity, matching the
  browser library's Save As. A file and its Save As copy are therefore
  never confused as "the same project".
- **Header:** the file name (never a path), "Desktop library" or "Browser
  library" is shown next to the save status.

## Opening

- **Dialog:** **File › Open File…** (Ctrl+O) shows the native Open dialog,
  filtered to `.layoutry`. Cancel does nothing.
- **Order:** the file is read (size-checked), parsed and validated first,
  then the user is asked about unsaved changes. A bad file (invalid JSON,
  a newer format version, the wrong type, too large) shows an error and
  changes nothing.
- **Applying:** the document is replaced atomically (`replaceDocument`),
  history and transient state are reset, and the project is clean.

## Atomic write strategy

`writeProjectFileAtomically` never writes into the existing file:

1. **Check the destination** against the version this window last read or
   wrote: a SHA-256 of its content (see below). A destination just chosen
   in the Save dialog has no expected version, because the dialog already
   confirmed replacing it.
2. **Create a temporary file** in the same folder:
   `.<name>.<24 random hex>.layoutry-tmp`, created with exclusive create
   (`wx`), so it never reuses or follows an existing entry.
3. **Write all bytes**, then `fsync` the file (FlushFileBuffers), then
   close it.
4. **Replace the destination with `rename`.** On Windows this is
   `MoveFileExW` with `MOVEFILE_REPLACE_EXISTING`, which is atomic within
   one NTFS volume. `EPERM`/`EACCES`/`EBUSY` are retried 5 times (50 to
   800 ms) because antivirus scanners and indexers briefly hold new files.
   The original is **never deleted first**.
5. **On any failure**, the temporary file is removed and the destination
   keeps its previous bytes.
6. **Read the file back** and compare its hash. A mismatch is reported
   instead of a success.
7. **Only then** does the renderer mark the exact snapshot it serialized as
   saved.

Failure-injection tests cover each stage:

- temp creation (permission denied);
- the write (disk full, a partial write, a simulated crash);
- fsync;
- replace (`EBUSY`/`EPERM`, transient and permanent);
- read-back mismatch;
- a planted temp name.

Real-Windows tests cover a file held open exclusively by another process
and a read-only file. All of them assert that the original is
byte-identical and that no temp file is left behind.

**Limits, stated honestly:**

- **Power loss:** the rename is not issued with `MOVEFILE_WRITE_THROUGH`,
  and the folder is not flushed (Windows can't fsync a directory from
  Node). A power cut right after a save can therefore leave the previous
  version, but never a torn mix of the two. NTFS journals the rename.
- **Other file systems:** FAT/exFAT USB drives and network shares don't
  guarantee atomic replace. A failure there can still leave the temp file
  next to the project, which is harmless and removable.
- **Race window:** the content check and the rename are separate steps, so
  another program writing in the milliseconds between them can't be
  detected.
- **No backup copies yet:** there is no `.bak` and no autosave. That is
  PROJECT-1.4.

## External changes

- **Fingerprint:** each token remembers the SHA-256 and size of the version
  it last read or wrote.
- **Content, not timestamps:** a same-size, same-mtime replacement is still
  detected (tested).
- **Before every Save:**
  - **changed** → the "File Changed Outside Layoutry" dialog;
  - **moved or deleted** → "File Moved or Deleted".
- **Choices in both dialogs:**
  - **Cancel** is focused, and nothing has been written;
  - **Save As…** keeps both versions;
  - **Overwrite** / **Save Here Anyway** writes only after this explicit
    choice.
- **No merging:** documents are never merged automatically.

## Save races

Native saves use the same one-at-a-time queue as library saves
(PROJECT-1.2):

- the snapshot is taken after the Save dialog closes, and exactly that
  snapshot is marked saved;
- edits and renames made during a write stay unsaved;
- two quick saves run one after the other, and the second writes the
  latest document;
- a Save As that finishes after another project became active doesn't
  adopt its file, and gives the token back.

## Closing the window

- **Who decides:** the page reports "would closing lose work?" (unsaved
  changes, or a save in flight) to the main process. Closing a clean
  project needs no prompt.
- **Unsaved work:** the main process asks the page, which shows the
  editor's own **Save / Don't Save / Cancel**.
  - **Save** must succeed, which may include the Save dialog. A cancelled
    dialog, a conflict or an error keeps the window open.
  - **Don't Save** closes.
  - **Cancel** keeps the window.
- **Save in flight:** a close request waits for a pending save to finish
  before deciding.
- **Repeated close requests** are absorbed into one prompt.
- **Native fallback:** the native "discard unsaved changes?" warning
  appears only when the page can't answer: it never loaded its bridge,
  crashed, or hung.
- **`beforeunload`:** the page doesn't use it in the desktop app. The main
  process still ignores `beforeunload` once a close is approved, so the
  window can't be trapped.
- **Windows shutdown / sign-out** (`session-end`) closes without asking.
  Unsaved work is lost; crash recovery is PROJECT-1.4.

## File association

The alpha is a portable, unsigned ZIP. It doesn't install, and it doesn't
touch the registry. What works:

- **Command line:** `Layoutry.exe "C:\Work\Site.layoutry"` opens the file
  (relative paths resolve against the launching folder).
- **Explorer "Open with":** **Open with → Choose another app → browse to
  Layoutry.exe**. This is the user's own per-user association, made by
  Windows, not by Layoutry. Dragging a file onto `Layoutry.exe` also works.
- **A second launch with a file** (also via "Open with" while Layoutry is
  running) forwards it to the running window, which asks about unsaved
  changes first.

A real double-click association, with a file icon and "Open with" entry,
needs an installer and comes with a future signed release.

## Performance

Measured on the development machine (Windows 10, Electron 44), in the real
app:

| Project                                 | Open → rendered                     | Save As → written |
| --------------------------------------- | ----------------------------------- | ----------------- |
| 500 elements (~30 KB)                   | ~130 ms                             | ~120 ms           |
| 5,000 elements (0.3 MB)                 | ~1.4 s (Canvas rendering dominates) | ~0.6 s            |
| 5,000 elements with long texts (9.7 MB) | ~1.1 s                              | ~0.75 s           |

The main process alone writes a 40 MB file atomically in about 300 ms and
reads it in about 60 ms.

- **Off the renderer:** filesystem work happens only in the main process
  (async fs).
- **On the renderer:** serialization (including its self-check parse) runs
  on the renderer thread, so a save of a very large project pauses the
  editor for well under a second. Nothing serializes on keystrokes.

## Testing

| Layer                                             | Where                                                                 |
| ------------------------------------------------- | --------------------------------------------------------------------- |
| Filesystem, failure injection, real locks, 40 MB  | `desktop/files/projectFileSystem.test.ts` (Vitest, real temp folders) |
| Tokens, launch arguments, payload validation      | `desktop/files/*.test.ts`                                             |
| IPC allowlist, sender checks, preload surface     | `desktop/ipc/registerDesktopIpc.test.ts`                              |
| Close decisions                                   | `desktop/main/closeCoordinator.test.ts`                               |
| Renderer commands, workflows, UI (bridge faked)   | `src/features/project/**`                                             |
| Real Electron, scripted dialogs                   | `e2e/desktop/files.spec.ts`, `lifecycle.spec.ts`, `projects.spec.ts`  |
| Packaged `Layoutry.exe`, **real Windows dialogs** | `e2e/packaged/files.spec.ts`, `lifecycle.spec.ts`                     |

The packaged tests drive the genuine common file dialogs through Win32 (by
control id and class, never by localized captions), including Windows' own
"replace existing file?" confirmation.

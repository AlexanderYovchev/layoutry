# Project Storage and Project Management

How Layoutry saves, opens, imports and downloads projects (PROJECT-1.2).
The file format itself is described in [project-format.md](./project-format.md).
The decision is recorded in
[ADR-0004](../decisions/ADR-0004-browser-project-library.md).

- **Code:** `src/features/project/`
- **Entry point:** `ProjectWorkspace` wraps the editor (`src/app/page.tsx`).

## Layers

| Layer               | Owns                                                                | Files                                                                                     |
| ------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Project domain      | Active project identity, saved baselines, the operations themselves | `stores/useProjectStore.ts`, `commands/projectCommands.ts`                                |
| Persistence adapter | Storage reads/writes, availability, storage errors                  | `storage/projectRepository.ts` (interface), `storage/indexedDbProjectRepository.ts`       |
| UI integration      | Menus, dialogs, confirmations, shortcuts, notices                   | `commands/projectWorkflow.ts`, `stores/useProjectDialogStore.ts`, `components/`, `hooks/` |

Rules that keep the layers apart:

- **Commands never show UI.** They return `{ ok }` results. The workflow
  decides which dialog comes next.
- **The repository never parses documents.** It stores the canonical text
  produced by `serializeProject`. Every read goes back through
  `parseProjectFile`.
- **No storage code in the Canvas or Inspector.** The editor feature never
  imports the project feature. `ProjectWorkspace` passes the File menu
  commands, the project name and status, and the dialogs into `EditorApp`
  as plain props.

PROJECT-1.3 added native `.layoutry` files for the desktop app as a
separate, file-based flow (`saveToFile` / `openFile`) over a narrow
preload bridge, without touching the editor — see
[desktop-files.md](./desktop-files.md). In a browser everything below is
unchanged.

## Browser library: IndexedDB schema

- **Database:** `layoutry-projects`, version **1**.
- **Object stores:**

  | Store       | Key  | Value                                           |
  | ----------- | ---- | ----------------------------------------------- |
  | `summaries` | `id` | `{ id, name, createdAt, updatedAt }`            |
  | `documents` | `id` | `{ id, text }` — the canonical `.layoutry` text |

- Listing reads only `summaries`, so it never loads whole projects (which
  may contain large inline images) into memory.
- Every write and delete touches both stores in **one transaction**. A
  project is fully written or not written at all; a test injects a failure
  after the summary write and checks that it rolls back.
- Operations resolve only when the transaction **completes**. Success is
  never reported before the data is committed.
- Nothing else is stored. In particular, full documents never go to
  `localStorage`.

### Upgrades

The adapter creates missing stores in `onupgradeneeded`. A future schema
version adds its own upgrade step there.

- An open connection closes itself when a newer Layoutry tab upgrades the
  database (`onversionchange`).
- A tab running an older build then reports "A newer version of Layoutry
  has upgraded the project library. Reload this page".
- An upgrade blocked by an older tab reports `blocked`.

### Concurrency

- **Within a tab:** library operations run one at a time, in request order.
  A second Save waits for the first, then saves the latest document.
- **Across tabs and windows:** each write states what it expects, and the
  check runs inside the write transaction:
  - `new`: the id must not exist (first Save, Save As, Import);
  - `revision`: the stored `updatedAt` must still be the one this session
    last read or wrote (Save). If another tab saved in between, the save is
    refused with "Project changed elsewhere… Use Save As". A record that
    was deleted meanwhile is simply recreated;
  - `overwrite`: only for the explicit "Replace Existing" import choice.

### Errors

Each storage error has a code and a user-facing message:

| Code             | Cause                                                                                                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `unavailable`    | No IndexedDB, a `SecurityError` (some private modes, blocked site data) or a refused open. The message suggests downloading the project instead. A failed open is retried on the next operation. |
| `blocked`        | An older tab is holding the database during an upgrade.                                                                                                                                          |
| `quota-exceeded` | `QuotaExceededError`. Nothing is written.                                                                                                                                                        |
| `not-found`      | The project was deleted, for example in another tab.                                                                                                                                             |
| `conflict`       | See Concurrency.                                                                                                                                                                                 |
| `corrupted`      | An unreadable summary or document record, or a document whose contents belong to a different project id. Unreadable records are still listed, as "Unreadable project", so they can be deleted.   |
| `failed`         | Any other aborted transaction.                                                                                                                                                                   |

## Project identity and dirty state

The project session store holds:

- `metadata`: the active project's id, name, createdAt and updatedAt;
- `savedName`: the metadata baseline;
- `location` (PROJECT-1.3) — where the project is stored, never written
  into the file:
  - `unsaved`: nothing stored matches it;
  - `library` with a `revision`: the `updatedAt` this session last wrote
    or opened, used for the conflict check;
  - `file` with an opaque token and a file name: desktop only, never a
    path.

The editor store keeps its own document baseline (`persistedDocument`, see
project-format.md).

**Unsaved changes** = document changed (`document !== persistedDocument`)
**or** renamed (`metadata.name !== savedName`). Selection, hover, Preview,
Snap and panel changes never count.

| Status shown in the header | Meaning                                                                          |
| -------------------------- | -------------------------------------------------------------------------------- |
| Not saved                  | A new project, never saved, unchanged                                            |
| Unsaved changes            | Edited or renamed since the last save or open, or its library record was deleted |
| Saving…                    | A library operation is in flight                                                 |
| Saved                      | In the library and unchanged                                                     |

The **baseline is set only after a successful write**, and only to the
exact document and metadata snapshot that was written:

- edits made while a save is in flight stay unsaved;
- a rename made while a save is in flight stays unsaved;
- a failed save changes nothing.

An idle queue starts the operation synchronously, so the snapshot is the
state at the moment the user pressed Save.

## Operations

| Operation                  | Behaviour                                                                                                                                                                                                                               |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **New Project**            | Confirms unsaved changes, then switches to an empty page with a fresh id, history and selection reset. Nothing is saved.                                                                                                                |
| **Save** (Ctrl+S)          | The first save of a project asks for a name; later saves don't. Writes under the same id, keeping `createdAt` and advancing `updatedAt`.                                                                                                |
| **Save As** (Ctrl+Shift+S) | Asks for a name, writes a new project with a new id and the current document, and switches to it only after the write succeeded. The original stays exactly as last saved. Undo history is kept.                                        |
| **Open Project** (Ctrl+O)  | Lists the library (newest first; edited and created dates). Confirms unsaved changes, reads and fully validates the record, then replaces the document atomically. A failure leaves the current project untouched.                      |
| **Open Recent**            | The five most recently saved projects, from the same list.                                                                                                                                                                              |
| **Rename**                 | From the header name or File › Rename Project. Names are trimmed, runs of spaces collapse, 1–256 characters, no control characters. Rename marks the project unsaved; it is written on the next Save. The id never changes.             |
| **Import Project**         | Browser File API. The file is size-checked before it is read (at most 3 bytes per allowed character), then parsed by `parseProjectFile`. Content is never evaluated. Errors name the problem and its location. See the id policy below. |
| **Download Project**       | Serializes the current state (with `updatedAt` = now) to `<name>.layoutry`, a name safe on every desktop OS. It doesn't save, and doesn't change the saved baseline or the status. This is not code export.                             |
| **Delete**                 | From the Open Project list, after a confirmation that says it is permanent. Success is shown only after the delete has committed. Deleting the open project keeps it open, as an unsaved project. There is no recycle bin.              |

### Import id policy

| Situation                          | Result                                                                                                                                                   |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The file's id isn't in the library | Imported with its own identity, saved to the library and opened.                                                                                         |
| The id is already in the library   | The user chooses **Import as Copy** (new id, same name; the default) or **Replace Existing** (overwrite, after a warning). Nothing is replaced silently. |
| The write fails                    | Nothing changes; the error is shown.                                                                                                                     |

Import adds the project to the library and opens it in one step, after
confirming unsaved changes.

## Unsaved-changes protection

New Project, Open, Open Recent and Import ask first when there are unsaved
changes. The prompt offers Save (continue only if it succeeds), Don't Save,
and Cancel.

- **Browser tab:** while the project has unsaved changes or a library write
  is in flight, a `beforeunload` handler asks the browser to confirm. The
  browser shows its own text.
- **Desktop (PROJECT-1.3):** no `beforeunload`. The page reports its
  unsaved state to the main process, a clean window closes without asking,
  and unsaved work gets the editor's own Save / Don't Save / Cancel. See
  [desktop-files.md](./desktop-files.md#closing-the-window). Reload
  shortcuts remain blocked.

## Keyboard shortcuts

| Shortcut         | Action       |
| ---------------- | ------------ |
| Ctrl/Cmd+S       | Save         |
| Ctrl/Cmd+Shift+S | Save As      |
| Ctrl/Cmd+O       | Open Project |
| Ctrl/Cmd+N       | New Project  |

- These are handled in `useProjectKeyboardShortcuts` and don't overlap
  with the editor's own shortcuts (Z, Y, C, X, V, D, Delete).
- They work while an Inspector field has focus, which stops the browser's
  own "Save page" dialog. A value still being typed is not committed by the
  shortcut; when it is committed afterwards, the project shows as unsaved
  again.
- They are ignored while any modal dialog is open, and on key repeat.
- The default browser action is prevented only for a handled shortcut.
- **Ctrl+N works in the desktop app only.** Browsers keep it for a new
  window and never deliver it to the page, so the menu shows no shortcut
  for New Project.

## Limitations: tell users

- **Browser projects are local to this browser profile on this device.**
  Clearing site data, private windows, another browser or another device
  make them unavailable, and browsers may evict site storage under disk
  pressure. Use **Download Project** to keep `.layoutry` backups. The Open
  Project dialog says this.
- **Desktop:** since PROJECT-1.3, projects are `.layoutry` files the user
  chooses. Library projects saved earlier stay in the Electron profile
  (`%APPDATA%`) under **File › Open from Desktop Library…**.
- **No autosave and no crash recovery.**
- **Two tabs editing the same project** can't overwrite each other's
  saves; the later save gets a conflict and the user uses Save As.

## Future adapters

- **Desktop filesystem:** done in PROJECT-1.3 — see
  [desktop-files.md](./desktop-files.md).
- **Cloud (later):** another `ProjectRepository`. Project metadata
  intentionally has no owner or account fields. The `revision` expectation
  maps naturally onto server-side optimistic concurrency (ETags).

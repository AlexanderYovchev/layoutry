# Project Persistence (Overview and Guarantees)

The whole persistence subsystem on one page, as of PROJECT-1.5. Details
live in the linked documents; this page states what holds across them,
what doesn't, and why.

| Topic                                       | Document                                           |
| ------------------------------------------- | -------------------------------------------------- |
| `.layoutry` format, validation, migrations  | [project-format.md](./project-format.md)           |
| Browser library, operations, dirty state    | [project-storage.md](./project-storage.md)         |
| Native files, IPC, atomic writes, conflicts | [desktop-files.md](./desktop-files.md)             |
| Recovery snapshots                          | [project-recovery.md](./project-recovery.md)       |
| Decisions                                   | ADR-0003 to ADR-0007 in [decisions](../decisions/) |

## Architecture

```text
            editor store (document, saved baseline)   project store (identity, name, location)
                               \                         /
             project commands (one-at-a-time queue)   recovery coordinator (own queue)
              │            │              │                  │  capture → snapshot worker
   ProjectRepository   desktop bridge   download        RecoveryStorage
   (IndexedDB library)  (tokens, IPC)                  ┌──────┴──────┐
                           │                       IndexedDB      desktop bridge
                     main process:                 "layoutry-     → main process:
                     atomic file writes            recovery"        <userData>\Recovery
```

- **Browser:** saved projects live in IndexedDB `layoutry-projects`.
  Recovery copies live in a separate database, `layoutry-recovery`, with
  Web Locks marking which tabs are alive. Download/Import move
  `.layoutry` files in and out.
- **Desktop:** saved projects are `.layoutry` files the user chose. The
  renderer holds only opaque, window-bound tokens; paths, reads, writes
  and fingerprints stay in the main process. Recovery copies are files in
  the app's profile folder. The PROJECT-1.2 IndexedDB library is still
  readable (Open from Desktop Library); the desktop app never creates new
  library projects.
- **One format everywhere:** library records, native files and recovery
  records all hold the same canonical text from `serializeProject`, and
  all load through `parseProjectFile`.

## Guarantees

1. **A failed Save changes nothing.** The project stays unsaved. The
   library record or file keeps its previous content: one IndexedDB
   transaction, or a temporary file renamed over the original, never
   delete-then-write.
2. **Save marks exactly what was written.** Document and metadata are
   captured when the save starts. Edits and renames made while it runs
   stay unsaved.
3. **Saves never interleave.** One queue per window. A second Save waits,
   then writes the latest state.
4. **No silent overwrite of someone else's change:**
   - library: the record's revision must still be the one this tab read;
   - file: the SHA-256 of the file must still be the one this window read
     or wrote, checked before writing and again right before the replace.

   Otherwise the user chooses (Overwrite, Save As, Cancel).

5. **Opening never writes.** A file that fails validation, is too large,
   isn't UTF-8 or is a newer format is refused with the editor unchanged.
6. **Recovery copies are not saves.** They never touch a library record or
   a file, never clear "Unsaved changes", and never bypass conflict
   checks. A restored project is unsaved and saves against the version the
   crashed session last saw.
7. **Recovery cleanup is conservative.** A session deletes only its own
   copies, once they're redundant (saved, explicitly discarded, or a
   clean close with nothing unsaved). Retention never deletes a project's
   newest copy or another live session's copies.
8. **The renderer never gets filesystem access.** It has no Node.js, no
   paths and no arbitrary file reads. Every IPC payload is validated in
   the main process.

## What is not guaranteed (known limits)

- **Edits in the last 2–30 s before a crash** can be lost (the snapshot
  debounce and maximum interval).
- **Native write race:** a program writing the destination in the instant
  between the final check and the rename isn't detected (Windows has no
  compare-and-swap rename).
- **Power loss** right after a save may leave the previous version (not a
  torn file). FAT/exFAT and network drives don't guarantee atomic
  replace.
- **Browser storage** can be evicted by the browser or cleared by the
  user, and private windows may not keep it. Recovery needs a secure
  context (https or localhost) for Web Locks and Web Crypto.
- **Recovery copies** are local, unencrypted, and not backups.
- **Leave page:** a browser tab closed with "Leave page" keeps its copies;
  they're offered next time, because the browser doesn't say what was
  chosen.
- **Very large projects:** opening one near the 20,000-element limit
  takes seconds, which is Canvas rendering, not persistence.

## Dirty state

"Unsaved changes" means `document !== persistedDocument` (reference
identity, so edit → undo returns to clean exactly) or the name differs
from the saved name. Selection, hover, zoom, theme, panel state, preview
mode and an in-progress drag never count. Restored recovery work is always
unsaved until saved. See [project-storage.md](./project-storage.md#project-identity-and-dirty-state).

## Security boundaries

- **Renderer:** sandboxed, context-isolated, no Node.js. The fuses
  disable `RunAsNode`, the Node.js CLI options and `--inspect`.
- **Preload:** a fixed set of 14 functions (`window.layoutryDesktop`,
  `apiVersion` 2). Every argument is checked before it is sent.
- **Main process:**
  - validates every payload with exact keys and types;
  - resolves file tokens per window;
  - refuses links and junctions for project files and the recovery
    folder;
  - limits sizes;
  - never takes a path from the renderer.
- **Recovery folder:** app-owned; record ids are matched by pattern, so
  they can't name a path.
- **Accepted:** a planted hard link is treated as a damaged record, and
  removing it only removes that link. File symlinks are refused; their
  real-OS test needs Developer Mode or admin rights and is skipped on
  machines without them (a simulated variant always runs).

## For alpha testers

- **Save to `.layoutry` files** (desktop) or **Download Project**
  (browser), and copy them to another drive or a synced folder now and
  then. Recovery copies are a safety net, not a backup.
- **Nothing is kept in the extracted app folder**, so replacing it with a
  new version keeps your work.
- **Report it** if Layoutry ever:
  - says Saved and the file doesn't match;
  - offers recovered work you saved or discarded;
  - doesn't offer recovery after a crash;
  - shows a conflict you can't explain.

# ADR-0005: Native Project Files Through Capability-Token IPC

**Status:** Accepted

**Date:** 2026-10-27

## Context

The desktop app could only save into the IndexedDB library inside its
Electron profile (ADR-0004). Users expect to save `.layoutry` files where
they choose, open them again, and not lose work. The renderer runs
untrusted authored content in a hardened sandbox (ADR-0002), so any
filesystem access must not weaken that.

## Decision

- **A sandboxed preload exposes nine fixed, argument-checked functions** as
  `window.layoutryDesktop` (open, take a pending file, choose a save
  location, write, release, report unsaved state, answer a close request,
  and two notification subscriptions). There are seven IPC channels, and no
  generic channel exists.
- **Capability tokens instead of paths:**
  - the main process alone holds paths, which come only from native dialogs
    or the command line;
  - the renderer gets random 128-bit tokens bound to its window, plus bare
    file names;
  - the sender (the top frame on `app://layoutry/`) and every payload are
    validated in the main process.
- **Atomic replace:** temp file in the same folder (exclusive create) →
  fsync → `rename` over the target (MoveFileEx replace-existing), with a
  short retry for antivirus locks, then a read-back hash check. The
  original is never deleted first.
- **External change detection by SHA-256 content fingerprint.** Overwriting
  needs an explicit choice.
- **Close decisions belong to the page** (its own Save / Don't Save /
  Cancel). The native dialog is a fallback for a crashed or hung page.
- **Save semantics:**
  - a new project saves to a file;
  - a file project saves to its file;
  - a pre-1.3 library project keeps saving to the library;
  - Save As always writes a new identity to a file;
  - the desktop app no longer creates library projects.
- **No registry changes from the portable app.** Command-line opening and
  second-instance forwarding are supported; a double-click association is
  deferred to an installer.

## Consequences

**Positive:**

- Portable `.layoutry` files, with no change to the format or the browser
  library.
- A compromised or buggy renderer can't name arbitrary paths, can only
  write project-shaped JSON to files the user chose, and can't overwrite
  other programs' changes silently.
- A clean window closes without nagging.

**Negative / tradeoffs:**

- The preload repeats the channel names (sandboxed preloads can't import);
  a test keeps them in sync.
- The atomic replace is not power-loss-proof (no write-through, and no
  directory flush on Windows), and isn't atomic on FAT or network shares.
  This is documented.
- Serialization still runs on the renderer thread (well under a second for
  a 10 MB project).
- Without an installer, the double-click association is the user's own
  "Open with" choice.

## Alternatives considered

- **Exposing `fs` or path-taking IPC:** any renderer bug or injected script
  could read or write anywhere.
- **The File System Access API in Electron:** less control over atomicity,
  locking and errors, and permission prompts per file.
- **Writing in place, or unlink-then-rename:** a crash or full disk would
  corrupt or lose the only copy.
- **Modification time as the conflict signal:** misses same-second and
  restored-timestamp edits; content hashes are cheap at these sizes.
- **Silently migrating library projects to files:** surprising, and it
  risks losing work; rejected.

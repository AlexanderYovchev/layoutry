# DESKTOP-0.5 — Windows Release QA (Layoutry 0.1.0-alpha.1)

**Date:** 2026-10-26 · **Decision:** CONDITIONAL GO, for a small,
controlled alpha only (see the end of this report).

This is a point-in-time record. Re-validating a rebuilt ZIP is
`npm run desktop:release`, plus `npm run desktop:soak` for the stability
session. See [desktop-shell.md](../architecture/desktop-shell.md).

## Artifact

| Field             | Value                                                                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| ZIP               | `release/Layoutry-0.1.0-alpha.1-win-x64.zip`                                                                                                 |
| Size              | 154,035,785 bytes (146.9 MB); 77 entries, 369.9 MB unpacked                                                                                  |
| SHA-256           | `fb7c23085d275cea1c96f02d894cf54b7bd95fa9c5a9e7549141090880300dad` (confirmed independently with `Get-FileHash`)                             |
| Built             | 2026-10-26T07:25:16Z, Electron 44.9.0, electron-builder 26.15.3                                                                              |
| Build provenance  | HEAD `14b769c` plus the uncommitted DESKTOP-0.5 changes. Rebuild after committing for a clean-provenance release; the manifest records this. |
| Signing           | none (unsigned alpha)                                                                                                                        |
| Manifest/checksum | `release/Layoutry-0.1.0-alpha.1-win-x64.manifest.md`, `release/Layoutry-0.1.0-alpha.1-win-x64.zip.sha256` (generated, gitignored)            |

## Test environment, and what was not available

- **Tested on:**
  - Windows 10 Pro 22H2 (build 19045) x64, 8 GB RAM, NVIDIA RTX 3050.
  - One 1920 × 1080 monitor at 100% scaling.
  - A standard user account, without administrator rights.
- **Simulated:** 125% and 150% display scaling, using Chromium's
  `--force-device-scale-factor`. Windows' own scaling setting was not
  changed.
- **Untested:** Windows 11; real 125% and 150% Windows scaling;
  multi-monitor setups; a machine with no network adapter or an OS
  firewall rule (that needs administrator rights).

## Validation results (final artifact)

| Check                                                           | Command                         | Result                                                 |
| --------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------ |
| TypeScript                                                      | `npm run typecheck`             | pass                                                   |
| ESLint                                                          | `npm run lint`                  | pass                                                   |
| Vitest                                                          | `npm test`                      | 282 files / 4,193 tests pass                           |
| Browser Playwright                                              | `npm run test:e2e`              | 19 / 19 pass                                           |
| Standard Next.js build                                          | `npm run build`                 | pass                                                   |
| Desktop static build and dev-Electron suite                     | `npm run desktop:test`          | 28 / 28 pass                                           |
| Windows packaging (verified artifact)                           | `npm run desktop:package`       | pass                                                   |
| **Packaged `Layoutry.exe` suite** (extracted ZIP, Unicode path) | `npm run desktop:test:packaged` | **41 / 41 pass, 0 skipped**                            |
| **20-minute stability session**                                 | `npm run desktop:soak`          | **pass:** 916 edit cycles, 0 crashes, 0 console errors |

The packaged suite covers:

- **Artifact:** ZIP and `app.asar` contents, a secrets and developer-path
  scan, fuses, metadata, icon.
- **Hardening:** each fuse proved by behaviour, including a tampered-ASAR
  refusal.
- **Security:** Node isolation, the protocol, navigation, popups,
  permissions, CSP, and no local listening ports.
- **Lifecycle:** the native close dialog, single instance, reopening.
- **Windowing:** maximize, restore and minimize; the minimum size; panels;
  focus and scrolling; simulated scaling.
- **Editor workflows:** insert, Component, nesting, inline text, Inspector
  typography, colour, spacing and size, handle-resize, drag-move,
  Structure panel, copy/paste, undo/redo, Preview round-trip,
  transform/transition, dark-mode isolation.
- **Performance.**

Offline coverage means a dead-proxy for all http(s) traffic, plus
observation of every request. Only `app://layoutry/` requests were seen.
This is not OS-level isolation.

## Performance (packaged exe, this machine, includes test overhead)

- **Startup:**
  - Cold start to an interactive editor: 387 ms.
  - Warm start: 378 ms.
- **Processes and memory:**
  - 4 processes.
  - About 360 MB working set after startup.
  - About 530–590 MB during the long editing session (peak 594 MB).
- **Responsiveness:**
  - Click to Inspector update: 160–240 ms.
  - Drop to node rendered: 8–9 ms.
- **Long session:** median edit-cycle time crept from 1.16 s to 1.34 s
  over 916 cycles (see P3-2).

## Findings

| ID   | Sev    | Finding                                                                                                                                                                                                                                                                                                                                                                                         | Status                                                                                                                  |
| ---- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| P2-1 | **P2** | Shrinking the window to its minimum gave an 884 px viewport (888/890 at simulated 125%/150%). That is below the editor's 900 px floor, so the editor was replaced by its "unsupported viewport" notice. Cause: `minWidth`/`minHeight` constrain the outer window, frame included.                                                                                                               | **Fixed** (desktop-only, `desktop/main/windowSizing.ts`). Verified in the packaged exe at 100% and simulated 125%/150%. |
| P3-1 | P3     | At automation speed, starting an interaction immediately after a drop occasionally (about 1 in 17–30 cycles) stops the next library drag from activating. The pointer makes a native text selection instead. 0 failures in 120 cycles with a 0.5 s pause after each drop. Shared editor code (dnd-kit), not desktop-specific.                                                                   | Open, for core-editor stabilization. Workaround: drag again.                                                            |
| P3-2 | P3     | Over a 20-minute session (916 cycles) the median cycle time rose about 15% (1.16 s to 1.34 s), and the working set crept about 2–3 MB/min after warm-up. No crash or error.                                                                                                                                                                                                                     | Open: profile during core-editor stabilization.                                                                         |
| N-1  | note   | The **first** 20-minute session ended with ~20 s cycles (573 cycles, still 0 crashes and 0 errors). It did not reproduce in an instrumented rerun where the window was verified visible and in the foreground throughout (max 2.1 s). A 300-cycle step-by-step profile was also flat. The cause is unconfirmed. Leading hypothesis: Chromium throttling a covered window on the shared desktop. | Watch: alpha testers should report any slowdown with how long the session ran.                                          |

No P0 or P1 issues were found. QA tooling problems found and fixed along
the way (not app bugs):

- the drag helper dropped off-screen in short windows;
- a missing human-like dwell before mouse-up;
- the soak record reported the planned rather than the elapsed duration
  (now records pass/fail and the actual time).

## Still untested or limited

- Windows 11, real display scaling, multi-monitor setups.
- OS-level network isolation.
- Behaviour on low-memory machines.
- Unsigned: SmartScreen and antivirus prompts are expected.
- No persistence: closing, a crash or a restart loses the document. The
  tester README states this prominently.
- The 900 × 600 editor floor plus the window frame can exceed very small,
  highly scaled screens (for example 1366 × 768 at 150%).

## Decision: CONDITIONAL GO

Suitable for a **small, controlled alpha** with these conditions:

1. Hand the ZIP only to known testers, directly from the project owner,
   together with the `.manifest.md` and `.sha256` files.
2. Ideally, commit DESKTOP-0.5 first and rebuild with
   `npm run desktop:release` and `npm run desktop:soak`, for a
   clean-provenance build.
3. Tell testers plainly that work is not saved, and ask for Windows 11,
   high-DPI and multi-monitor reports specifically.
4. Treat their reports as the first coverage of the untested environments
   listed above.

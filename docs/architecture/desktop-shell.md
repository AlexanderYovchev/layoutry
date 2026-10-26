# Desktop Shell (Electron)

Layoutry's Windows desktop build wraps the unchanged browser editor in a
hardened Electron shell. The decision and its alternatives are recorded in
[ADR-0002](../decisions/ADR-0002-electron-desktop-shell.md). This page
explains how to build, run, package and test the shell, and what it
guarantees.

**Status:** DESKTOP-0.5. Layoutry ships as a QA-validated, portable
Windows x64 ZIP for a small, controlled alpha (unsigned). Since
PROJECT-1.3, projects are saved as native `.layoutry` files through a
sandboxed preload bridge (see [desktop-files.md](./desktop-files.md)).
Projects saved in the PROJECT-1.2 library stay available.
The release QA record is in
[docs/reports/desktop-0.5-release-qa.md](../reports/desktop-0.5-release-qa.md).

## Commands

| Command                           | What it does                                                                                                                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                     | The browser editor, unchanged by the desktop work.                                                                                                                              |
| `npm run desktop:build`           | Builds the Next.js static export into `out/` (`LAYOUTRY_DESKTOP_BUILD=1`), then compiles `desktop/` into `desktop-dist/`. Both folders are gitignored.                          |
| `npm run desktop:compile`         | Compiles only the main process (`desktop/` → `desktop-dist/`).                                                                                                                  |
| `npm run desktop:start`           | Compiles the main process and launches development Electron against the existing `out/`. Run `desktop:build` first.                                                             |
| `npm run desktop:test`            | Runs `desktop:build`, then the dev-Electron Playwright suite (`playwright.desktop.config.ts`, `e2e/desktop/`). Exits nonzero on any failure.                                    |
| `npm run desktop:package`         | Runs `desktop:build`, then packages the Windows release into `release/` and verifies it (`desktop/scripts/package-windows.mjs`). Fails on any verification error.               |
| `npm run desktop:test:packaged`   | Runs the packaged-app suite (`playwright.packaged.config.ts`, `e2e/packaged/`) against the real `Layoutry.exe`. Requires `desktop:package` first; it does not rebuild.          |
| `npm run desktop:soak [-- <min>]` | Opt-in stability session (default 20 minutes) of repeated editing in the packaged exe; writes `release/soak-results.json`.                                                      |
| `npm run desktop:manifest`        | Writes `release/<zip>.sha256` and `release/<zip base>.manifest.md` from the actual ZIP, Git and the latest test results. Fails if the ZIP was not validated after it was built. |
| `npm run desktop:release`         | `desktop:package` → `desktop:test:packaged` → `desktop:manifest`: one command for a validated release.                                                                          |

All of them work in PowerShell, CMD and POSIX shells; environment
variables are set inside Node scripts, never with `VAR=x` syntax.

Set `LAYOUTRY_DESKTOP_DEVTOOLS=1` before `desktop:start` to allow F12 /
Ctrl+Shift+I DevTools. DevTools are otherwise disabled entirely.

Some terminals (notably editor-extension hosts) export
`ELECTRON_RUN_AS_NODE=1`, which turns the development `electron.exe` into
plain Node.js. `desktop:start` and the test suites remove it. The
packaged `Layoutry.exe` ignores it (fuse).

## Runtime architecture

```text
Layoutry.exe (main process: desktop-dist/main/main.js inside app.asar)
  ├─ single-instance lock (per user-data directory)
  ├─ app://layoutry/  → read-only handler over out/ (+ CSP header)
  ├─ project files (PROJECT-1.3): native dialogs, capability tokens,
  │   atomic writes — 7 validated IPC channels, nothing else
  └─ one BrowserWindow: contextIsolation, sandbox, no nodeIntegration,
     a sandboxed preload (window.layoutryDesktop), no application menu
```

The export root is `app.getAppPath()/out`. In the packaged app that path
is inside `resources/app.asar`, and Electron's ASAR-aware `fs` and
`net.fetch(file:)` serve it unchanged. The protocol's
lexical-traversal and `realpath` containment checks work the same inside
the archive, so no packaged-specific code path exists.

## Windows packaging

`npm run desktop:package` runs these stages:

1. `desktop:build` creates the static export and compiles the main process.
2. **Stage** `release/.staging/app/` with only the runtime files: a minimal
   `package.json` (no dependencies, so no `node_modules` are packed),
   `desktop-dist/` (`.js` only) and `out/`.
3. **Icon:** `desktop/packaging/generateIcon.mjs` renders the existing
   `LayoutryLogoMark` from the built app, with its theme gradient resolved,
   at 16–256 px into a multi-resolution `.ico`. The source component is
   untouched; this is a build-time step using Playwright's Chromium.
4. **electron-builder** (`26.15.3`, target `zip`, `win-x64`) packs
   `app.asar` from the development Electron runtime in `node_modules`
   (copied, never modified). It embeds the ASAR integrity hash into the
   exe, then sets exe metadata and the icon.
5. The **`afterPack`** step removes Electron's demo `default_app.asar` and
   flips `PACKAGED_FUSES` with the pinned `@electron/fuses` 2.1.3.
   electron-builder's own bundled copy does not know Electron 44's newest
   fuse, so it would be rejected by `strictlyRequireAllFuses`.
6. **Verify the final artifact**, not the configuration: every fuse bit in
   the shipped exe, `resources/` containing only `app.asar`, required
   files present in `app.asar`, forbidden files absent (`node_modules`,
   `src`, tests, docs, `.map`, `.ts`, `.env`, …) and the README filled in.
7. Print the artifact paths and sizes.

### Artifacts

All of these are generated and gitignored (`/release/`):

| Path                                                              | What                                                                                                     |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `release/Layoutry-<version>-win-x64.zip`                          | The distributable: the complete app folder at the ZIP root.                                              |
| `release/win-unpacked/`                                           | The same app, unzipped (`Layoutry.exe`, Chromium runtime, `resources/app.asar`, `README.txt`, licences). |
| `release/builder-debug.yml`                                       | electron-builder's log of the effective build.                                                           |
| `release/<zip>.sha256`, `release/<zip base>.manifest.md`          | Checksum and release manifest (`desktop:manifest`). Ship them with the ZIP.                              |
| `release/packaged-test-results.json`, `release/soak-results.json` | Validation records the manifest reads.                                                                   |

The version is `RELEASE.version` in `desktop/packaging/releaseInfo.mjs`
(currently `0.1.0-alpha.1`). It is separate from the repository's
`package.json` version, which belongs to the browser app.

### Executable metadata

| Field                         | Value                                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------ |
| ProductName / FileDescription | Layoutry                                                                                                     |
| FileVersion                   | `0.1.0-alpha.1`                                                                                              |
| CompanyName                   | Layoutry. This is the product name only; otherwise Windows shows the stock Electron binary's "GitHub, Inc.". |
| LegalCopyright                | empty, because no copyright holder has been stated                                                           |
| Signature                     | none (`NotSigned`)                                                                                           |

Two tester documents ship next to `Layoutry.exe`, with `{{VERSION}}`
filled in and Windows line endings:

- `README.txt`, from `desktop/packaging/README-alpha.txt`
- `FEEDBACK-TEMPLATE.txt`, from `desktop/packaging/FEEDBACK-TEMPLATE.txt`

### Rebuilding a release

```text
npm ci                    # network: npm registry, Electron download
npm run desktop:release   # network for the build step only (Google Fonts, electron-builder tools);
                          # then tests the exact ZIP offline and writes manifest + checksum
npm run desktop:soak      # optional: 20-minute stability session on the same ZIP
npm run desktop:manifest  # re-run to include the stability results
```

`desktop:package` always deletes and recreates `release/`, so every run
starts clean. Build releases from a committed tree: the manifest records
the commit and flags uncommitted changes. Distribute the ZIP together with
its `.manifest.md` and `.sha256` files.

### Packaged-app test suite

`e2e/packaged/` drives the real fuse-hardened `Layoutry.exe`. Its
`globalSetup` extracts the ZIP with Windows' own `Expand-Archive` into
`%TEMP%\layoutry-zip-test-*\Layoutry Alpha Тест 測試\`, so tests run
outside the repository, from a path with spaces and non-ASCII
characters, with a clean profile and `cwd` set to `%TEMP%`.

`EnableNodeCliInspectArguments` is off, so Playwright's `_electron`
launcher cannot drive the packaged exe. Instead the suite:

- passes the Chromium switch `--remote-debugging-port` and attaches
  Playwright over CDP to observe the page;
- uses Win32 calls through PowerShell for OS-level checks:
  - `EnumWindows` to find windows,
  - `WM_SYSCOMMAND/SC_CLOSE`, exactly what the X button and Alt+F4 send,
  - `TDM_CLICK_BUTTON` to answer the native task dialog,
  - `ShowWindow`, `IsIconic` and `GetForegroundWindow` for window state.

It covers:

- **Artifact:** ZIP layout and completeness, `app.asar` contents, fuse bits
  on both executables, metadata, icon, signature status.
- **Smoke:** both `release/win-unpacked/Layoutry.exe` and the extracted
  ZIP. Offline load, fonts, panels, selection, drag-insert, undo/redo,
  Design/Preview, reload suppression, no console errors.
- **Security:** Node isolation (editor and iframe), protocol responses
  from inside `app.asar`, navigation, popups, permissions, CSP.
- **Lifecycle:** closing (no prompt when saved; the editor's own prompt
  with unsaved work, where Cancel keeps the document and Don't Save exits
  0 with no leftover processes), and a second launch restoring and
  focusing a minimized window, including while the prompt is open.
- **Project files (PROJECT-1.3):** the real Windows Save and Open dialogs
  (and Windows' own replace confirmation), command-line opening, forwarding
  from a second launch, and the bridge's fixed surface.
- **Hardening:** each fuse proved by behaviour:
  - `ELECTRON_RUN_AS_NODE`, `NODE_OPTIONS=--require` and `--inspect` are
    ignored;
  - a byte-edited `app.asar` is refused (ASAR integrity);
  - a loose `resources/app` is never loaded (OnlyLoadAppFromAsar). The
    stock runtime in the same folder loads it, as a control.
- **Performance:** startup, memory and interaction baselines.

**Note:** the packaged exe still honours Chromium's
`--remote-debugging-port` switch. No fuse disables it, and the tests rely
on it. It is only reachable by someone who can already start programs as
the user, which is the same trust level as the user.

## Security protections

- **Renderer isolation:** `contextIsolation`, `sandbox` (plus
  `app.enableSandbox()`), `nodeIntegration: false`, `webSecurity`,
  `webviewTag: false`. `require`, `process` and `Buffer` are undefined in
  the editor and in iframes.
- **Preload and IPC (PROJECT-1.3):** a sandboxed preload exposes only
  `window.layoutryDesktop`, a frozen set of argument-checked functions.
  The main process handles exactly seven channels:
  - each checks that the caller is the main window's top frame on
    `app://layoutry/`, and validates the payload strictly;
  - file access goes through opaque, per-window tokens issued for paths the
    user picked in a native dialog or passed on the command line;
  - the renderer can never name a path.

  Details: [desktop-files.md](./desktop-files.md#security-boundary).

- **`app://` protocol:** GET/HEAD only. Host `layoutry` only. Each path
  segment is decoded and checked. Lexical traversal is rejected (400). The
  real path (after following symlinks or junctions) must stay inside
  `out/`, otherwise 404. Directories are never listed. A fixed MIME map
  and `nosniff` apply to every response. Files elsewhere in `app.asar`,
  such as `package.json` and the main process, are not reachable.
- **Navigation:** the main window can only ever show `app://layoutry/`.
  http(s), `file:`, unknown schemes and form submissions are cancelled.
  Iframes may load http(s) and `about:blank` only.
- **Popups:** every `window.open` / `target=_blank` is denied. Nothing is
  handed to `shell.openExternal`.
- **Permissions:** every request and check is denied (camera, microphone,
  geolocation, notifications, clipboard read, devices, openExternal).
- **CSP** (see `desktop/security/contentSecurityPolicy.ts`):
  - `script-src 'self' 'unsafe-inline'`. Next's static export needs its
    inline bootstrap scripts. Remote scripts, `eval` and `new Function`
    are blocked.
  - `style-src 'unsafe-inline'` for React `style` props.
  - Authored images, media and iframes may use http(s), `data:` and `blob:`.
  - `connect-src 'self'`; `object-src`, `base-uri`, `form-action` and
    `frame-ancestors` are all `'none'`.
  - **Residual risk:** inline script is allowed, and authored content shares
    the editor's DOM. The Canvas never renders raw authored HTML, which is
    what keeps authored data from becoming script.
- **Authored iframes** still have no `sandbox` attribute; changing that is
  a separate product decision. The desktop guards above contain them.

## Electron fuses

Fuses are bits inside `electron.exe`. They are flipped once at packaging
time, not configured at runtime. The configuration lives in
`desktop/fuses/layoutryFuses.ts`:

| Fuse                                    | Packaged value | Verified on the shipped `Layoutry.exe` by                              |
| --------------------------------------- | -------------- | ---------------------------------------------------------------------- |
| `RunAsNode`                             | off            | fuse wire + `ELECTRON_RUN_AS_NODE=1` still starts the app              |
| `EnableNodeOptionsEnvironmentVariable`  | off            | fuse wire + `NODE_OPTIONS=--require` code never runs                   |
| `EnableNodeCliInspectArguments`         | off            | fuse wire + `--inspect` opens no debugger                              |
| `GrantFileProtocolExtraPrivileges`      | off            | fuse wire (the app never uses `file:` pages)                           |
| `EnableCookieEncryption`                | on             | fuse wire                                                              |
| `OnlyLoadAppFromAsar`                   | on             | fuse wire + planted `resources/app` never runs (stock-runtime control) |
| `EnableEmbeddedAsarIntegrityValidation` | on             | fuse wire + byte-edited `app.asar` is refused                          |
| `WasmTrapHandlers`                      | on (default)   | fuse wire                                                              |
| `LoadBrowserProcessSpecificV8Snapshot`  | off (default)  | fuse wire                                                              |

The development binary in `node_modules` is never modified; the suites
check that it still has its stock fuses.

## Single instance

The lock is scoped to the user-data directory:

1. The first launch takes the lock and runs normally.
2. A second launch with the same profile does not create a window. Before
   it is ready, it signals the first instance and exits with code 0.
3. The first instance restores its window if minimized and brings it to
   the foreground.
4. The open document is never touched.

This also works while the close prompt is open. Since PROJECT-1.3, a
second launch with a `.layoutry` file forwards that file to the running
window. The tests give each
launch its own `--user-data-dir`, so they never share a lock.

## Lifecycle

- The window shows on `ready-to-show`, or on a failed main-frame load, so a
  broken start is never an invisible process holding the lock.
- The window's minimum size is set from its actual frame
  (`desktop/main/windowSizing.ts`), so the content area never drops below
  the editor's 900 × 600 floor. Below that floor the editor would be
  replaced by its "unsupported viewport" notice. Before DESKTOP-0.5 the
  minimum applied to the outer window, leaving an 884 px viewport.
- Closing (X button, Alt+F4, taskbar), since PROJECT-1.3:
  - a saved or untouched project closes at once;
  - with unsaved work, the editor shows its own Save / Don't Save / Cancel,
    and Save must succeed first;
  - the native "Closing Layoutry will discard any unsaved changes.
    Continue?" warning remains only as a fallback for a page that crashed,
    hung or never loaded (Cancel is its default);
  - repeated close requests absorb into one prompt, and a confirmed close
    exits once, with code 0, leaving no child processes;
  - a Windows session end closes without asking.
- Reload shortcuts (Ctrl+R, Ctrl+Shift+R, F5, Shift+F5, Ctrl+F5) are
  swallowed. Editor and text-editing shortcuts are untouched.

## Offline guarantees

| Phase                                               | Network                                                                                                        |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Development and build (`npm ci`, `desktop:package`) | **Required**: npm registry, Electron download, Google Fonts for Inter via `next/font`, electron-builder tools. |
| Packaged app at runtime                             | **Not required.** Every editor asset, including Inter, comes from `app.asar` over `app://`.                    |
| User-authored remote URLs (images, media, iframes)  | Optional content. It simply fails to load offline; the editor keeps working.                                   |

How the suites prove offline startup: every launch routes all http(s)
traffic to a dead proxy (`--proxy-server=http://127.0.0.1:9`, loopback
included). The dev suite also records and cancels any network request at
the session level. The packaged suite records every page request during a
full in-app reload. The page's resource timing must list only
`app://layoutry/` URLs.

Limitations of this approach:

- The checks block or observe requests; they do not take the machine
  offline.
- Chromium-internal traffic outside the page (for example DNS prefetch) is
  not observed.
- The packaged suite also checks that the app listens on no local ports of
  its own: no localhost server or service.
- A run on a machine with no network adapter at all (or with an OS
  firewall rule) has not been done. It needs administrator rights, which
  the DESKTOP-0.5 machine did not have.

## SmartScreen, antivirus and signing

The alpha is **not code-signed**:

- Windows SmartScreen will typically show "Windows protected your PC" on
  first launch ("More info" → "Run anyway").
- Antivirus products may scan or delay an unfamiliar executable.
- Reputation builds only over time and with signing.
- Testers should only run builds received directly from the project owner.
  They should never disable SmartScreen or antivirus.

The tester README says the same.

## Known alpha limitations

- No autosave or recovery: a crash or a Windows restart discards unsaved
  changes (PROJECT-1.4).
- No double-click file association: the portable app doesn't write to the
  registry. "Open with → Layoutry.exe", dragging a file onto the exe, and
  the command line all work.
- No installer, no auto-update, no signing.
- The ZIP is ~147 MB; unpacked it is ~370 MB. That is mostly the Chromium
  runtime: about 236 MB for the exe, plus 48 MB of locales and 20 MB of
  licences. Trimming locales is possible later and has not been done.
- Validated on one Windows 10 Pro x64 (22H2) machine: one 1920 × 1080
  monitor at 100% scaling.
  - 125% and 150% scaling were **simulated** with Chromium's
    `--force-device-scale-factor`.
  - Real Windows display scaling, Windows 11 and multi-monitor setups are
    untested. Alpha testers are the first coverage there.
- On small screens with high scaling (for example 1366 × 768 at 150%, a
  910-pixel-wide work area), the 900-pixel editor floor plus the window
  frame can exceed the screen.
- Renderer crashes are not handled specially yet. The window stays open
  and can be closed.
- Performance numbers are single-machine baselines that include test
  overhead, not benchmarks.

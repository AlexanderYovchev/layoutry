# Desktop Shell (Electron)

Layoutry's Windows desktop build wraps the unchanged browser editor in a
hardened Electron shell. The decision and its alternatives are recorded in
[ADR-0002](../decisions/ADR-0002-electron-desktop-shell.md). This page
explains how to build, run and test the shell, and what it guarantees.

**Status:** DESKTOP-0.3. Nothing is packaged for distribution yet (that is
DESKTOP-0.4), and projects cannot be saved.

## Commands

| Command                   | What it does                                                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run dev`             | The browser editor, unchanged by the desktop work.                                                                                                     |
| `npm run desktop:build`   | Builds the Next.js static export into `out/` (`LAYOUTRY_DESKTOP_BUILD=1`), then compiles `desktop/` into `desktop-dist/`. Both folders are gitignored. |
| `npm run desktop:compile` | Compiles only the main process (`desktop/` → `desktop-dist/`).                                                                                         |
| `npm run desktop:start`   | Compiles the main process and launches Electron against the existing `out/`. Run `desktop:build` first.                                                |
| `npm run desktop:test`    | Runs `desktop:build`, then the real-Electron Playwright suite (`playwright.desktop.config.ts`, `e2e/desktop/`). Exits nonzero on any failure.          |

All of them work in PowerShell, CMD and POSIX shells; environment
variables are set inside Node scripts, never with `VAR=x` syntax.

Set `LAYOUTRY_DESKTOP_DEVTOOLS=1` before `desktop:start` to allow F12 /
Ctrl+Shift+I DevTools. DevTools are otherwise disabled entirely.

Some terminals (notably editor-extension hosts) export
`ELECTRON_RUN_AS_NODE=1`, which turns `electron.exe` into plain Node.js.
`desktop:start` and the test suite remove it before launching.

## Runtime architecture

```text
electron.exe (main process: desktop-dist/main/main.js)
  ├─ single-instance lock (per user-data directory)
  ├─ app://layoutry/  → read-only handler over out/ (+ CSP header)
  └─ one BrowserWindow: contextIsolation, sandbox, no nodeIntegration,
     no preload, no IPC, no application menu
```

Packaged, the app needs only `package.json`, `desktop-dist/` and `out/`.
No `node_modules` are required at runtime. This is verified by launching
from a copy containing just those three entries.

## Security protections

- **Renderer isolation:** `contextIsolation`, `sandbox` (plus
  `app.enableSandbox()`), `nodeIntegration: false`, `webSecurity`,
  `webviewTag: false`. There is no preload script and no IPC. `require`,
  `process` and `Buffer` are undefined in the editor and in iframes.
- **`app://` protocol:** GET/HEAD only. Host `layoutry` only. Each path
  segment is decoded and checked. Lexical traversal is rejected (400). The
  real path (after following symlinks or junctions) must stay inside
  `out/`, otherwise 404. Directories are never listed. A fixed MIME map
  and `nosniff` apply to every response.
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
time, not configured at runtime, and the development binary in
`node_modules` is never modified. The configuration lives in
`desktop/fuses/layoutryFuses.ts` (uses the official `@electron/fuses`):

| Fuse                                    | Packaged value | Status                                                     |
| --------------------------------------- | -------------- | ---------------------------------------------------------- |
| `RunAsNode`                             | off            | Verified on a hardened binary copy; flipped in DESKTOP-0.4 |
| `EnableNodeOptionsEnvironmentVariable`  | off            | Verified on a hardened binary copy; flipped in DESKTOP-0.4 |
| `EnableNodeCliInspectArguments`         | off            | Verified on a hardened binary copy; flipped in DESKTOP-0.4 |
| `GrantFileProtocolExtraPrivileges`      | off            | Verified on a hardened binary copy; flipped in DESKTOP-0.4 |
| `EnableCookieEncryption`                | on             | Verified on a hardened binary copy; flipped in DESKTOP-0.4 |
| `WasmTrapHandlers`                      | on (default)   | Verified on a hardened binary copy                         |
| `LoadBrowserProcessSpecificV8Snapshot`  | off (default)  | Verified on a hardened binary copy                         |
| `OnlyLoadAppFromAsar`                   | on             | **Deferred**: needs `app.asar` (DESKTOP-0.4)               |
| `EnableEmbeddedAsarIntegrityValidation` | on             | **Deferred**: needs `app.asar` (DESKTOP-0.4)               |

`e2e/desktop/fuses.spec.ts` copies `electron.exe` to a temporary folder
and flips every non-ASAR fuse on the copy. It then proves the hardened
copy still runs Layoutry over `app://`. Against the stock binary as a
control, it also proves that `ELECTRON_RUN_AS_NODE`,
`NODE_OPTIONS=--require …` and `--inspect` no longer work. **Until
DESKTOP-0.4 packages the app, no shipped binary is hardened.**

## Single instance

The lock is scoped to the user-data directory:

1. The first launch takes the lock and runs normally.
2. A second launch with the same profile does not create a window. Before
   it is ready, it signals the first instance and exits with code 0.
3. The first instance restores its window if minimized and focuses it.
4. The open document is never touched.

This also works while the close warning is open. The tests give each
launch its own `--user-data-dir`, so they never share a lock.

## Lifecycle

- The window shows on `ready-to-show`, or on a failed main-frame load, so a
  broken start is never an invisible process holding the lock.
- Closing asks "Closing Layoutry will discard your current unsaved
  document. Continue?" **Cancel** is the default. Repeated close requests
  absorb into one dialog, and a confirmed close exits once, with code 0,
  leaving no child processes. A Windows session end closes without asking.
- Reload shortcuts (Ctrl+R, Ctrl+Shift+R, F5, Shift+F5, Ctrl+F5) are
  swallowed. Editor and text-editing shortcuts are untouched.

## Offline guarantees

| Phase                                                  | Network                                                                                             |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Development and build (`npm install`, `desktop:build`) | **Required**: npm registry, Electron binary download, and Google Fonts for Inter via `next/font`.   |
| Packaged app at runtime                                | **Not required.** Every editor asset, including Inter, comes from the bundled export over `app://`. |
| User-authored remote URLs (images, media, iframes)     | Optional content. It simply fails to load offline; the editor keeps working.                        |

How the suite proves offline startup: every launch routes all http(s)
traffic to a dead proxy (`--proxy-server=http://127.0.0.1:9`, loopback
included). A session-level request recorder also cancels and records any
network request. The page's own resource timing must list only
`app://layoutry/` URLs.

Limitations of this approach:

- The recorder is installed a moment after launch, so the very first
  requests are covered by the dead proxy and resource timing instead.
- Chromium-internal traffic outside the web session (for example DNS
  prefetch) is not observed.
- Nothing here simulates a machine with no network adapter. Do that
  manually in DESKTOP-0.5.

## Known alpha limitations

- No project persistence: closing discards the document. Work survives
  only as long as the window is open.
- Not packaged yet: no ZIP, installer, signing or auto-update. SmartScreen
  will warn on unsigned builds.
- High-DPI scaling and multi-monitor placement rely on Electron's
  per-monitor DPI handling. They have not been tested beyond the
  developer's own display. The window opens on the primary display,
  sized to fit its work area.
- Renderer crashes are not handled specially yet. The window stays open
  and can be closed.
- Performance numbers (`e2e/desktop/performance.spec.ts`) are
  single-machine baselines that include Playwright overhead, not
  benchmarks.

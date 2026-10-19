# ADR-0002: Electron Desktop Shell

**Status:** Accepted

**Date:** 2026-10-19

## Context

Layoutry needs a fully offline Windows 10/11 x64 build for a small group
of alpha testers who have no Node.js, browser setup or hosted server. The
browser version must keep working unchanged and later coexist with a
hosted SaaS version.

The DESKTOP-0.1 feasibility audit verified that the app is one static
route (`/`) rendering a fully client-side editor: no API routes, route
handlers, server actions, middleware, cookies/headers, runtime environment
variables or `next/image`. A scratch `output: "export"` build succeeded and
ran in Chromium with all non-loopback traffic blocked, with Inter
self-hosted. Loading that export through `file://` failed, because Next.js
emits root-absolute `/_next/...` asset paths and fonts are CORS-blocked
from an opaque origin.

## Decision

- **Electron** hosts the desktop app. It bundles a pinned Chromium, the
  same engine the editor is already developed and Playwright-tested
  against, so Canvas geometry, pointer events, SVG, transforms and native
  controls behave identically on every tester's machine.
- **Next.js static export** provides the desktop frontend. `next.config.ts`
  switches to `output: "export"` only when `LAYOUTRY_DESKTOP_BUILD=1`
  (set by `npm run desktop:build`); every other build keeps Next's
  default output.
- **`app://layoutry/`** serves that export through a privileged,
  `standard` + `secure` custom protocol. Root-absolute paths resolve
  correctly, the origin is stable (so `localStorage` persists), no
  network port is opened, and a CSP header is attached to every response.
  It replaces both `file://` (broken) and a loopback HTTP server
  (reachable by any local process, origin changes with the port).
- **The editor stays shared.** Everything under `src/` is used unchanged
  by both the browser and desktop builds. No React component, store or
  document type knows it is running in Electron.
- **Desktop-specific code lives in `desktop/`**, outside `src/`:
  `desktop/main/` (entry point, window lifecycle, alpha safeguards),
  `desktop/protocol/` (app:// serving), `desktop/security/` (navigation,
  popup, permission and CSP policy), `desktop/scripts/` (cross-platform
  build/launch helpers). It is compiled separately by
  `desktop/tsconfig.json` into the gitignored `desktop-dist/`. `src/`
  never imports from `desktop/`, and `desktop/` never imports from `src/`.
- **No preload script and no IPC.** The renderer runs with
  `contextIsolation`, `sandbox` and no `nodeIntegration`, and nothing is
  exposed to it. Nothing in the editor needs a native capability yet, and
  every exposed API would be reachable by user-authored content sharing
  the editor's DOM.
- **Local project persistence is deferred** to its own checkpoint. It
  first needs a validated (Zod) document schema and a `.layoutry` file
  format, and then a deliberately narrow, validated preload API. Until
  then the desktop shell blocks reload shortcuts and warns before closing,
  and says plainly that work is not saved.

## Consequences

**Positive:**

- One editor codebase. Browser behavior and deployment are untouched.
- Testers need no Node.js, browser or network. The app makes no runtime
  network requests of its own.
- A small, auditable trust boundary: one origin, deny-by-default
  navigation, popups, permissions and webviews, and no Node.js in any
  renderer.

**Negative / tradeoffs:**

- Electron adds roughly 100 MB (zipped) per build and several hundred MB of
  memory. This is acceptable for a small alpha.
- The CSP must allow inline scripts (Next's bootstrap) and inline styles
  (React `style` props). It blocks remote scripts and plugins but does not
  isolate authored content from the editor DOM.
- Authored iframes still have no `sandbox` attribute. Desktop guards
  contain them (no top-level navigation, popups, permissions, local files
  or app-origin framing), but changing their sandbox semantics is a
  separate product decision.
- Unsigned builds trigger Windows SmartScreen warnings until code signing
  is in place.

## Alternatives considered

- **Tauri 2:** smaller, but uses each machine's WebView2 version (not
  guaranteed on offline Windows 10) and needs a Rust/MSVC toolchain.
  Rendering consistency matters more than size for a visual CSS editor.
- **Bundled Next.js server (`next start` inside Electron):** works, but no
  feature needs a server. It would add startup time, a Node server process
  and port management.
- **Loopback static HTTP server:** works, but the origin changes with the
  port (losing `localStorage`) and the port is reachable by other local
  processes.
- **`file://` loading:** verified broken without rewriting Next's asset
  paths.
- **Electron's `protocol.registerSource`:** serves a directory without a
  JavaScript handler, but it is experimental in Electron 44 and cannot
  attach the CSP header itself.

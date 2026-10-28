# ADR-0010: Export UI on the Existing Engine, Native Saving Through Its Own Capability Channel

**Status:** Accepted

**Date:** 2026-10-28

## Context

EXPORT-1.4 exposes the export engine (ADR-0008, ADR-0009) to users, in the
browser and the Windows desktop app. Several things had to be decided:

- how the UI calls the engine without a second export path;
- how to keep what users download identical to what they inspected;
- how the desktop app writes several generated files safely without
  weakening the hardened project-file bridge (ADR-0005);
- where a future paid-feature check goes.

## Decision

- **One engine call.** The dialog calls `exportHtmlCss`, the function the
  parity suites validate, on the editor store's current document. No
  caching, no DOM scraping, no alternative printer.
- **Snapshot = document object + title.** The store replaces the document
  object on every edit, so identity is the revision. A changed document or
  name marks the preview stale and disables copy, download and save until
  Regenerate. Every delivery uses the files of the snapshot on screen.
- **Composition at the app root.** The export feature already depends on
  the project feature (project limits), so the project feature does not
  import export. `src/app/LayoutryEditor.tsx` composes them;
  `ProjectWorkspace` receives a menu callback and a dialog to render.
- **Browser delivery is per file.** One download per generated file, with
  per-file buttons; no ZIP until EXPORT-1.8.
- **Desktop delivery uses its own capability channel.** Two new IPC
  channels, a separate token registry, and a service that accepts only the
  three fixed file names. The renderer never sends a path. Project tokens
  and export tokens are not interchangeable. Multi-file writes are staged
  to temporary files, then renamed one by one, with rollback that restores
  replaced files and removes only files this export created and nothing
  has changed since.
- **Entitlement at the UI action.** `ExportEntitlement.canExportCode()` is
  asked when the dialog opens. The development implementation allows
  everyone. Production enforcement must happen on a trusted backend.
- **No worker for generation**, on measurement: at the project maximum
  (20,000 elements) generation blocks for at most ~0.36 s, after
  "Generating…" has painted.

## Consequences

- One generator means the parity results stay valid for what users get.
- The desktop bridge grows from 14 to 16 functions (`apiVersion` 3). The
  project-file channels and their checks are unchanged.
- A multi-file export can't be atomic on Windows. A rename failure is
  rolled back; a crash between renames can leave a mix of old and new files,
  never a partly written file. Temporary files are recognizable by their
  `.layoutry-export-tmp` extension.
- Keyboard shortcuts that edit the document still reach the editor while a
  modal dialog is open (existing behaviour, not changed here). The stale
  check is what keeps an export consistent in that case.
- A client-side entitlement check is not payment enforcement; that needs
  the backend, when billing exists.

See [docs/architecture/export-ui.md](../architecture/export-ui.md).

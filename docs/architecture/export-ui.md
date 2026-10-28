# Export UI, Downloads and Desktop Saving (EXPORT-1.4)

**File › Export Code…** (and the header's **Export** button) opens the
Export Code dialog. It generates HTML and CSS from the current design with
the existing engine ([export-engine.md](./export-engine.md)), shows the
generated files as text along with the engine's diagnostics, and then
copies, downloads (browser) or saves natively (desktop) exactly the files
on screen. The decisions are recorded in
[ADR-0010](../decisions/ADR-0010-export-ui-and-native-save.md).

## Export Code is not Save

| Command          | What it produces                                    |
| ---------------- | --------------------------------------------------- |
| Save / Save As…  | The editable `.layoutry` project                    |
| Download Project | The editable `.layoutry` project, as a download     |
| Export Code…     | Generated source: `index.html`, `styles.css`, `script.js` |

Exporting never saves the project, never writes a `.layoutry` file and never
changes the project's saved or unsaved state. Export Code… sits in its own
group at the end of the File menu, after the project commands.

## Where things live

- `src/features/export/components/ExportCodeDialog.tsx`: the dialog, built
  on the shared `Dialog` primitive (`size="xl"`).
- `src/features/export/hooks/useExportCodeSession.ts`: the dialog's state
  machine (entitlement, generation, stale detection, copy/download/save).
- `src/features/export/stores/useExportDialogStore.ts`: whether the dialog
  is open (see Performance below).
- `src/features/export/desktop/desktopExportFiles.ts`: the renderer side of
  native saving, with every result validated by Zod.
- `desktop/export/exportFileService.ts`: the main-process service behind
  the two export IPC channels.
- `src/app/LayoutryEditor.tsx`: the composition root. The export feature
  already depends on the project feature (project limits), so the project
  feature never imports export. `ProjectWorkspace` only receives a menu
  callback and a dialog to render (`codeExport`).

## Generation and stale previews

- **Opening** checks the entitlement, then calls `exportHtmlCss` on the
  editor store's current document: the in-memory document, including
  unsaved edits. Never an autosave, a recovery snapshot or the last save.
- **The snapshot** is the exact document object plus the title (the
  project name). The editor store replaces the document object on every
  edit, so object identity is the revision.
- **Stale:** if the document or project name changes while the dialog is
  open (an undo shortcut, a recovery restore, a desktop file opened from
  Explorer), the preview is marked stale. Copy, download and save are
  disabled until **Regenerate**. The stale code stays visible as it was.
- **Desktop saves re-check** the snapshot after the native dialog closes.
  If the design changed meanwhile, nothing is written.
- **Switching output** (single file / separate files) regenerates from the
  current document.
- **States:** checking → generating → ready (with diagnostics), refused
  (error diagnostics: no files), failed (the engine threw: Try again), or
  denied (entitlement).

## Diagnostics

Every engine diagnostic is listed, most severe first, with severity
(Error, Warning, Note), message, element (named as in the Structure panel,
e.g. `Primary Button (button)`) and property. The list scrolls; nothing is
dropped. Errors mean the engine produced no files, so nothing can be
exported. Warnings don't block.

## Code preview

- One tab per file (arrow keys, Home and End move between tabs), with its
  size.
- A `<pre>` holding one text node: generated markup is never parsed or
  rendered, so no generated script can run in the editor. Text is
  selectable; long lines scroll inside the box, not the page.
- **Bounded:** files over 400,000 characters show their first lines (cut
  at a line boundary) with a notice. Copy and downloads always use the
  complete file. Measured `<pre>` layout cost in Chromium: about 90 ms at
  400,000 characters, 480 ms at 2 MB and 1 s at 5 MB.
- No syntax highlighting and no editor dependency.

## Copy

**Copy code** copies the selected file's exact text with
`navigator.clipboard.writeText`. Where that is missing or refused, it falls
back to a hidden read-only textarea and `execCommand("copy")`. Success and
failure are announced; a failure says to select and copy by hand. Windows
itself stores clipboard text with CRLF line endings.

## Browser downloads

- **Single HTML file:** `index.html`, via a Blob object URL that is revoked
  10 seconds after the click (`src/lib/downloadTextFile.ts`, shared with
  Download Project).
- **Separate files:** "Download *selected file*" for one file, and
  "Download all files", which starts one download per file. Browsers may ask
  permission for multiple downloads, or block them; the message says so and
  points to the per-file button. The dialog says to keep the files together.
- The message says a download *started*. Only the browser knows whether the
  user kept it.
- Nothing is uploaded; there is no backend.

## Desktop saving

### Flow

- **Single HTML file:** the native Save dialog ("Export HTML File", HTML
  filter, default name `index.html`). Windows asks before replacing an
  existing file. A name typed without `.html`/`.htm` gets `.html`, but only
  if that file doesn't already exist.
- **Separate files:** the native folder picker ("Choose Export Folder").
  If any of `index.html`, `styles.css` or `script.js` already exists there,
  Layoutry lists them and asks: **Replace** or **Keep existing files**.
  Nothing else in the folder is touched.
- The result names the files and folder, never a full path. Cancel saves
  nothing and says so.

### Security boundary

- **Two fixed channels:** `layoutry:export:choose-destination` and
  `layoutry:export:write`. They are checked like every other channel: the
  sender must be the main window's top frame on `app://layoutry/`; the
  payload must have exactly the expected keys.
- **No paths from the renderer.** The main process shows the dialog and
  returns an opaque 128-bit token plus a display label. Tokens are bound to
  the window, kept in their own registry (at most 4 per window), work for
  one successful write, and are revoked when the window closes or crashes.
  A project-file token can't be used on the export channel, or the reverse.
- **Fixed file names.** The renderer sends files as `{path, content}`; the
  only accepted names are exactly `index.html`, `styles.css` and
  `script.js`. A single-file destination takes exactly `index.html` (written
  to the chosen file name); a folder needs `index.html` and `styles.css`.
  No duplicates, at most 16 Mi characters per file and 32 Mi in total.
- **No links.** The destination folder and every target file must not be a
  symbolic link or junction (`lstat`); target files must be regular files.
- **Nothing executes.** Files are written as text; nothing is opened.

### Multi-file writes and rollback

Windows can't replace several files in one atomic step, so a write is
staged:

1. Check the folder, read the current state of each target (missing, or
   its bytes and SHA-256), and stop with a conflict if files exist and the
   user hasn't confirmed.
2. **Stage:** write and flush every file to a uniquely named temporary file
   (`.<name>.<random>.layoutry-export-tmp`) in the destination folder. If
   this fails (disk full, permissions), the temporaries are removed and
   nothing visible has changed.
3. **Replace** each file by renaming its temporary over it, `index.html`
   last so the folder never links to files that aren't there yet. Just
   before each rename, the target is checked again: a file that appeared or
   changed since step 1 stops the export. Renames blocked for a moment
   (antivirus, indexer) are retried briefly.
4. **On failure**, files already replaced are put back: earlier contents
   restored atomically, and new files removed only if they still hold
   exactly what this export wrote. The message says what happened; if
   something couldn't be put back, it names the files.
5. **Read back** every written file and compare hashes.

Limit: the check-then-rename window in step 3 can't be closed on Windows
(no compare-and-swap rename), the same as for project files
([desktop-files.md](./desktop-files.md#save-races)).

## Entitlement

`ExportEntitlement.canExportCode()` (`types/exportEntitlement.ts`) is asked
once when the dialog opens. A denial shows its message instead of code.
Today the only implementation is `developmentExportEntitlement`, which
allows everyone: there are no accounts, subscriptions or paid badges.

A check in the page is a product gate, not security: anyone can change
client code. When subscriptions exist, the implementation must ask a
trusted backend, and anything that must be enforced has to be enforced
there. The engine itself (`exportHtmlCss`) knows nothing about
entitlements.

## Offline

Generation, preview, copy, downloads and desktop saving use no network and
no CDN; the runtime is inline or in `script.js`. The exported page works
offline from disk. Resources the design references by URL are **not**
bundled: images, video and other media on `http(s)` stay on the internet,
and the dialog says how many the page loads. Relative paths must be
published next to the page (an engine Note says so).

## Accessibility

- The native modal `<dialog>`: focus starts on Cancel and stays inside;
  Escape and the Close button close it; focus returns to whatever opened
  it.
- While a save is running, Escape, the backdrop and Close don't close it,
  and the actions are disabled, so an operation can't run twice.
- Output is a native radio group (arrow keys); files are an ARIA tab list.
- Generation results ("Code ready: 3 files, 1 warning.") and transfer
  results are announced in live regions; errors use `role="alert"`; the
  overwrite question is an `alertdialog`.
- Visible focus rings on every control; light and dark themes use the
  existing tokens (code text contrast ≥ 7:1, body ≥ 4.5:1, tested).

## Responsive layout

The dialog is at most 64 rem wide, 1 rem from each window edge, and at most
the window height minus 2 rem. Its body is a column: options and
diagnostics at their natural height, and the code preview takes the rest,
scrolling on its own. Tested at 1440×900, 1280×800, 1024×768 and 900×600
(the editor's minimum window).

## Performance

Measured in the dev server on the reference machine with 2,000 and 19,999
elements (the project maximum, same document shape as the engine's scale
test):

| Measure                                   | 2,000 elements | 19,999 elements |
| ----------------------------------------- | -------------- | --------------- |
| Click → "Generating…" painted             | 47 ms          | 155 ms          |
| Generation (`exportHtmlCss`)              | 41–70 ms       | 256–359 ms      |
| Click → code visible                      | 133 ms         | 596 ms          |
| Switch to styles.css (bounded preview)    | 78 ms          | 198 ms          |
| Prepare all downloads (Blobs, URLs)       | 16 ms          | 42 ms           |
| JS heap growth with the dialog open       | +2 MB          | +67 MB          |
| Longest main-thread task                  | 98 ms          | 359 ms          |

The largest single blocking task at the project maximum is under 0.4 s, and
"Generating…" is on screen before it, so generation stays on the main
thread: a worker would add a structured clone of the document and more
infrastructure for little gain. Most of the 155 ms before the first frame at
20,000 elements is the browser making the page inert for the modal dialog.
Keeping the open state in a store saved another ~80 ms: re-rendering the
editor root would re-render every Canvas node through the drag-and-drop
context.

## Future: ZIP packaging (EXPORT-1.8)

Separate files are downloaded one by one today. A ZIP would make that one
download. It belongs at the delivery step, not in the engine: the engine
already returns the file list with relative paths, and the desktop service
already validates names. Points to settle then: a dependency-free ZIP
writer (store or deflate), a size limit, and keeping the per-file buttons
for users who don't want an archive.

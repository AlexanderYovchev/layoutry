# Project File Format (`.layoutry`)

Layoutry's canonical, versioned project format (PROJECT-1.1). One format
serves browser storage (PROJECT-1.2, see
[project-storage.md](./project-storage.md)), desktop `.layoutry` files
(PROJECT-1.3) and future cloud storage. The decision is recorded in
[ADR-0003](../decisions/ADR-0003-versioned-project-format.md).

- **Code:** `src/features/project/`. Public API: `src/features/project/index.ts`.
- **Document schema:** `src/features/editor/schemas/editorDocumentSchema.ts`.

## Structure (format version 1)

```json
{
  "format": "layoutry-project",
  "formatVersion": 1,
  "project": {
    "id": "0b7f1c2e-5c1a-4c8e-9a51-2f4d6f0d9e11",
    "name": "Untitled Project",
    "createdAt": "2026-10-26T09:30:00.000Z",
    "updatedAt": "2026-10-26T09:30:00.000Z"
  },
  "document": { "id": "page-root", "tag": "page", "children": [] }
}
```

- `document` is the editor's own authored tree (`EditorElementNode`, root
  tag `"page"`), stored unchanged. There is no second document model.
- **Encoding:** UTF-8 JSON, two-space indentation, trailing newline.
  Object keys are sorted (the envelope keeps the order shown above). The
  same project always produces byte-identical output.
- **Undefined properties are omitted.** Absent and undefined mean the same
  thing in the editor model.
- **Extension:** `.layoutry`.
- **Media type:** `application/vnd.layoutry.project+json`.

## What is persisted, and what is not

| Persisted (authored)                                                                                                                           | Not persisted (session / app state)                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| The whole element tree: ids, tags, nesting and child order                                                                                     | Selection; hover and drag state                                                                           |
| Text, display names, `htmlId` and `className`                                                                                                  | Undo/redo history (`past`, `future`) and in-progress `transactionSnapshot`                                |
| Layout: Flow/Free mode, Flex/Grid container and child settings, free geometry, dimensions, size constraints, aspect ratio, child-resize policy | Clipboard                                                                                                 |
| Styles: spacing, typography, background (image and gradient), border, radius, shape, shadows, filters, display/visibility, position            | Design/Preview mode and Preview runtime visibility                                                        |
| Media, form, progress and SVG attributes, including the SVG vector scene                                                                       | SVG edit-mode state (editing node, selected objects, tool, draft)                                         |
| Interactions, initial Preview visibility, transitions, transforms, style locks                                                                 | Snap guides; the Snap on/off preference; panel widths and collapse state (`localStorage`); editor notices |
| Project metadata: id, name, created/updated timestamps                                                                                         | File paths, storage locations, user or account ids, subscription data, generated HTML/CSS                 |

## Serialization (`serializeProject`)

- Pure:
  - it never mutates its input, regenerates ids or changes timestamps;
  - `touchProjectMetadata` updates `updatedAt` only when a caller asks.
- It throws `ProjectSerializationError` rather than write a file this
  build could not load back:
  - the document's integrity is checked first, which is safe on cyclic
    in-memory input;
  - non-finite numbers and non-plain objects are refused;
  - the finished text is run through the real loader before it is
    returned.

## Loading (`parseProjectFile`)

Pure and total. It never throws on bad input, never touches editor
state, and returns either `{ ok: true, project }` or
`{ ok: false, error: { code, message, path? } }`. It never returns a
partially valid document. Callers that read bytes (the browser import and
the desktop main process) decode them as strict UTF-8 first: a byte order
mark is skipped, and bytes that aren't UTF-8 are refused
(`invalid-encoding`) rather than silently replaced (PROJECT-1.5). The
pipeline then runs in this order:

1. **Size limit** on the raw text, checked before parsing.
2. **`JSON.parse`.** Invalid JSON gives `invalid-json`.
3. **Iterative structure scan**, using an explicit stack rather than
   recursion. It checks JSON depth, the total number of values, and the
   forbidden keys `__proto__`, `constructor` and `prototype`, failing with
   `too-complex` or `forbidden-key`. Hostile depth therefore never reaches
   recursive code.
4. **Format identification:** `format` must be `"layoutry-project"`,
   otherwise `not-a-project`.
5. **Version dispatch** (see the migration policy below).
6. **Strict Zod schema.** Unknown fields are rejected everywhere. Types,
   enums and finite numbers are enforced (`1e999`, which parses to
   Infinity, is rejected). Tags must be known editor tags. Element and
   project ids must match `[A-Za-z0-9_-]{1,128}`. Project names must
   not be blank or contain control characters (the same rule the Rename
   dialog uses, `rules/projectName.ts`). Timestamps must be ISO 8601 UTC. URL fields reuse the Inspector's own checks: no `javascript:`
   in `href`, `src` or `poster`, and no CSS-breaking characters in
   background images. Failures give `invalid-structure`, with a path.
7. **Document integrity** (`integrity`, or `too-complex` for limits):
   - the root is `"page"`, and `"page"` appears nowhere else;
   - element ids are unique;
   - only container tags have children;
   - every interaction targets an existing element;
   - ids are unique within each shadow, gradient-stop, SVG-object and
     interaction list;
   - depth and element-count limits hold.

Deliberately **not** enforced, so that no legitimate project is ever
rejected:

- Inspector value ranges (for example spacing 0–500), because the
  Inspector clamps on input and out-of-range values are harmless.
- Parent-specific child rules (for example `ul` → `li`).
- `createdAt ≤ updatedAt`, which clock changes can legitimately violate.

## Limits (`DEFAULT_PROJECT_LIMITS`)

| Limit                 | Value            | Why                                                                                      |
| --------------------- | ---------------- | ---------------------------------------------------------------------------------------- |
| File size             | 16 Mi characters | The starter page is about 5 KB. The headroom is for inline `data:` URLs in image fields. |
| Elements              | 20,000           | Far beyond what the Canvas can usefully show; bounds validation and render cost.         |
| Element nesting depth | 100              | Real layouts rarely exceed 20–30; keeps recursive validation and renderers safe.         |
| JSON depth            | 216              | Two JSON levels per element, plus at most about 6 for settings objects.                  |
| JSON values           | 2,000,000        | Bounds total validation work.                                                            |

The tests confirm that a 5,000-element project loads in well under 2 s,
and that 100,000-level nested JSON is rejected without a stack overflow.

## Versioning and migration policy

- `formatVersion` is an integer. Version 1 is current, and the only
  version so far; its canonical bytes have been stable since PROJECT-1.1
  (pinned by a file written by the PROJECT-1.1 code, see "Compatibility
  fixtures" below).
- **Newer than this build:** refused with `unsupported-version`, and a
  message telling the user to update Layoutry. Loading it best-effort
  would silently drop its new fields on the next save.
- **Missing, non-integer or below 1:** refused.
- **Older than this build:** upgraded by `migrateProjectFile`
  (`utils/projectFormatMigrations.ts`, PROJECT-1.5), one step at a time
  (v1 → v2 → …), each step a `FormatMigration` in
  `PROJECT_FORMAT_MIGRATIONS`. The list is empty today.

### Migration contract

Every future migration must:

- **carry every authored field forward**, never dropping content it
  doesn't understand;
- **be pure and deterministic:** no I/O, no clock, no random ids;
- **throw** on input it can't upgrade rather than guess;
- **set `formatVersion`** to its target version (checked).

The dispatcher guarantees the rest, and tests pin it with synthetic
versions (`projectFormatMigrations.test.ts`):

- the caller's object is never modified (migrations run on a clone);
- a throwing or sloppy migration fails the load with `migration-failed`
  and no partial result;
- a gap in the chain is `unsupported-version`, never a skipped step;
- the result goes through the target version's strict schema and the
  integrity check, exactly like a file written in that version.

**Failure is non-destructive by construction.** Loading never writes:
a failed migration leaves the file, library record or recovery record
exactly as it was, and the open just reports the error.

**Rollback.** Nothing is rewritten on load, so there is nothing to roll
back. The original stays on disk until the user saves. A future format 2
must decide one policy before shipping, because saving writes the new
format, which older builds refuse ("made by a newer version"). The
recommendation is that the first save of a migrated native file asks
whether to update the file or use Save As to keep the old one.

### Adding a version

1. Bump `CURRENT_PROJECT_FORMAT_VERSION`.
2. Add a `projectFileV{n}Schema` and switch `parseProjectFile` to it.
3. Append `{ from: n - 1, migrate }` to `PROJECT_FORMAT_MIGRATIONS`.
4. Add a frozen fixture written by the new version, and keep every
   older fixture passing.

Dropping support for an old version means raising
`OLDEST_SUPPORTED_FORMAT_VERSION`; those files then get
`unsupported-version`.

Any new authored field in `EditorElementNode` requires a format version
bump, because the strict schema would otherwise reject documents
containing it. The schema's compile-time drift guards (`assertSameType`)
make `npm run typecheck` fail until the schema matches the TypeScript
model, which forces that decision.

### Other versioned data

| Data                         | Version                                                              | Newer version found                               |
| ---------------------------- | -------------------------------------------------------------------- | ------------------------------------------------- |
| Browser library (IndexedDB)  | `layoutry-projects` v1                                               | `VersionError` → "reload this page"; never opened |
| Browser recovery (IndexedDB) | `layoutry-recovery` v1, separate from the library                    | same                                              |
| Recovery records             | `recoveryVersion` 1 (record only; the text inside is a project file) | "made by a newer version of Layoutry", kept       |
| Native files                 | the project format above, as UTF-8 bytes                             | refused, file untouched                           |

IndexedDB upgrades only ever add stores (`onupgradeneeded` creates what is
missing). A blocked upgrade (an old tab still open) is reported, never
forced.

### Compatibility fixtures

`test/fixtures/persistence/` holds byte-exact data written by earlier
checkpoints:

- a PROJECT-1.1 `.layoutry` file with every element type;
- PROJECT-1.2 library records;
- PROJECT-1.4 browser and desktop recovery records.

Tests check that each still opens, unchanged and without rewriting
anything. See that folder's README. Never regenerate a fixture; add a new
one.

## Applying a loaded project (restoration contract)

```ts
const result = parseProjectFile(text); // pure; nothing changes yet
if (result.ok)
  useEditorStore.getState().replaceDocument(result.project.document);
else showError(result.error); // the current document is untouched
```

`replaceDocument` is a single store update, so subscribers never see a
half-applied load.

- **Swapped in:** `document`, and `persistedDocument` (the saved
  baseline) is set to the same document.
- **Reset:** selection, undo/redo history, the in-progress transaction,
  notices, Preview runtime visibility, SVG editing state and snap guides.
  The mode returns to Design.
- **Kept:** the clipboard and the Snap preference, both app-level.

A store test fails whenever a new store field is added without deciding
which group it belongs to.

## Unsaved changes (dirty state)

`selectHasUnsavedChanges(state)` is `document !== persistedDocument`.
This works because:

- every committed edit creates a new document object;
- undo and redo restore the exact snapshot objects, so edit → save →
  undo is dirty, and → redo is clean again.

Selection, Preview and panel changes never affect it.

`markDocumentPersisted(document)` must receive the exact object that was
serialized, so edits made during an asynchronous save still count as
unsaved.

Manually re-typing the old value is reported as dirty. That's the safe
direction.

Renames are tracked separately by the project session store (PROJECT-1.2);
see [project-storage.md](./project-storage.md#project-identity-and-dirty-state).

## File locations are not project content

A desktop file's location (PROJECT-1.3) is session state only: an opaque
token in the project store. The file never contains its own path, so
`.layoutry` files stay portable between folders and machines.

## Platform boundaries

The project feature is pure TypeScript with no filesystem, Node, DOM or
network access. It uses only `JSON`, Zod and Web Crypto (`randomUUID`,
falling back to `getRandomValues` outside secure contexts). It runs
identically in the browser, the Electron renderer and Node tests.

Storage is the caller's job:

- **Browser storage (PROJECT-1.2):** IndexedDB, in the renderer — see
  [project-storage.md](./project-storage.md).
- **Desktop files (PROJECT-1.3):** read and written by the Electron main
  process behind a narrow, validated preload API. The renderer still parses
  with `parseProjectFile`.
- **Cloud (later):** project metadata intentionally carries no owner or
  account fields.

## Known limitations

- Browser Save/Open arrived in PROJECT-1.2; native desktop files are
  PROJECT-1.3. There is no autosave: PROJECT-1.4 keeps separate recovery
  snapshots instead. A snapshot carries this same canonical text inside a
  small record with its own `recoveryVersion`; that version describes
  only the record, and the text inside is loaded (and migrated) by
  `parseProjectFile` like any file — see
  [project-recovery.md](./project-recovery.md#recovery-record).
- PROJECT-1.2 tightened project names (no control characters). A file
  hand-edited to put one in the name opens in PROJECT-1.1 and not later.
  PROJECT-1.1 had no way to rename, so no file it wrote is affected.
- Inline `data:` URLs count toward the 16 Mi limit. Very large embedded
  images will need asset storage later.

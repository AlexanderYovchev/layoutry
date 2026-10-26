# Project File Format (`.layoutry`)

Layoutry's canonical, versioned project format (PROJECT-1.1). One format
serves browser storage (PROJECT-1.2), desktop `.layoutry` files
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
partially valid document. The pipeline runs in this order:

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
   project ids must match `[A-Za-z0-9_-]{1,128}`. Timestamps must be ISO
   8601 UTC. URL fields reuse the Inspector's own checks: no `javascript:`
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

- `formatVersion` is an integer. Version 1 is current.
- **Newer than this build:** refused with `unsupported-version`, and a
  message telling the user to update Layoutry. Loading it best-effort
  would silently drop its new fields on the next save.
- **Missing, non-integer or below 1:** refused.
- **Adding a version:**
  1. Bump `CURRENT_PROJECT_FORMAT_VERSION`.
  2. Add a `projectFileV{n}Schema`.
  3. Add a dispatcher case in `migrateToCurrentVersion` that upgrades the
     previous raw object by exactly one step (v1 → v2 → …), carrying every
     authored field forward.

  A migration may never drop content it does not understand. Dropping
  support for an old version is an explicit case returning
  `unsupported-version`.

- Any new authored field in `EditorElementNode` requires a format version
  bump, because the strict schema would otherwise reject documents
  containing it. The schema's compile-time drift guards
  (`assertSameType`) make `npm run typecheck` fail until the schema
  matches the TypeScript model, which forces that decision.

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

Two known simplifications:

- Manually re-typing the old value is reported as dirty. That's the safe
  direction.
- Metadata changes (a rename) are not tracked yet; PROJECT-1.2 adds that
  alongside the project name UI.

## Platform boundaries

The project feature is pure TypeScript with no filesystem, Node, DOM or
network access. It uses only `JSON`, Zod and Web Crypto (`randomUUID`,
falling back to `getRandomValues` outside secure contexts). It runs
identically in the browser, the Electron renderer and Node tests.

Storage is the caller's job:

- **Browser storage (PROJECT-1.2):** in the renderer.
- **Desktop files (PROJECT-1.3):** read and written by the Electron main
  process behind a narrow, validated preload API. The renderer still parses
  with `parseProjectFile`.
- **Cloud (later):** project metadata intentionally carries no owner or
  account fields.

## Known limitations

- There is no Save/Open UI, storage or autosave yet; that is PROJECT-1.2
  and 1.3.
- The project name in the header is still static, and metadata isn't held
  in the editor store yet.
- Inline `data:` URLs count toward the 16 Mi limit. Very large embedded
  images will need asset storage later.

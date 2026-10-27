# Export Engine (HTML/CSS)

Layoutry's Export Engine turns the authored document into source code. It
reads the typed document model, never the rendered DOM. EXPORT-1.2 delivers
the foundation: a pure HTML/CSS exporter and a target-independent
intermediate representation (IR). Tailwind, React and Vue will become
printers over that same IR. The decisions behind this design are in
[ADR-0008](../decisions/ADR-0008-export-shared-styling-and-ir.md).

**Visual fidelity is the primary acceptance criterion.** An exported page
must look like the page the user built on the Canvas, in Preview.

## Pipeline

```text
EditorElementNode (authored document)
  └─ buildExportDocument()          src/features/export/utils/buildExportDocument.ts
       limits → schema → traversal → shared style recipes → validation
       = ExportDocument (IR)         src/features/export/types/exportIr.ts
  ├─ printExportStylesheet()        base reset + page + defaults + element rules
  └─ printExportHtml()              HTML5 document, embedded or linked CSS
= exportHtmlCss(document, { mode }) → { ok, files, diagnostics }
```

Everything here is pure and deterministic. There is no DOM, no React
runtime, no filesystem, no store, no Electron and no account or billing
state. The public API is `src/features/export/index.ts`:

```ts
exportHtmlCss(document, { mode: "standalone" | "separate", title?, lang? })
// → { ok: boolean, files: { path, content, mediaType }[], diagnostics }
buildExportDocument(document) // → { ok: true, document: ExportDocument } | { ok: false, diagnostics }
```

- **standalone** produces one `index.html` with the stylesheet in `<style>`.
- **separate** produces `index.html`, which links `styles.css` by a relative
  path, plus `styles.css`.

Both modes print the same IR and the very same stylesheet text, so they
render identically. Tests check this byte for byte and in a browser.

## Shared styling — one set of design rules

The Canvas and the export compose a node's appearance from the same code.
It lives in the canvas feature and is exposed through
`src/features/canvas/index.ts`, which re-exports only pure modules (never
React components).

| Module | What it owns |
| --- | --- |
| `canvas/utils/resolve*Style.ts` (pre-existing) | One CSS section each: node → style object. |
| `canvas/utils/elementStyleRecipes.ts` | For each element family: which resolvers apply, in which order, and which default presentations the node gets. Previously this was inlined in each element component. |
| `canvas/utils/documentDefaultStyles.ts` | Every default presentation the Canvas applies (heading size, button look, legacy padding, page surface, …). Each entry holds the Tailwind `classes` the Canvas renders **and** the exact CSS `declarations` export emits. |

Canvas element components now call the recipes:

- `style={recipe.style}`
- `className={cn(documentDefaultClasses(recipe.defaults), <editor-only state>, node.className)}`

The Canvas output is unchanged. The full existing suite passed after the
refactor.

Two guards keep the two sides from drifting:

- `documentDefaultStyles.test.ts` compiles every entry's `classes` with the
  repo's own Tailwind and checks that the result equals its `declarations`,
  after Tailwind's own cascade order.
- `canvasExportParity.test.tsx` renders the real Canvas components in Preview.
  For every node of every fixture, and all 81 catalog entries, it asserts
  that the export has the same tag, inline style, default classes,
  attributes and text.

Editor-only state stays in the components and is never exported. That
covers drag opacity, editing outlines and cursors, `readonly` guards,
`data-node-*` attributes, event handlers, media interaction shields, the
empty-image placeholder icon, and SVG's drag-to-draw `user-select: none`.

## The IR

`ExportDocument` is in `src/features/export/types/exportIr.ts`:

- `root: ExportElement` — the page root.
- `ExportElement` has these fields:
  - `tag`;
  - `sourceNodeId`;
  - a stable `styleKey` (`node-<n>` in document order, `node-<n>-media`,
    `node-<n>-shape-<i>`);
  - `defaultStyles` (ids into the shared table);
  - `declarations` (ordered, validated CSS);
  - `attributes` (validated, unescaped; `true` = boolean attribute);
  - `authoredClassNames`;
  - `children`.
- `ExportText` holds raw text. Printers escape it for their own syntax.
- `interactions` — authored click bindings, kept for the EXPORT-1.3 runtime.
- `assets` — every URL the page loads, classified as remote, relative or data.
- `diagnostics`.

The IR describes the authored design only. It contains no class names, no
escaping and no file layout. That makes it the input for every future
printer: a Tailwind printer maps `declarations` to utilities, React maps
`attributes` to props, and Vue maps the tree to a template.

## HTML generation rules

- The document is `<!DOCTYPE html>`, `<html lang>`, UTF-8 charset, a
  viewport meta and `<title>`. The page root is the body's only child. No
  script is ever emitted.
- Elements use their real tags: semantic sectioning, `h1`–`h6`, lists,
  tables, forms, media, `svg`, `dialog`, `hr` and `progress`. A legacy
  `body` node and the virtual `page` root become `<div>`s. A tag with no
  Canvas renderer (`blockquote`) becomes an unstyled `<div>` around its
  children, matching the Canvas `FallbackElement`, and is diagnosed.
- Image, video, audio and iframe keep the Canvas structure: an outer layout
  frame `<div>` around the genuine media element. The authored id and class
  go on the inner element.
- Attribute order is fixed: `id`, `class`, then the element's own
  attributes in recipe order. Boolean attributes print bare (`checked`,
  `controls`, `open`, `hidden`). Void elements have no end tag. SVG
  children self-close.
- Text and attribute values are escaped (`& < > " '`). A `<textarea>`
  value that starts with a newline gets the extra newline the HTML parser
  strips.
- **Whitespace:** React renders no whitespace between elements, and a
  space between inline-level siblings (links, buttons, inputs) would shift
  them. Children are therefore printed on their own indented lines only
  where whitespace provably cannot render:
  - a flex or grid container (judged by its final `display`);
  - table structure, `select` and `svg`.
  Everywhere else children are printed back to back.
- **Preview semantics:**
  - authored transitions are emitted;
  - `autoplay` is emitted as authored;
  - a node authored hidden in Preview gets `hidden`;
  - a dialog that starts closed has no `open`, and one that starts open
    gets `open` (non-modal, until the EXPORT-1.3 runtime).

## CSS generation rules

The stylesheet is printed in cascade order:

1. A base reset: a curated subset of Tailwind v4.3.2 Preflight, with MIT
   attribution, covering the rules that affect elements the editor can
   produce. Then the editor root's font smoothing on `html`.
2. `body` takes the shared `page-surface` default: white background, the
   Tailwind sans stack, zinc-950 text, `color-scheme: light`.
3. `.ly-<default>` rules for the default presentations the page uses, in
   shared table order (plus the legacy body's `@media` rule and the
   dialog `::backdrop`).
4. `.ly-node-<n>` rules, one per element with authored styles, in
   document order.

Every generated selector is a single class, so source order alone decides
the cascade. Defaults precede authored rules, exactly as the Canvas's inline
styles beat its default classes. Values come from the recipes through
React's own rules (`serializeStyleObject`): `px` for non-zero numbers
except React's unitless list, and key order kept so shorthand/longhand
overrides resolve identically. Nothing is rounded. Colors keep their
authored notation, and theme colors use Tailwind's exact `oklch()` values.

**Class names.** Everything generated uses the reserved `ly-` prefix.
Authored classes using it are dropped with a diagnostic. Numbers come from
document order, never from random editor ids, so identical documents give
identical names.

## Defaults and reset policy (what is exported)

What the Canvas shows **on the authored page** is exported, including its
defaults:

- the Preflight baseline;
- each element's default look (every heading is `text-3xl` semibold, the
  button is a dark pill, links are blue and underlined, form controls,
  tables);
- the legacy fallbacks for unset fields (container `p-8`, flex column with
  `gap-4`, faint `zinc-100` border, `rounded-lg`, media placeholder frame
  and dashed border);
- the page surface.

What frames the page **inside the editor** is not exported:

- the sheet's `max-width: 1440px`, `min-height`, border, shadow and rounded
  corners;
- the workspace and its padding;
- zoom, selection, hover and resize overlays;
- snap guides, the media shields and the empty-image placeholder icon.

The exported page is fluid. It is as wide as the browser and is never
pinned to the editor's presentation width.

## Security policy

Project files are untrusted. Export applies the project's own boundaries
first: element and depth limits (scanned iteratively), then the strict
editor schema. Either failure refuses the export with no files. After that:

- **URLs**, by context (`exportUrlPolicy.ts`). Scheme detection mirrors
  the browser URL parser: tabs and newlines are stripped anywhere, and
  C0/space are trimmed.
  - Links allow `http`, `https`, `mailto`, `tel`, fragments and relative paths.
  - Images allow `http`, `https`, relative paths and `data:image/*`.
  - Media allow `http`, `https`, relative paths and `data:video|audio/*`.
  - Iframes allow `http`, `https` and relative paths only.
  - `javascript:`, `vbscript:`, `data:text/html` and the rest are refused.
    A link falls back to the Canvas's own `#`; media lose the attribute.
  - `blob:` and `file:` are refused as non-portable.
- **CSS values** (`validateExportCssValue.ts`). Every value must be free of
  `; { } < > \ ! @`, comments and control characters, and its parentheses
  and quotes must be balanced. Color properties must be a real color
  syntax (hex, functional notation including `oklch`/`color-mix`, named
  colors). `font-family` must be a valid family list. Background-image
  URLs are re-checked and re-serialized with CSS string escaping (`<`
  becomes `\3c `). An invalid value is dropped, which is also what the
  browser does with it on the Canvas. The embedded stylesheet is
  re-checked for `</style` before printing.
- **Markup.** Attribute names are generated, but are still checked: no
  `on*` handlers, a strict name syntax, and `data-*`/`aria-*` allowed.
  Authored ids with whitespace are dropped. Duplicate ids are kept with a
  warning. SVG paint must be `none` or a valid color.

## Diagnostics

`{ code, severity, nodeId?, property?, message }`. The severities are:

- `error` — export refused, `files: []`. Causes: an invalid document, over
  the limits, or an unsafe attribute name.
- `warning` — something authored was dropped or replaced, or does not
  behave like Preview yet. Examples: `unsafe-url`, `invalid-color`,
  `interaction-requires-runtime`, `dialog-requires-runtime`,
  `missing-media-source`, `ignored-children`.
- `info` — the output is complete but worth knowing about. Examples:
  `relative-url` (the file must ship next to the page) and
  `control-characters-removed`.

## Visual parity testing

Visual parity is tested at three levels:

1. **Translation**
   (`canvas/utils/documentDefaultStyles.test.ts`): each default's
   declarations equal its compiled Tailwind classes.
2. **Structure and style, jsdom**
   (`export/utils/canvasExportParity.test.tsx`): real Canvas components in
   Preview, compared node by node with the IR through the same CSSOM.
3. **Rendering, Chromium** (`e2e/export-visual-parity.spec.ts`). Each
   fixture in `test/fixtures/export/` is imported into the real editor
   through the project import, and Preview is entered. Then:
   - the page sheet is pinned to a whole-pixel 800 px width (presentation
     width only);
   - the document surface is screenshotted;
   - both export modes are rendered in a clean page at 800 px, with the
     same browser and device scale factor, offline assets only;
   - pixels are compared, along with 89 computed properties and the
     bounding rectangle per element, and the inherited page-root style.
   Colors are compared as painted RGBA, because the app's CSS build
   rewrites theme `oklch()` colors as equivalent `lab()` values.

   Results, screenshots and diff images are written to
   `test-results/export-parity/`. The thresholds are:
   - zero computed-style or geometry differences;
   - identical screenshot size;
   - at least 99% of pixels within 8/255 per channel.

   99% is a quality floor: every remaining difference was inspected.

## Known limitations

- **Interactions** (click show/hide/toggle, dismissal, the modal dialog)
  are exported as static structure and flagged. The runtime is
  EXPORT-1.3. Affected catalog entries: Dropdown Button, Collapsible,
  Basic Tabs, Modal, Drawer, Dismissible Alert, Manual Toast, Popover, and
  the Dialog primitive.
- **No responsive rules exist** in the document model, so none are
  exported. The only media query is the legacy body's `sm:` padding,
  reproduced as-is.
- **Viewport-relative positioning:** `vw`/`vh` and `position: fixed`
  resolve against the browser window on both sides. Inside the editor
  that window is not the page sheet, so these can differ from the Canvas
  by design.
- **Fonts:** authored `font-family` names are not loaded. Both the Canvas
  and the export fall back to installed fonts.
- **Image `alt`** reproduces the Canvas, which uses the element's display
  name. A dedicated `alt` field needs a schema change.
- **Canvas-only React artifacts** that are not reproduced:
  - `value=""` on a checkbox or radio with no authored value (export keeps
    the browser's standard `on`);
  - `muted` set as a DOM property rather than an attribute (export writes
    the attribute).
- **Authored classes** are copied verbatim. On the Canvas, `tailwind-merge`
  can let an authored class that matches a Tailwind utility override a
  default. Export never does this.
- **Large exports** (20,000 elements) take about 0.5 s and produce about
  3.5 MB of output on the main thread. Move them to a worker if the export
  UI ever needs it.

## Future integration points

- **Tailwind (EXPORT-1.5):**
  - map `ExportElement.declarations` to utilities;
  - use `defaultStyles` directly, since their `classes` already exist.
- **React / Vue:** print the same tree. Use `interactions` for state, and
  `attributes` for props or template attributes.
- **Interaction runtime (EXPORT-1.3):** `ExportDocument.interactions` plus
  generated target tokens.
- **Export UI and delivery:** call `exportHtmlCss`. Entitlement checks
  belong at the UI action, never inside the generator.

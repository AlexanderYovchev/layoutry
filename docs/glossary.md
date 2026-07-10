# Glossary

Short definitions of terms as used specifically within Layoutry. This is
not a general web-development glossary — entries describe how the term
applies in this codebase.

**Document model**
The typed, serializable data structure representing a user's canvas
project — the editor's single source of truth. Persistence, undo/redo,
export, validation, migration, and collaboration all read from and write to
this model rather than the rendered DOM. See
[docs/architecture/editor-domain-model.md](./architecture/editor-domain-model.md).

**Editor node**
One element within the document model (e.g. a container, text block, or
button) — its type, properties, styling, and children. The canvas renders a
tree of editor nodes; it does not invent structure the model doesn't have.

**Canvas**
The `canvas` feature: the visual, interactive rendering surface where the
document model is displayed and manipulated — selection outlines, drag,
resize, zoom/pan, and snapping. Owns rendering and interaction mechanics,
not the model itself.

**Inspector**
The `inspector` feature: the contextual property-control panel shown for
the current selection. Translates user input (spacing, color, typography,
etc.) into editor commands rather than mutating the canvas directly.

**Component definition**
Metadata describing an insertable, reusable element in the
`components-library` feature — its type, default props/styles, category,
and how it appears in an insertion UI. Distinct from a React component; a
component definition is data, not implementation.

**Editor command**
A discrete, named mutation applied to the document model (e.g. "set
property," "insert node," "delete node"), owned by the `editor` feature.
Commands are the mechanism through which canvas interactions and inspector
input change the model, and the unit that undo/redo operates on.

**Selection**
The set of currently selected editor node(s), owned by `editor` as shared
state that both `canvas` (which renders selection outlines) and
`inspector` (which shows controls for the selection) read from.

**Export generator**
Code in the `export` feature that produces deterministic HTML/CSS/Tailwind
source from the document model. Consumes the model directly; does not
scrape rendered DOM as its primary mechanism.

**Application shell**
The structural chrome around the product — header, sidebars, panels,
status bar — owned by `src/components/layout`. Distinct from any one
feature's UI; the shell composes features together but does not contain
feature logic.

**Design token**
A named, reusable styling primitive (color, spacing scale, radius,
typography scale, etc.) representing Layoutry's own application design
language, owned by `src/styles`. Distinct from styles applied to a user's
generated canvas document — see the styling-rules distinction in
[CLAUDE.md](../CLAUDE.md).

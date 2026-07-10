# Editor Domain Model

## Principle

The editor's authoritative state is a **typed, serializable document
model** — not the rendered canvas, not the DOM, not an uncontrolled
`contentEditable` region.

The canvas renders the document model. It does not define it. When a user
drags, resizes, or edits a property, the intended flow is:

```
user interaction on canvas
  → editor command
  → document model mutation
  → canvas re-renders from the updated model
```

Never the reverse — the canvas must not be read back as the source of
truth after a DOM mutation, and code must not treat "what the browser is
currently showing" as authoritative state to persist, export, or diff.

## Why this matters

A typed, serializable document model is what makes every later milestone
possible without a rewrite:

- **Persistence** (M9) — a plain, serializable structure can be saved and
  reloaded; a live DOM tree cannot.
- **Undo/redo** (part of `editor`'s ownership) — history is a sequence of
  document states or commands, not DOM snapshots.
- **Export** (M8) — HTML/CSS generation reads the model and emits
  deterministic output; it does not scrape rendered markup.
- **Validation** — Zod schemas can validate a plain data structure; they
  cannot validate a live DOM tree.
- **Migration** — as the model evolves, versioned data can be migrated;
  DOM state cannot be versioned.
- **Collaboration** (future) — shared editing requires a state
  representation that can be diffed, merged, and transmitted.
- **Testing** — feature logic (commands, mutations, selection) can be unit
  tested against plain data without a browser or DOM environment.

## Ownership

- `editor` owns the document model itself, the commands that mutate it,
  history/undo-redo, and selection identity.
- `canvas` owns turning the current model into pixels on screen, and
  translating raw pointer/drag/resize interactions into editor commands —
  it does not own the model.
- `inspector` owns presenting and validating property controls, and
  translating user input into editor commands — it does not mutate the
  canvas DOM directly.
- `export` owns generating source code from the model — it does not scrape
  the rendered DOM as its primary export mechanism.

See [CLAUDE.md](../../CLAUDE.md) for the full per-feature ownership list.

## Current status

No document model exists yet. This principle governs the design of the
model when it is introduced (milestone M3 — see
[docs/roadmap/milestones.md](../roadmap/milestones.md)); it does not
describe code that has been built. Do not build canvas rendering around
direct DOM mutation in the meantime, even for placeholder or prototype
work.

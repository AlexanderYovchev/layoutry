# ADR-0009: Exported Interactions Replay Preview's Generic Executor

**Status:** Accepted

**Date:** 2026-10-27

## Context

EXPORT-1.3 had to make nine interactive catalog entries work in exported
pages without Layoutry: Dialog, Modal, Drawer, Dropdown Button,
Collapsible, Basic Tabs, Popover, Manual Toast and Dismissible Alert.

The audit showed that none of them has component-specific behavior in the
editor. The document stores only generic click bindings (show, hide or
toggle another node) and an authored initial visibility. Preview executes
them with these rules:

- clicks run the nearest node's bindings;
- outside clicks and Escape dismiss toggled, initially-hidden targets;
- a dialog target opens modally.

The nine entries are factory compositions of these primitives.

## Decision

- **Replay the executor, not the components.** Export describes the
  document's bindings as declarative **behavior descriptors** on the IR
  (`ExportDocument.behaviors`). These are:
  - targets addressed by generated integer tokens;
  - triggers with ordered actions;
  - dismissible relationships;
  - click boundaries.
  A **constant, dependency-free runtime** script applies Preview's rules
  to plain DOM, reading only generated data attributes.
- **No document data in code.** The runtime is the same string for every
  export. Descriptors carry no authored text, ids or selectors, and no
  executable content.
- **Accessibility from real semantics only.** The runtime adds these:
  - `aria-controls` on triggers;
  - `aria-expanded` on toggles;
  - `aria-haspopup="dialog"` on dialog openers;
  - native dialog focus handling;
  - focus return after an Escape dismissal.
  No widget roles the editor doesn't implement (for example, tabs).
- **File contract.** Static pages stay script-free:
  - standalone mode gets one inline `<script>`;
  - separate mode gets `script.js`, and only when needed.
- **Generated ids** use the reserved `ly-` prefix, which authored ids may
  no longer use.

## Consequences

- Any interaction a user authors, catalog or not, exports with the same
  behavior as in Preview.
- React and Vue printers can implement the same descriptors as component
  state.
- Behavior is not extended beyond the editor. There are no auto-dismissing
  toasts, no tab keyboard model and no Popover API, because the editor
  defines none.
- Standalone pages need `'unsafe-inline'` (or a script hash) under a strict
  CSP. Separate mode works with `script-src 'self'`.
- Hidden nodes are hidden, not removed. That is visually identical, but
  form input inside a re-shown panel is kept rather than reset, which
  differs from the Canvas's re-mount.

## Alternatives considered

- **Per-component runtime behaviors** (detect a "dropdown", a "modal" and
  so on): rejected. It invents semantics, misses user-authored bindings,
  and would be a second, inconsistent behavior specification.
- **Embedding behavior JSON in the script**: rejected in favor of data
  attributes. The script stays a constant with no data interpolation.
- **Native Popover API for Dropdown and Popover**: rejected. Their panels
  are in-flow in the editor; the top layer would change their layout.

# Known Issues and Stabilization Backlog

Defects and rough edges found during checkpoints but left out of their scope.
Each entry says where it was found, its impact, and what a fix would
involve. Remove an entry when it is fixed, naming the fixing checkpoint in
its report.

## Open

### Editor shortcuts act on the document behind open modal dialogs

- **Found:** EXPORT-1.4, 2026-10-28
  ([report](../reports/export-1.4-export-ui.txt), sections H and AJ).
- **What happens:** while any modal dialog is open (Export Code, the project
  dialogs, Help), document-editing shortcuts still reach the editor. Undo
  (Ctrl+Z), Redo, Cut, Paste, Duplicate and Delete change the document
  behind the dialog. `useEditorKeyboardShortcuts` listens on `window` and
  skips only text-input targets and Preview mode; a dialog's buttons don't
  count as either.
- **Impact:** the document can change unseen while a dialog has focus. Export
  is protected: its stale-preview check disables copy, download and save
  until Regenerate (a browser test relies on exactly this). Project dialogs
  aren't, though Save serializes the document at save time.
- **Suggested fix:** in the shortcut handler, return early while a modal
  dialog is open (`document.querySelector("dialog[open]")`, or an event
  target inside a `dialog`). Test that Ctrl+Z inside each dialog leaves the
  document unchanged, and that shortcuts work again after closing it.
- **Scope:** small; editor feature only.

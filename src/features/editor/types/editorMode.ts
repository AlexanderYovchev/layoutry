/**
 * Design vs Preview (Checkpoint 1.15.6.8) — the editor's own top-level
 * interaction posture, decided by the 1.15.6.7 audit to live as ordinary
 * editor UI state, never document state: it never enters a document
 * snapshot, is never touched by pushHistory/undo/redo, is never
 * duplicated with a node, and is never export data — the exact same
 * category SVG Edit Mode's own `svgEditingNodeId` already occupies on
 * this store (see useEditorStore.ts's own doc comment on that field).
 *
 * "design" (the default) is today's existing, unconditional behavior:
 * every native-default suppression this app already has (Link
 * navigation, Form submission, Checkbox/Radio toggle, Label click-
 * forwarding, embedded Video/Iframe interaction) keeps suppressing
 * regardless of this field, and Canvas clicks still select/edit exactly
 * as before this checkpoint. "preview" is new: Canvas clicks execute
 * authored click interactions (see types/interactions.ts) instead of
 * selecting, and editor manipulation chrome (selection outlines, resize
 * handles, Free move, Snap guides, SVG Drawing overlays, text/native-
 * value editing sessions) is suppressed — see CanvasInteractionBoundary,
 * CanvasOverlay, DocumentNodeRenderer, useEditableText, and
 * useNativeFormValueEditing for where each of those checks this field.
 */
export type EditorMode = "design" | "preview";

export const DEFAULT_EDITOR_MODE: EditorMode = "design";

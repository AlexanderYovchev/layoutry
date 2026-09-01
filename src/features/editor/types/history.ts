import type { EditorElementNode } from "@/features/editor/types/document";
import type { EditorSelection } from "@/features/editor/types/selection";

/**
 * One undo/redo step: the document and selection exactly as they were
 * before the change that produced the *next* entry. Restoring an entry
 * restores both together so undo/redo can never leave selection pointing
 * at a node that only exists in a different point of history. A full
 * document snapshot (not a diff/patch) is deliberate — at this document's
 * scale it's simpler and it makes "ids remain stable through undo/redo"
 * free (the whole prior tree, ids included, comes back verbatim).
 *
 * `selection` (Checkpoint 1.15.2, widened from the single `selectedElementId`
 * this field used through Checkpoint 1.15.1) is restored purely as a UX
 * courtesy — "what was highlighted at this point in history" — never a
 * tracked, independently undoable change: selection changes themselves
 * never push a new HistoryEntry (see useEditorStore's own selection
 * actions), so this field only ever changes as a side effect of restoring
 * some OTHER, real document mutation's own before/after snapshot.
 */
export interface HistoryEntry {
  document: EditorElementNode;
  selection: EditorSelection;
}

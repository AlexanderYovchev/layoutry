import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * One undo/redo step: the document and selection exactly as they were
 * before the change that produced the *next* entry. Restoring an entry
 * restores both together so undo/redo can never leave selection pointing
 * at a node that only exists in a different point of history. A full
 * document snapshot (not a diff/patch) is deliberate — at this document's
 * scale it's simpler and it makes "ids remain stable through undo/redo"
 * free (the whole prior tree, ids included, comes back verbatim).
 */
export interface HistoryEntry {
  document: EditorElementNode;
  selectedElementId: string | null;
}

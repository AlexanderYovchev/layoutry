import { create } from "zustand";
import {
  insertNode,
  moveNode,
  type InsertPosition,
} from "@/features/editor/commands/documentCommands";
import { fixtureDocument } from "@/features/editor/fixtureDocument";
import type { DropZone } from "@/features/editor/utils/resolveDropZone";
import type { EditorElementNode } from "@/features/editor/types/document";

interface EditorState {
  document: EditorElementNode;
  selectedElementId: string | null;
  selectElement: (id: string | null) => void;
  clearSelection: () => void;
  insertElement: (
    parentId: string,
    node: EditorElementNode,
    position?: InsertPosition,
  ) => void;
  moveElement: (nodeId: string, targetId: string, zone: DropZone) => void;
}

/**
 * The editor's single source of truth for the document tree and the
 * currently selected element. The Structure panel and the canvas both
 * read and write through this store, so selecting a row here and
 * selecting an element on the canvas are the same action from the
 * state's point of view — there is no separate "structure selection" or
 * "canvas selection" to keep in sync.
 */
export const useEditorStore = create<EditorState>()((set) => ({
  document: fixtureDocument,
  selectedElementId: null,
  selectElement: (id) => set({ selectedElementId: id }),
  clearSelection: () => set({ selectedElementId: null }),
  // Insertion and selecting the newly inserted node are one atomic
  // update — every insertion method (click, drag) goes through this
  // single action so "select what you just inserted" can never drift
  // out of sync with "what got inserted."
  insertElement: (parentId, node, position) =>
    set((state) => ({
      document: insertNode(state.document, parentId, node, position),
      selectedElementId: node.id,
    })),
  // Same shape as insertElement: the move and re-selecting the moved
  // node are one atomic update, so selection can never lag behind (or
  // survive) a move that was actually rejected by moveNode's own
  // validation — if moveNode no-ops, selectedElementId simply gets
  // reset to the id it already was.
  moveElement: (nodeId, targetId, zone) =>
    set((state) => ({
      document: moveNode(state.document, nodeId, targetId, zone),
      selectedElementId: nodeId,
    })),
}));

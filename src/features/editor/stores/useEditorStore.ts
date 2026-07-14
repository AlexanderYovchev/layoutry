import { create } from "zustand";
import { fixtureDocument } from "@/features/editor/fixtureDocument";
import type { EditorElementNode } from "@/features/editor/types/document";

interface EditorState {
  document: EditorElementNode;
  selectedElementId: string | null;
  selectElement: (id: string | null) => void;
}

/**
 * The editor's single source of truth for the document tree and the
 * currently selected element. Both the Structure panel and (once it
 * renders real elements) the canvas read and write through this store,
 * so selecting a row here and selecting an element on the canvas are the
 * same action from the state's point of view — there is no separate
 * "structure selection" to keep in sync.
 */
export const useEditorStore = create<EditorState>()((set) => ({
  document: fixtureDocument,
  selectedElementId: null,
  selectElement: (id) => set({ selectedElementId: id }),
}));

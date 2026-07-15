import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { findNodeById, findParentId } from "@/features/editor/utils/findNodeById";
import type { EditorElementNode } from "@/features/editor/types/document";

export interface SelectedNode {
  node: EditorElementNode;
  parentId: string | null;
}

/**
 * Resolves the shared selectedElementId against the current document —
 * the one place Canvas, Structure, and Inspector all derive "what's
 * selected" from, instead of each walking the tree themselves. Fails
 * safely to null both when nothing is selected and when the selected id
 * no longer resolves in the document, rather than throwing.
 */
export function useSelectedNode(): SelectedNode | null {
  const documentModel = useEditorStore((state) => state.document);
  const selectedElementId = useEditorStore((state) => state.selectedElementId);

  if (!selectedElementId) return null;

  const node = findNodeById(documentModel, selectedElementId);
  if (!node) return null;

  return { node, parentId: findParentId(documentModel, selectedElementId) };
}

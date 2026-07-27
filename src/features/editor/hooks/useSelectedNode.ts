import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { findNodeById, findParentId } from "@/features/editor/utils/findNodeById";
import { getLayoutMode } from "@/features/editor/types/layout";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { ContainerLayoutMode } from "@/features/editor/types/layout";

export interface SelectedNode {
  node: EditorElementNode;
  parentId: string | null;
  /** The selected node's own parent's layoutMode — "flow" when there is no parent (the document root is selected) or the parent has none set. Drives both the Canvas resize/move session choice and the Inspector's Free geometry fields. */
  parentLayoutMode: ContainerLayoutMode;
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

  const parentId = findParentId(documentModel, selectedElementId);
  const parentNode = parentId ? findNodeById(documentModel, parentId) : undefined;

  return { node, parentId, parentLayoutMode: parentNode ? getLayoutMode(parentNode) : "flow" };
}

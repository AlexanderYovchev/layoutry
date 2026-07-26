import { canContainChildren } from "@/features/editor/rules/insertionRules";
import { findNodeById, findParentId } from "@/features/editor/utils/findNodeById";
import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * The one place "where should this land when there's no explicit drop
 * target" is decided — shared by click-insert (useInsertElement) and
 * paste (useEditorStore's pasteClipboard), since both need the exact same
 * priority order: the current selection if it can contain children, that
 * selection's own parent if it's a leaf, an explicit fallback (paste's
 * original source parent) if that's still a valid destination, or the
 * document root as the last resort. Never returns a destination that
 * can't accept children — a leaf's parent is guaranteed to be a container
 * by construction, since only container-tagged nodes ever have children
 * in this tree.
 */
export function resolveDestinationParent(
  documentModel: EditorElementNode,
  selectedElementId: string | null,
  fallbackParentId?: string | null,
): string {
  const selectedNode = selectedElementId
    ? findNodeById(documentModel, selectedElementId)
    : undefined;

  if (selectedNode) {
    if (canContainChildren(selectedNode.tag)) return selectedNode.id;
    const parentId = findParentId(documentModel, selectedNode.id);
    if (parentId) return parentId;
  }

  if (fallbackParentId && findNodeById(documentModel, fallbackParentId)) {
    return fallbackParentId;
  }

  return documentModel.id;
}

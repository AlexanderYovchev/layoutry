import {
  createElementNode,
  type InsertableElementType,
} from "@/features/editor/factories/elementFactories";
import { canContainChildren } from "@/features/editor/rules/insertionRules";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { findNodeById, findParentId } from "@/features/editor/utils/findNodeById";
import type { DropZone } from "@/features/editor/utils/resolveDropZone";
import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * Click-insert (no explicit drop target) has no hovered node to reason
 * about, so it has to fall back to *something* deterministic. Rather than
 * always the document root regardless of context, it targets wherever the
 * user is currently working: the selected element itself if it can accept
 * children, or that element's own parent otherwise (e.g. a selected Image
 * is a leaf, but its containing Section is exactly where "add another
 * element here" should land) — falling back to the document root only
 * once nothing useful is selected.
 */
function resolveDefaultInsertionParent(
  documentModel: EditorElementNode,
  selectedElementId: string | null,
): string {
  const selectedNode = selectedElementId
    ? findNodeById(documentModel, selectedElementId)
    : undefined;
  if (!selectedNode) return documentModel.id;
  if (canContainChildren(selectedNode.tag)) return selectedNode.id;
  return findParentId(documentModel, selectedNode.id) ?? documentModel.id;
}

/**
 * The single insertion pipeline every insertion method (Resource Panel
 * click, drag and drop) calls through: resolve a valid target, create
 * the node, insert it, select it — one function, reused everywhere, so
 * "how insertion works" is never duplicated between input methods.
 *
 * requestedTargetId is the hovered node for drag and drop, or omitted
 * for click-insert (see resolveDefaultInsertionParent above for what it
 * falls back to). zone, when given, positions the new node before/after
 * requestedTargetId as a sibling instead of appending inside it — the
 * same before/after/inside vocabulary Checkpoint 3.4.1 introduced for
 * moving existing nodes, reused here for free now that the underlying
 * insertNode position support exists. If an explicitly requested target
 * doesn't exist, can't accept children (for an "inside"/default drop), or
 * has no parent (for a before/after drop), insertion falls back to the
 * document root rather than silently doing nothing.
 */
export function useInsertElement() {
  const documentModel = useEditorStore((state) => state.document);
  const selectedElementId = useEditorStore((state) => state.selectedElementId);
  const insertElement = useEditorStore((state) => state.insertElement);

  return function insert(
    elementType: InsertableElementType,
    requestedTargetId?: string,
    zone?: DropZone,
  ) {
    const newNode = createElementNode(elementType);
    const requestedTarget = requestedTargetId
      ? findNodeById(documentModel, requestedTargetId)
      : undefined;

    if (requestedTarget && zone && zone !== "inside") {
      const parentId = findParentId(documentModel, requestedTarget.id);
      if (parentId) {
        insertElement(parentId, newNode, {
          referenceId: requestedTarget.id,
          placement: zone,
        });
        return;
      }
      // requestedTarget has no parent (it's the document root) — before/after
      // is meaningless, fall through to the default-container behavior below.
    }

    if (requestedTarget) {
      const parentId = canContainChildren(requestedTarget.tag)
        ? requestedTarget.id
        : documentModel.id;
      insertElement(parentId, newNode);
      return;
    }

    insertElement(resolveDefaultInsertionParent(documentModel, selectedElementId), newNode);
  };
}

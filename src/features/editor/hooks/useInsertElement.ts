import {
  createElementNode,
  type InsertableElementType,
} from "@/features/editor/factories/elementFactories";
import { canContainChildren } from "@/features/editor/rules/insertionRules";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { findNodeById, findParentId } from "@/features/editor/utils/findNodeById";
import { resolveDestinationParent } from "@/features/editor/utils/resolveDestinationParent";
import type { DropZone } from "@/features/editor/utils/resolveDropZone";

/**
 * The single insertion pipeline every insertion method (Resource Panel
 * click, drag and drop) calls through: resolve a valid target, create
 * the node, insert it, select it — one function, reused everywhere, so
 * "how insertion works" is never duplicated between input methods.
 *
 * requestedTargetId is the hovered node for drag and drop, or omitted
 * for click-insert (see resolveDestinationParent for what it falls back
 * to — the same priority order paste uses). zone, when given, positions
 * the new node before/after
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

    insertElement(resolveDestinationParent(documentModel, selectedElementId), newNode);
  };
}

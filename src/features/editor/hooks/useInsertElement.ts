import {
  createElementNode,
  type InsertableElementType,
} from "@/features/editor/factories/elementFactories";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { getLayoutMode, type FreeLayoutGeometry } from "@/features/editor/types/layout";
import { findNodeById } from "@/features/editor/utils/findNodeById";
import { resolveFreeDestinationPlacement } from "@/features/editor/utils/resolveFreeDestinationPlacement";
import { resolveInsertionParent } from "@/features/editor/utils/resolveInsertionParent";
import type { DropZone } from "@/features/editor/utils/resolveDropZone";

/**
 * The single insertion pipeline every insertion method (Resource Panel
 * click, drag and drop) calls through: resolve a valid target, create
 * the node, insert it, select it — one function, reused everywhere, so
 * "how insertion works" is never duplicated between input methods.
 *
 * requestedTargetId is the hovered node for drag and drop, or omitted
 * for click-insert; zone positions the new node before/after it. Where it
 * lands is resolveInsertionParent's rule (shared with the Resource Panel's
 * live insertion preview, BC-13.6).
 *
 * freeGeometry (BC-13.6, Decision 30): the Resource Panel drag's final
 * pointer-position placement — used only when the destination really is a
 * Free container; every other path (click-insert, Flow destinations, a drop
 * without a preview) keeps the first-available Free placement
 * (resolveFreeDestinationPlacement), unchanged.
 */
export function useInsertElement() {
  const documentModel = useEditorStore((state) => state.document);
  const primarySelectedId = useEditorStore((state) => state.selection.primaryId ?? null);
  const insertElement = useEditorStore((state) => state.insertElement);

  return function insert(
    elementType: InsertableElementType,
    requestedTargetId?: string,
    zone?: DropZone,
    freeGeometry?: FreeLayoutGeometry,
  ) {
    const newNode = createElementNode(elementType);
    const { parentId, position } = resolveInsertionParent(documentModel, requestedTargetId, zone, primarySelectedId);
    const parent = findNodeById(documentModel, parentId);
    const placedNode =
      freeGeometry && parent && getLayoutMode(parent) === "free"
        ? { ...newNode, freeLayout: { ...freeGeometry } }
        : resolveFreeDestinationPlacement(documentModel, parentId, newNode);
    insertElement(parentId, placedNode, position);
  };
}

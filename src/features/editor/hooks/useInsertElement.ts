import {
  createElementNode,
  type InsertableElementType,
} from "@/features/editor/factories/elementFactories";
import { canContainChildren } from "@/features/editor/rules/insertionRules";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { findNodeById } from "@/features/editor/utils/findNodeById";

/**
 * The single insertion pipeline every insertion method (Resource Panel
 * click, drag and drop) calls through: resolve a valid target, create
 * the node, insert it, select it — one function, reused everywhere, so
 * "how insertion works" is never duplicated between input methods.
 *
 * requestedParentId is the drop target for drag and drop, or omitted
 * for click-insert (which always targets the default container per the
 * milestone's own "deterministic, no surprises" instruction). If the
 * requested target doesn't exist or can't accept children, insertion
 * falls back to the document root rather than silently doing nothing.
 */
export function useInsertElement() {
  const documentModel = useEditorStore((state) => state.document);
  const insertElement = useEditorStore((state) => state.insertElement);

  return function insert(
    elementType: InsertableElementType,
    requestedParentId?: string,
  ) {
    const requestedParent = requestedParentId
      ? findNodeById(documentModel, requestedParentId)
      : undefined;

    const parentId =
      requestedParent && canContainChildren(requestedParent.tag)
        ? requestedParent.id
        : documentModel.id;

    insertElement(parentId, createElementNode(elementType));
  };
}

import { canContainChildren } from "@/features/editor/rules/insertionRules";
import type { EditorElementNode } from "@/features/editor/types/document";
import { findNodeById, findParentId } from "@/features/editor/utils/findNodeById";
import { resolveDestinationParent } from "@/features/editor/utils/resolveDestinationParent";
import type { DropZone } from "@/features/editor/utils/resolveDropZone";

export interface InsertionParent {
  parentId: string;
  /** Before/after a sibling (a zone drop next to an element); omitted = appended inside parentId. */
  position?: { referenceId: string; placement: "before" | "after" };
}

/**
 * Where an insertion lands (the parent, and the sibling position for a
 * before/after drop) — the one rule useInsertElement applies. Extracted in
 * BC-13.6 so the Resource Panel's live Free insertion preview resolves
 * exactly the destination the drop will use, never a second policy.
 *
 * - a before/after zone next to an element → that element's parent;
 * - a hovered element that can contain children → it; otherwise the root;
 * - nothing hovered → the default destination (selection-based, the same
 *   as click-insert and paste).
 */
export function resolveInsertionParent(
  documentModel: EditorElementNode,
  requestedTargetId: string | undefined,
  zone: DropZone | undefined,
  primarySelectedId: string | null,
): InsertionParent {
  const requestedTarget = requestedTargetId ? findNodeById(documentModel, requestedTargetId) : undefined;
  if (requestedTarget && zone && zone !== "inside") {
    const parentId = findParentId(documentModel, requestedTarget.id);
    // No parent (the document root): before/after is meaningless — fall
    // through to the default-container behavior below.
    if (parentId) return { parentId, position: { referenceId: requestedTarget.id, placement: zone } };
  }
  if (requestedTarget) {
    return { parentId: canContainChildren(requestedTarget.tag) ? requestedTarget.id : documentModel.id };
  }
  return { parentId: resolveDestinationParent(documentModel, primarySelectedId) };
}

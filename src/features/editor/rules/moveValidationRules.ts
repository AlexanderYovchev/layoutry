import { canParentAcceptChild } from "@/features/editor/rules/insertionRules";
import { findNodeById, findParentId } from "@/features/editor/utils/findNodeById";
import type { DropZone } from "@/features/editor/utils/resolveDropZone";
import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * Why a proposed move fails the structural rules below (BC-12.2), so a
 * keyboard reorder or a notice can say why instead of failing silently.
 */
export type MoveTargetRejection =
  | "self"
  | "page"
  | "beside-page"
  | "descendant"
  | "not-found"
  | "incompatible-parent";

/**
 * The structural gate every proposed move passes through — used both to
 * decide whether a live drop indicator should even appear (Canvas) and
 * inside moveNode itself (the actual mutation), so a target that's
 * rejected during the drag can never somehow succeed at drop time.
 *
 * Checkpoint 1.6: the parent the moved node would actually land in — the
 * target itself for an "inside" drop, or the target's own parent for a
 * before/after sibling drop — must accept the dragged node's tag per the
 * centralized canParentAcceptChild rule (insertionRules.ts). This is the
 * same rule insertNode itself enforces as a second, independent check;
 * checking it here too means an invalid drag never even shows as a valid
 * drop target, rather than silently no-opping only once dropped.
 *
 * Component rules (Navbar and Pagination limits, Free bounds) are layered
 * on top of this in commands/moveCommands.ts (validateMove).
 */
export function getMoveTargetRejection(
  root: EditorElementNode,
  nodeId: string,
  targetId: string,
  zone: DropZone,
): MoveTargetRejection | null {
  if (nodeId === targetId) return "self";
  if (nodeId === root.id) return "page"; // the document root can never be moved

  const draggedNode = findNodeById(root, nodeId);
  if (!draggedNode) return "not-found";

  // A node can't be dropped into its own subtree — that would make it
  // its own ancestor.
  if (isDescendant(draggedNode, targetId)) return "descendant";

  if (zone !== "inside" && targetId === root.id) return "beside-page"; // root has no parent to sit before/after in

  const targetNode = findNodeById(root, targetId);
  if (!targetNode) return "not-found";

  if (zone === "inside") {
    if (!canParentAcceptChild(targetNode.tag, draggedNode.tag)) return "incompatible-parent";
  } else {
    const targetParentId = findParentId(root, targetId);
    const targetParent = targetParentId ? findNodeById(root, targetParentId) : undefined;
    if (!targetParent) return "not-found";
    if (!canParentAcceptChild(targetParent.tag, draggedNode.tag)) return "incompatible-parent";
  }

  return null;
}

/** Whether the move passes the structural rules (see getMoveTargetRejection). */
export function isValidMoveTarget(
  root: EditorElementNode,
  nodeId: string,
  targetId: string,
  zone: DropZone,
): boolean {
  return getMoveTargetRejection(root, nodeId, targetId, zone) === null;
}

function isDescendant(node: EditorElementNode, candidateId: string): boolean {
  return (node.children ?? []).some(
    (child) => child.id === candidateId || isDescendant(child, candidateId),
  );
}

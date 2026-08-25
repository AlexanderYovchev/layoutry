import { canParentAcceptChild } from "@/features/editor/rules/insertionRules";
import { findNodeById, findParentId } from "@/features/editor/utils/findNodeById";
import type { DropZone } from "@/features/editor/utils/resolveDropZone";
import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * The single gate every proposed move passes through — used both to
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
 */
export function isValidMoveTarget(
  root: EditorElementNode,
  nodeId: string,
  targetId: string,
  zone: DropZone,
): boolean {
  if (nodeId === targetId) return false;
  if (nodeId === root.id) return false; // the document root can never be moved

  const draggedNode = findNodeById(root, nodeId);
  if (!draggedNode) return false;

  // A node can't be dropped into its own subtree — that would make it
  // its own ancestor.
  if (targetId === nodeId || isDescendant(draggedNode, targetId)) return false;

  if (zone !== "inside" && targetId === root.id) return false; // root has no parent to sit before/after in

  const targetNode = findNodeById(root, targetId);
  if (!targetNode) return false;

  if (zone === "inside") {
    if (!canParentAcceptChild(targetNode.tag, draggedNode.tag)) return false;
  } else {
    const targetParentId = findParentId(root, targetId);
    const targetParent = targetParentId ? findNodeById(root, targetParentId) : undefined;
    if (!targetParent || !canParentAcceptChild(targetParent.tag, draggedNode.tag)) return false;
  }

  return true;
}

function isDescendant(node: EditorElementNode, candidateId: string): boolean {
  return (node.children ?? []).some(
    (child) => child.id === candidateId || isDescendant(child, candidateId),
  );
}

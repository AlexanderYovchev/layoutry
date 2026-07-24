import { canContainChildren } from "@/features/editor/rules/insertionRules";
import { findNodeById } from "@/features/editor/utils/findNodeById";
import type { DropZone } from "@/features/editor/utils/resolveDropZone";
import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * The single gate every proposed move passes through — used both to
 * decide whether a live drop indicator should even appear (Canvas) and
 * inside moveNode itself (the actual mutation), so a target that's
 * rejected during the drag can never somehow succeed at drop time.
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

  if (zone === "inside" && !canContainChildren(targetNode.tag)) return false;

  return true;
}

function isDescendant(node: EditorElementNode, candidateId: string): boolean {
  return (node.children ?? []).some(
    (child) => child.id === candidateId || isDescendant(child, candidateId),
  );
}

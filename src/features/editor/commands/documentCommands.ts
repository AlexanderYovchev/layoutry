import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * Document mutation layer — the only place the document tree is ever
 * rebuilt. Every future mutation (removeNode, replaceNode, moveNode,
 * duplicateNode) belongs here alongside insertNode, sharing the same
 * immutable-update shape, so callers never splice EditorElementNode
 * arrays directly. Only insertion is implemented this checkpoint.
 *
 * Returns a new root only along the path that actually changed —
 * untouched branches keep their existing object identity (structural
 * sharing), which is what lets consumers skip re-rendering subtrees
 * that weren't affected.
 */
export function insertNode(
  root: EditorElementNode,
  parentId: string,
  newNode: EditorElementNode,
): EditorElementNode {
  if (root.id === parentId) {
    return { ...root, children: [...(root.children ?? []), newNode] };
  }

  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = insertNode(child, parentId, newNode);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}

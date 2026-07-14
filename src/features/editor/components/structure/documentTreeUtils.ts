import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * Ids of every ancestor of targetId, from its immediate parent up to
 * (and including) the root. Empty if targetId is the root itself or
 * isn't found. Used to auto-expand a selected node's ancestor branches.
 */
export function findAncestorIds(
  root: EditorElementNode,
  targetId: string,
): string[] {
  const path: string[] = [];

  function walk(node: EditorElementNode): boolean {
    if (node.id === targetId) return true;
    for (const child of node.children ?? []) {
      if (walk(child)) {
        path.push(node.id);
        return true;
      }
    }
    return false;
  }

  walk(root);
  return path;
}

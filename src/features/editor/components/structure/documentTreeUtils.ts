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

/**
 * Ids of every node currently reachable by the tree in display order —
 * the root, then each open branch's children, skipping the children of
 * any collapsed node. This is the roving-tabindex order for keyboard
 * navigation: Up/Down/Home/End move within this list, never into a
 * branch that isn't actually visible.
 */
export function getVisibleNodeIds(
  root: EditorElementNode,
  openNodeIds: Set<string>,
): string[] {
  const ids: string[] = [];

  function walk(node: EditorElementNode) {
    ids.push(node.id);
    const children = node.children ?? [];
    if (children.length > 0 && openNodeIds.has(node.id)) {
      for (const child of children) {
        walk(child);
      }
    }
  }

  walk(root);
  return ids;
}

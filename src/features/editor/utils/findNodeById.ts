import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * Depth-first lookup of a node by id. A plain recursive walk is
 * sufficient for the current in-memory document; swap for an indexed
 * Map<string, EditorElementNode> if documents grow large enough for
 * repeated linear lookups to matter.
 */
export function findNodeById(
  root: EditorElementNode,
  nodeId: string,
): EditorElementNode | undefined {
  if (root.id === nodeId) return root;
  for (const child of root.children ?? []) {
    const found = findNodeById(child, nodeId);
    if (found) return found;
  }
  return undefined;
}

/** Id of nodeId's immediate parent, or null if nodeId is the root (or isn't found). */
export function findParentId(
  root: EditorElementNode,
  nodeId: string,
): string | null {
  for (const child of root.children ?? []) {
    if (child.id === nodeId) return root.id;
    const found = findParentId(child, nodeId);
    if (found) return found;
  }
  return null;
}

/**
 * Every ancestor of nodeId, closest parent first and the document root
 * last — empty if nodeId is the root itself or isn't found. Built from
 * repeated findParentId/findNodeById lookups rather than a single
 * root-to-target path walk: O(depth^2) in the worst case, but this app's
 * in-memory documents are small enough that the simpler composition (no
 * new traversal algorithm, just reusing the two lookups already above)
 * is the right tradeoff — see findNodeById's own doc comment for the
 * identical reasoning on when to graduate to an indexed structure.
 */
export function findAncestorChain(
  root: EditorElementNode,
  nodeId: string,
): EditorElementNode[] {
  const chain: EditorElementNode[] = [];
  let currentId = findParentId(root, nodeId);
  while (currentId !== null) {
    const node = findNodeById(root, currentId);
    if (!node) break;
    chain.push(node);
    currentId = findParentId(root, currentId);
  }
  return chain;
}

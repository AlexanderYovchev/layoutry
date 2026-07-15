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

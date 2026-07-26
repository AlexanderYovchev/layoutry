import { generateNodeId } from "@/features/editor/utils/generateNodeId";
import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * Deep-clones a node and its entire subtree, generating a fresh id for
 * every node in it (not just the root) — the one place clipboard paste
 * and duplicate both get a guaranteed-unique subtree from, so neither
 * command needs its own id-remapping logic. dimensions/text/displayName
 * are copied by value via the spread; dimensions objects are never
 * mutated in place elsewhere in this codebase (every resize replaces it
 * with a new object), so sharing that reference between the original and
 * the clone is safe.
 */
export function cloneNodeWithFreshIds(node: EditorElementNode): EditorElementNode {
  return {
    ...node,
    id: generateNodeId(node.tag),
    children: node.children?.map(cloneNodeWithFreshIds),
  };
}

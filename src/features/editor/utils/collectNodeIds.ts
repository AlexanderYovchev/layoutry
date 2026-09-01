import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * Every node id currently present in the tree, as a Set for O(1)
 * membership checks — the one place "does this id still exist" is
 * answered from a full-tree walk (Checkpoint 1.15.2's own selection
 * reconciliation — see useSelectedNodes/normalizeSelection), rather than
 * each caller running its own findNodeById per id.
 */
export function collectNodeIds(root: EditorElementNode): Set<string> {
  const ids = new Set<string>();
  function visit(node: EditorElementNode) {
    ids.add(node.id);
    node.children?.forEach(visit);
  }
  visit(root);
  return ids;
}

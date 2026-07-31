import type { FilterSettings } from "@/features/editor/types/filters";
import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * Sets exactly one node's visual effects (Checkpoint 4.7) — same
 * immutable/structural-sharing shape as setBorderSettings/
 * setBoxShadowSettings: returns a new root only along the path that
 * actually changed, a no-op (same reference) if nodeId doesn't exist.
 * `filters` is the caller's complete next settings object (already the
 * "unset -> undefined" result of withFilterField for a reset/clear),
 * overwritten wholesale rather than merged here — merging semantics
 * belong one layer up, at the Inspector row that knows which single
 * field it's changing, not in this pure per-node write.
 */
export function setFilterSettings(
  root: EditorElementNode,
  nodeId: string,
  filters: FilterSettings | undefined,
): EditorElementNode {
  if (root.id === nodeId) return { ...root, filters };

  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = setFilterSettings(child, nodeId, filters);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}

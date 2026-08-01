import type { PositionSettings } from "@/features/editor/types/position";
import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * Sets exactly one node's position settings (Checkpoint 5.1) — same
 * immutable/structural-sharing shape as setDisplaySettings/
 * setFilterSettings: returns a new root only along the path that
 * actually changed, a no-op (same reference) if nodeId doesn't exist.
 * `position` is the caller's complete next settings object (already the
 * "unset -> undefined" result of withPositionField for a reset/clear),
 * overwritten wholesale rather than merged here — merging semantics
 * belong one layer up, at the Inspector row that knows which single
 * field it's changing, not in this pure per-node write.
 */
export function setPositionSettings(
  root: EditorElementNode,
  nodeId: string,
  position: PositionSettings | undefined,
): EditorElementNode {
  if (root.id === nodeId) return { ...root, position };

  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = setPositionSettings(child, nodeId, position);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}

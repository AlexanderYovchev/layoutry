import type { DisplaySettings } from "@/features/editor/types/display";
import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * Sets exactly one node's display/visibility/overflow/interaction
 * settings (Checkpoint 4.8) — same immutable/structural-sharing shape as
 * setFilterSettings/setBoxShadowSettings: returns a new root only along
 * the path that actually changed, a no-op (same reference) if nodeId
 * doesn't exist. `display` is the caller's complete next settings
 * object (already the "unset -> undefined" result of withDisplayField
 * for a reset/clear), overwritten wholesale rather than merged here —
 * merging semantics belong one layer up, at the Inspector row that knows
 * which single field it's changing, not in this pure per-node write.
 */
export function setDisplaySettings(
  root: EditorElementNode,
  nodeId: string,
  display: DisplaySettings | undefined,
): EditorElementNode {
  if (root.id === nodeId) return { ...root, display };

  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = setDisplaySettings(child, nodeId, display);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}

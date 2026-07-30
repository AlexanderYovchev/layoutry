import type { BackgroundSettings } from "@/features/editor/types/background";
import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * Sets exactly one node's background (Checkpoint 4.3) — same immutable/
 * structural-sharing shape as setTypographySettings/setMediaFitSettings:
 * returns a new root only along the path that actually changed, a no-op
 * (same reference) if nodeId doesn't exist. `background` is the caller's
 * complete next settings object (already the "unset -> undefined" result
 * of withBackgroundField/withBackgroundSize for a reset/clear), overwritten
 * wholesale rather than merged here — merging semantics belong one layer
 * up, at the Inspector row that knows which single field it's changing,
 * not in this pure per-node write.
 */
export function setBackgroundSettings(
  root: EditorElementNode,
  nodeId: string,
  background: BackgroundSettings | undefined,
): EditorElementNode {
  if (root.id === nodeId) return { ...root, background };

  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = setBackgroundSettings(child, nodeId, background);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}

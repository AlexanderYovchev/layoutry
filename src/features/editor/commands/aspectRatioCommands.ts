import type { AspectRatioValue } from "@/features/editor/types/aspectRatio";
import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * Sets exactly one node's aspect ratio (Checkpoint 5.5) — same
 * immutable/structural-sharing shape as setPositionSettings/
 * setDisplaySettings: returns a new root only along the path that
 * actually changed, a no-op (same reference) if nodeId doesn't exist.
 * `aspectRatio` is the caller's complete next value (or `undefined` to
 * reset), overwritten wholesale rather than merged — there is nothing to
 * merge, since AspectRatioValue is a single discriminated-union value,
 * not a bag of independent fields like DisplaySettings/PositionSettings.
 */
export function setAspectRatio(
  root: EditorElementNode,
  nodeId: string,
  aspectRatio: AspectRatioValue | undefined,
): EditorElementNode {
  if (root.id === nodeId) return { ...root, aspectRatio };

  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = setAspectRatio(child, nodeId, aspectRatio);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}

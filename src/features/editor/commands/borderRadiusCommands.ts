import type { BorderRadiusSettings } from "@/features/editor/types/borderRadius";
import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * Sets exactly one node's border radius (Checkpoint 4.5) — same
 * immutable/structural-sharing shape as setBorderSettings/
 * setTypographySettings: returns a new root only along the path that
 * actually changed, a no-op (same reference) if nodeId doesn't exist.
 * `borderRadius` is the caller's complete next settings object,
 * overwritten wholesale rather than merged here.
 */
export function setBorderRadiusSettings(
  root: EditorElementNode,
  nodeId: string,
  borderRadius: BorderRadiusSettings | undefined,
): EditorElementNode {
  if (root.id === nodeId) return { ...root, borderRadius };

  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = setBorderRadiusSettings(child, nodeId, borderRadius);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}

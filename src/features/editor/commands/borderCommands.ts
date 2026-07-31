import type { BorderSettings } from "@/features/editor/types/border";
import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * Sets exactly one node's border (Checkpoint 4.4) — same immutable/
 * structural-sharing shape as setTypographySettings/setElementMargin:
 * returns a new root only along the path that actually changed, a no-op
 * (same reference) if nodeId doesn't exist. `border` is the caller's
 * complete next settings object (already the "unset -> undefined" result
 * of the border.ts helpers for a reset/clear), overwritten wholesale
 * rather than merged here — merging semantics belong one layer up, at the
 * Inspector control that knows which single field/side it's changing, not
 * in this pure per-node write.
 */
export function setBorderSettings(
  root: EditorElementNode,
  nodeId: string,
  border: BorderSettings | undefined,
): EditorElementNode {
  if (root.id === nodeId) return { ...root, border };

  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = setBorderSettings(child, nodeId, border);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}

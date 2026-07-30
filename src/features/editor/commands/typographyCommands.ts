import type { TypographySettings } from "@/features/editor/types/typography";
import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * Sets exactly one node's typography (Checkpoint 4.2) — same immutable/
 * structural-sharing shape as setMediaFitSettings/setElementMargin:
 * returns a new root only along the path that actually changed, a no-op
 * (same reference) if nodeId doesn't exist. `typography` is the caller's
 * complete next settings object (already the "unset -> undefined" result
 * of withTypographyField for a reset/clear), overwritten wholesale rather
 * than merged here — merging semantics belong one layer up, at the
 * Inspector row that knows which single field it's changing, not in this
 * pure per-node write.
 */
export function setTypographySettings(
  root: EditorElementNode,
  nodeId: string,
  typography: TypographySettings | undefined,
): EditorElementNode {
  if (root.id === nodeId) return { ...root, typography };

  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = setTypographySettings(child, nodeId, typography);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}

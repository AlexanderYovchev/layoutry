import type { BoxShadowSettings } from "@/features/editor/types/boxShadow";
import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * Sets exactly one node's box shadow (Checkpoint 4.6) — same immutable/
 * structural-sharing shape as setBorderSettings/setBorderRadiusSettings:
 * returns a new root only along the path that actually changed, a no-op
 * (same reference) if nodeId doesn't exist. `boxShadow` is the caller's
 * complete next layer list (already the "unset -> undefined" result of
 * normalizeBoxShadowSettings for a fully-emptied list), overwritten
 * wholesale rather than merged here. Every layer-list operation (add,
 * remove, duplicate, reorder, update) is a pure function in types/
 * boxShadow.ts — this is the one place any of their results actually
 * reaches the document, exactly like Background/Gradient's single
 * setElementBackground write path.
 */
export function setBoxShadowSettings(
  root: EditorElementNode,
  nodeId: string,
  boxShadow: BoxShadowSettings | undefined,
): EditorElementNode {
  if (root.id === nodeId) return { ...root, boxShadow };

  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = setBoxShadowSettings(child, nodeId, boxShadow);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}

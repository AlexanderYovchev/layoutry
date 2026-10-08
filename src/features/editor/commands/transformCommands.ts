import { transformSettingsEqual, type TransformSettings } from "@/features/editor/types/transform";
import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * Sets exactly one node's CSS Transform (Checkpoint 1.15.6.14.3) — the
 * single whole-value command, same immutable/structural-sharing shape as
 * setElementTransition: returns a new root only along the path that
 * actually changed, a no-op (same reference) if nodeId doesn't exist.
 * There is no separate per-field single-node command — the Inspector
 * computes the merged next value itself via withTransformField (which
 * already identity-normalizes) and calls this with the result, the exact
 * same division of responsibility setElementTransition's own doc comment
 * documents. Guards against a same-value write via transformSettingsEqual
 * (identity-normalization-aware), so committing a field to its current
 * value, or clearing an already-absent Transform, never pushes history.
 */
export function setElementTransform(
  root: EditorElementNode,
  nodeId: string,
  transform: TransformSettings | undefined,
): EditorElementNode {
  if (root.id === nodeId) {
    if (transformSettingsEqual(root.transform, transform)) return root;
    return { ...root, transform };
  }

  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = setElementTransform(child, nodeId, transform);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}

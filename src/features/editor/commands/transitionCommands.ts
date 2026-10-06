import { transitionSettingsEqual, type TransitionSettings } from "@/features/editor/types/transition";
import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * Sets exactly one node's CSS Transition (Checkpoint 1.15.6.14.1) — same
 * immutable/structural-sharing shape as setAspectRatio/setDisplaySettings:
 * returns a new root only along the path that actually changed, a no-op
 * (same reference) if nodeId doesn't exist. `transition` is the caller's
 * complete next value (or `undefined` to clear), overwritten wholesale —
 * there is no per-field merge at this layer, matching setAspectRatio's own
 * reasoning (the Inspector, which knows which single field it's changing,
 * is what merges via withTransitionField before calling this).
 *
 * Unlike setAspectRatio/setElementShape, this DOES guard against a same-
 * value write (via transitionSettingsEqual) — this checkpoint's own explicit
 * requirement that committing a field to its current value, or clearing an
 * already-absent transition, must never push a history entry.
 */
export function setElementTransition(
  root: EditorElementNode,
  nodeId: string,
  transition: TransitionSettings | undefined,
): EditorElementNode {
  if (root.id === nodeId) {
    if (transitionSettingsEqual(root.transition, transition)) return root;
    return { ...root, transition };
  }

  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = setElementTransition(child, nodeId, transition);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}

import type { SizeConstraints } from "@/features/editor/types/sizeConstraints";
import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * Sets one node's own CSS min/max sizing constraints (Checkpoint 5.7) —
 * same immutable/structural-sharing shape as every other one-shot
 * settings command (setMediaFitSettings, setBackgroundSettings):
 * returns a new root only along the path that actually changed, a no-op
 * (same reference) if nodeId doesn't exist. `constraints` is the
 * caller's complete next object (already the "unset -> undefined" result
 * of withSizeConstraintField for a reset/clear), overwritten wholesale
 * rather than merged here.
 */
export function setSizeConstraints(
  root: EditorElementNode,
  nodeId: string,
  constraints: SizeConstraints | undefined,
): EditorElementNode {
  if (root.id === nodeId) return { ...root, sizeConstraints: constraints };

  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = setSizeConstraints(child, nodeId, constraints);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}

import type { EditorElementNode } from "@/features/editor/types/document";
import type { ShapePreset } from "@/features/editor/types/shape";

/**
 * Sets exactly one node's Shape preset (Checkpoint 1.15.4) — same
 * immutable/structural-sharing shape as setBorderRadiusSettings: returns
 * a new root only along the path that actually changed, a no-op (same
 * reference) if nodeId doesn't exist. "none" normalizes to `undefined`
 * before storing — a plain rectangle has no synthesized field value,
 * matching every other settings field's "unset" convention (see
 * EditorElementNode.shape's own doc comment) — so selecting "Rectangle"
 * in the Inspector after some other preset genuinely clears the field
 * rather than persisting an explicit "none" value alongside it.
 */
export function setElementShape(
  root: EditorElementNode,
  nodeId: string,
  shape: ShapePreset,
): EditorElementNode {
  if (root.id === nodeId) {
    const next = shape === "none" ? undefined : shape;
    if (root.shape === next) return root;
    return { ...root, shape: next };
  }

  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = setElementShape(child, nodeId, shape);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}

import { getLayoutMode, getResizeConstraintsForTag } from "@/features/editor/types/layout";
import { withSpacingBox, type EdgeValues } from "@/features/editor/types/spacing";
import { normalizeFreeLayoutGeometry } from "@/features/editor/utils/normalizeFreeLayoutGeometry";
import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * Sets exactly one node's margin — the whole box at once. Sides absent
 * from `margin` are unset and 0 is an authored value (BC-05.3); undefined,
 * or a box with no authored side, removes the box (how Reset works). A no-op (same reference) if nodeId
 * doesn't exist. Margin never affects a Free container's content bounds
 * (it's outside the border, not inside it — see setElementPadding for
 * the field that does), so no child re-normalization is needed here.
 */
export function setElementMargin(
  root: EditorElementNode,
  nodeId: string,
  margin: EdgeValues | undefined,
): EditorElementNode {
  if (root.id === nodeId) {
    return { ...root, spacing: withSpacingBox(root.spacing, "margin", margin) };
  }

  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = setElementMargin(child, nodeId, margin);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}

/**
 * Sets exactly one node's padding — the containment-critical command
 * (Checkpoint 3.5's "Padding and Free-Layout Bounds," and this project's
 * standing rule that content must never render outside its container
 * for any reason). When the node is itself a Free container with
 * children, padding changing its usable content box is recomputed here
 * (pure arithmetic: the node's own already-known outer width/height
 * minus the new padding — no DOM measurement needed, unlike Flow -> Free
 * conversion) and every direct child is re-normalized through the same
 * centralized normalizeFreeLayoutGeometry every other geometry change
 * already goes through — clamp semantics always (not the container's
 * own childResizePolicy), since a padding change is "how much interior
 * margin exists," not "rescale the composition." A no-op (same
 * reference) if nodeId doesn't exist.
 */
export function setElementPadding(
  root: EditorElementNode,
  nodeId: string,
  padding: EdgeValues | undefined,
): EditorElementNode {
  if (root.id === nodeId) {
    const updated: EditorElementNode = { ...root, spacing: withSpacingBox(root.spacing, "padding", padding) };

    if (getLayoutMode(updated) !== "free" || !updated.children?.length) {
      return updated;
    }

    const outerWidth = updated.freeLayout?.width ?? updated.dimensions?.preferredWidth;
    const outerHeight = updated.freeLayout?.height ?? updated.dimensions?.preferredHeight;
    if (outerWidth === undefined || outerHeight === undefined) return updated;

    const newContentBounds = {
      // An unset side is 0 here: the node now has a spacing record, so no
      // default padding applies to it (see ElementSpacing).
      width: Math.max(0, outerWidth - (padding?.left ?? 0) - (padding?.right ?? 0)),
      height: Math.max(0, outerHeight - (padding?.top ?? 0) - (padding?.bottom ?? 0)),
    };

    return {
      ...updated,
      children: updated.children.map((child) =>
        child.freeLayout
          ? {
              ...child,
              freeLayout: normalizeFreeLayoutGeometry(
                child.freeLayout,
                newContentBounds,
                getResizeConstraintsForTag(),
              ),
            }
          : child,
      ),
    };
  }

  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = setElementPadding(child, nodeId, padding);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}

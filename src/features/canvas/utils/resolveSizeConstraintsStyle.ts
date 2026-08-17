import { getSizeConstraints, isValidSizeConstraintValue } from "@/features/editor/types/sizeConstraints";
import type { ContainerLayoutMode } from "@/features/editor/types/layout";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { CSSProperties } from "react";

/**
 * The single owner of this node's final CSS maxWidth/maxHeight/minWidth/
 * minHeight (Checkpoint 5.7). Before this checkpoint, elementDimensionsStyle
 * unconditionally added `maxWidth: "100%", maxHeight: "100%"` to every
 * *resized* Flow node — real, load-bearing containment (Checkpoint 3.4.3):
 * it's what lets a resized child's own preferredWidth/preferredHeight
 * survive its parent later shrinking, without ever overflowing that
 * parent in the meantime (see elementDimensionsStyle's own doc comment
 * for the full reasoning) — not editor-only chrome, and not something
 * this checkpoint strips out.
 *
 * Now that a user can also set a real, explicit CSS max-width/max-height
 * (`sizeConstraints`), the two must compose rather than fight over which
 * resolver's spread happens to run last: `elementDimensionsStyle` no
 * longer touches maxWidth/maxHeight at all (see that file's own doc
 * comment) — this resolver owns both properties fully, for every node,
 * resized or not. When BOTH the legacy Flow containment and an explicit
 * user max apply to the same axis, the two compose into one CSS value via
 * `min(100%, <userMax>px)` — the browser picks whichever is smaller at
 * render time, so neither constraint is ever silently dropped. Free
 * children never get the legacy 100% containment (freeChildStyle's own
 * doc comment already explains why: independent absolute-positioned
 * geometry has no such containment need), so only a Flow node's own
 * `dimensions` triggers it here.
 *
 * minWidth/minHeight have no legacy counterpart to compose with — a
 * user's own value, when valid, is emitted as-is.
 *
 * Every field is resolved independently: a malformed value for one
 * constraint never suppresses a valid sibling constraint, and malformed
 * sizeConstraints data never throws.
 */
export function resolveSizeConstraintsStyle(
  node: EditorElementNode,
  parentLayoutMode: ContainerLayoutMode,
): CSSProperties {
  const constraints = getSizeConstraints(node);
  const style: CSSProperties = {};

  const userMaxWidth = constraints.maxWidth !== undefined && isValidSizeConstraintValue(constraints.maxWidth) ? constraints.maxWidth : undefined;
  const userMaxHeight = constraints.maxHeight !== undefined && isValidSizeConstraintValue(constraints.maxHeight) ? constraints.maxHeight : undefined;
  const userMinWidth = constraints.minWidth !== undefined && isValidSizeConstraintValue(constraints.minWidth) ? constraints.minWidth : undefined;
  const userMinHeight = constraints.minHeight !== undefined && isValidSizeConstraintValue(constraints.minHeight) ? constraints.minHeight : undefined;

  const legacyFlowContainmentApplies = parentLayoutMode !== "free" && node.dimensions !== undefined;

  if (legacyFlowContainmentApplies && userMaxWidth !== undefined) {
    style.maxWidth = `min(100%, ${userMaxWidth}px)`;
  } else if (legacyFlowContainmentApplies) {
    style.maxWidth = "100%";
  } else if (userMaxWidth !== undefined) {
    style.maxWidth = `${userMaxWidth}px`;
  }

  if (legacyFlowContainmentApplies && userMaxHeight !== undefined) {
    style.maxHeight = `min(100%, ${userMaxHeight}px)`;
  } else if (legacyFlowContainmentApplies) {
    style.maxHeight = "100%";
  } else if (userMaxHeight !== undefined) {
    style.maxHeight = `${userMaxHeight}px`;
  }

  if (userMinWidth !== undefined) style.minWidth = `${userMinWidth}px`;
  if (userMinHeight !== undefined) style.minHeight = `${userMinHeight}px`;

  return style;
}

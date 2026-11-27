import type { CSSProperties } from "react";
import { resolveNodeStyleRecipe } from "@/features/canvas/styling/resolveNodeStyleRecipe";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { FlowDisplayMode } from "@/features/editor/types/flowLayout";
import type { ContainerLayoutMode } from "@/features/editor/types/layout";
import type { LiveGestureSlice } from "@/features/editor/types/liveGesture";

/*
 * BC-17.3 — the live gesture override (BC-17.1.3 Report 1 §8.11). While a
 * geometry gesture is live, the generated sheet keeps the COMMITTED
 * declarations; the node itself paints the LIVE slice as inline style,
 * which beats every (non-!important) stylesheet declaration. The slice is
 * exactly the properties the gesture writes — nothing else is overridden.
 * It is derived from transient editor state on every render, never left
 * behind imperatively, so ending the gesture for any reason removes it.
 */

const SLICE_PROPERTIES: Readonly<
  Record<LiveGestureSlice, readonly (keyof CSSProperties)[]>
> = {
  // A Free child is placed by its own geometry (left/top/width/height).
  "free-geometry": ["left", "top", "width", "height"],
  // A Flow/Flex/Grid resize: the size family elementDimensionsStyle and
  // resolveSizeConstraintsStyle derive from dimensions (the anchor-edge
  // margins, the flex-shrink guard, the containment max sizes and the
  // text clip that appears once a text element has a fixed height).
  "flow-size": [
    "width",
    "height",
    "flexShrink",
    "marginLeft",
    "marginTop",
    "maxWidth",
    "maxHeight",
    "overflow",
  ],
  // A gradient stop drag: the complete background layer list.
  "background-image": ["backgroundImage"],
};

/** The inline override for a node under a live gesture: its live slice, from the same recipe the sheet compiles. */
export function liveGestureOverrideStyle(
  liveNode: EditorElementNode,
  context: {
    parentLayoutMode: ContainerLayoutMode;
    parentFlowDisplay: FlowDisplayMode;
  },
  slice: LiveGestureSlice,
): CSSProperties {
  const recipe = resolveNodeStyleRecipe(liveNode, {
    ...context,
    isPreview: false,
  });
  const style: CSSProperties = {};
  for (const property of SLICE_PROPERTIES[slice]) {
    const value = recipe.style[property];
    if (value !== undefined) Object.assign(style, { [property]: value });
  }
  return style;
}

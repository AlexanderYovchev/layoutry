/**
 * BC-17.3 — what a live geometry gesture writes for one node (BC-17.1.3
 * Report 1 §8.11): a Free child's left/top/width/height, a Flow/Flex/Grid
 * element's size family, or a gradient's background layer list. The
 * generated stylesheet keeps the committed value; the node paints the live
 * slice inline (canvas/styling/liveGestureOverride.ts).
 */
export type LiveGestureSlice =
  "free-geometry" | "flow-size" | "background-image";

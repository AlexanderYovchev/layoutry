/**
 * How intrinsic media (img; video/iframe once those exist — see
 * getElementCapabilities().supportsIntrinsicAspectRatio) fills its own
 * rendered box (Checkpoint 3.5.1). Exists because a Grid/Flex child's
 * outer box is deliberately stretched to fill its track/cell for
 * containment (see resolveFlexOrGridChildStyle's width/height: 100%) —
 * without a separate fit rule for the *visual content* inside that box,
 * an intrinsic-ratio image would distort to match the box's shape
 * instead of preserving its own proportions.
 */
export type MediaFit = "contain" | "cover" | "fill";
export type MediaPosition = "center" | "top" | "bottom" | "left" | "right";

export interface MediaFitSettings {
  fit: MediaFit;
  position: MediaPosition;
  /** false forces the visual content to stretch (CSS object-fit: fill) regardless of `fit`, an explicit escape hatch distinct from choosing "fill" as the fit itself. */
  preserveAspectRatio: boolean;
}

const DEFAULT_MEDIA_FIT: MediaFitSettings = {
  fit: "contain",
  position: "center",
  preserveAspectRatio: true,
};

/** A node with no mediaFit set renders with the safe default: contain, centered, aspect ratio preserved. */
export function getMediaFitSettings(node: { mediaFit?: MediaFitSettings }): MediaFitSettings {
  return node.mediaFit ?? DEFAULT_MEDIA_FIT;
}

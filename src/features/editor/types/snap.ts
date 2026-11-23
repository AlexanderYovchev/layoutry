/**
 * Free-layout Snap's ephemeral editor state (Checkpoint 1.15.6.1.1; BC-13.3
 * guides, distances and equal spacing) — the shape of transient UI state the
 * store holds while a Free drag is in progress. Never a document field,
 * never pushed to history, never exported. The snapping ALGORITHM
 * (canvas/utils/snapEngine) and the guide geometry
 * (canvas/utils/buildFreeSnapGuides) live in the canvas feature; editor only
 * owns this state slot, so CanvasOverlay and the move session share it
 * without editor importing canvas.
 *
 * Every coordinate is in the dragged element's parent Free container's
 * LOCAL frame (origin = its padding-box corner; see
 * canvas/utils/freeLayoutFrame.ts), in CSS px.
 */

/** A guide line on one axis: `coordinate` is x for a vertical line, y for a horizontal one; from/to is its extent along the other axis. */
export interface SnapGuideSegment {
  coordinate: number;
  from: number;
  to: number;
  /**
   * true: the element is exactly aligned here (snapped, or already aligned).
   * false: a nearby alignment that was NOT applied (automatic snapping off,
   * or bypassed with Alt/Option) — drawn differently, never as a snap (D22).
   */
  achieved: boolean;
}

/** A CSS-px measurement between two border-box edges: along `axis`, from → to, drawn at `at` on the other axis. */
export interface SnapDistanceLabel {
  axis: "x" | "y";
  from: number;
  to: number;
  at: number;
  value: number;
}

/** Equal spacing: the equal gaps (along `axis`) drawn at `at` on the other axis, each `value` CSS px. */
export interface SnapSpacingIndicator {
  axis: "x" | "y";
  gaps: { from: number; to: number }[];
  at: number;
  value: number;
  achieved: boolean;
}

export interface ActiveSnapGuides {
  /** The Free container the dragged child belongs to (whose local frame the coordinates use). */
  containerId: string;
  /** The winning x-axis alignment (a vertical line), if any. */
  vertical?: SnapGuideSegment;
  /** The winning y-axis alignment (a horizontal line), if any. */
  horizontal?: SnapGuideSegment;
  distances: SnapDistanceLabel[];
  spacing: SnapSpacingIndicator[];
}

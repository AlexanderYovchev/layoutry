/**
 * Free-layout Snap's own ephemeral editor state (Checkpoint 1.15.6.1.1)
 * — mirrors svgEditMode.ts's SvgDraft exactly in spirit: this describes
 * ONLY the shape of transient UI state the store holds while a snapped
 * drag is in progress, never a document/EditorElementNode field, never
 * pushed to history, and with no effect on exported CSS (see this
 * checkpoint's own report, section A/B). The actual snap ALGORITHM that
 * produces these values (resolveFreeMoveSnap) lives in
 * `canvas/utils`, matching this repo's ownership split — canvas owns
 * snapping/alignment guides, editor only owns the state slot they're
 * stored in for the duration of one drag, so CanvasOverlay (a canvas
 * component) and the move session hook (also canvas) can share it via
 * the store without editor importing anything from canvas.
 */
export interface ActiveSnapGuides {
  /** The Free container the currently-dragged child belongs to — lets the guide overlay find and measure the right container without threading extra props through CanvasOverlay. */
  containerId: string;
  /** Present only when the x-axis actually snapped this frame — content-box-relative x position (same coordinate space as FreeLayoutGeometry.x) a vertical guide line should be drawn at. */
  vertical?: number;
  /** Present only when the y-axis actually snapped this frame — content-box-relative y position (same coordinate space as FreeLayoutGeometry.y) a horizontal guide line should be drawn at. */
  horizontal?: number;
}

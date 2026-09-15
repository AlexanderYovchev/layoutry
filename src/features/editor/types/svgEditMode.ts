import type { SvgVectorPoint } from "@/features/editor/types/svgScene";

/**
 * SVG Edit Mode's own UI state shape (Checkpoint 1.15.6, section 11 of
 * its own brief) — deliberately NOT document state: none of this lives
 * on `EditorElementNode`, none of it enters undo/redo history, and it is
 * safely reset the moment the edited SVG is deleted or the outer
 * document selection moves elsewhere (see useEditorStore.ts's own
 * svgEditMode subscription). Mirrors the same "editor-local, not
 * document" shape EditorSelection (types/selection.ts) already
 * established for the outer document's own selection model — this is
 * that same kind of state, one level down, scoped to a single SVG's
 * internal vector scene instead of the whole document tree.
 */
export type SvgDrawingTool = "select" | "rect" | "ellipse" | "line" | "polygon" | "pen";

/**
 * An in-progress, uncommitted Polygon or Pen path — click-accumulated
 * points that exist ONLY in UI state until Enter/double-click commits
 * them (via the store's commitSvgDraft, which is what actually calls
 * addSvgObject and pushes the one real history entry) or Escape discards
 * them with zero history (section 36 of this checkpoint's own brief:
 * "prefer keeping an unfinished shape/path outside the committed
 * document"). Rect/Ellipse/Line drawing does NOT use this — those are a
 * single drag gesture, tracked entirely inside their own session hook
 * (see canvas/hooks/useSvgShapeDrawingSession.ts) with no need for a
 * shared, store-visible in-progress shape.
 */
export interface SvgDraft {
  tool: "polygon" | "pen";
  points: SvgVectorPoint[];
}

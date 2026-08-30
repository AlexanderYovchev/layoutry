import type { ElementDimensions } from "@/features/editor/types/document";

export type ResizeDirection = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export interface ResizeConstraints {
  minWidth: number;
  minHeight: number;
}

/**
 * The generic, editor-level resize floor (Checkpoint 1.12.1) — a minimal
 * positive size that keeps geometry valid (never zero/negative, never
 * degenerate for ratio math) without treating any tag's creation size or
 * category as a minimum. A newly-created element's factory dimensions are
 * only a starting point; the user must be able to shrink well below them.
 * Deliberately generic and tag-independent — see getResizeConstraintsForTag.
 */
export const DEFAULT_RESIZE_CONSTRAINTS: ResizeConstraints = {
  minWidth: 4,
  minHeight: 4,
};

/**
 * The rect a resize may not cross, in the same canvas-root-relative
 * coordinate space useMeasuredNodeRect already uses. Resolved once per
 * drag (see resolveResizeBounds) from the resized node's containing
 * block — its immediate parent's content box — never re-derived mid-drag.
 */
export interface ResizeBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * One in-progress resize drag: the node/direction being resized, the
 * size/position/offset it started from, and the containing-block bounds
 * it may not cross. Captured once at pointer-down (see useResizeSession)
 * so every pointermove tick derives from this stable snapshot instead of
 * re-measuring the DOM or re-walking the layout hierarchy.
 */
export interface ResizeSession {
  nodeId: string;
  direction: ResizeDirection;
  startWidth: number;
  startHeight: number;
  /** The node's current rendered position (already reflecting any prior offsetX/offsetY), relative to the canvas root. */
  startLeft: number;
  startTop: number;
  /** The node's dimensions.offsetX/offsetY at drag start — a west/north resize composes on top of these, it never assumes they start at 0. */
  startOffsetX: number;
  startOffsetY: number;
  startPointerX: number;
  startPointerY: number;
  bounds: ResizeBounds;
}

/** A resize's outcome is a complete ElementDimensions snapshot — every commit fully replaces the prior value, never a partial patch. */
export type ResizeResult = ElementDimensions;

/**
 * Raw CSS cursor value per handle direction, used to pin the operating
 * system cursor for the duration of a drag (see useResizeSession) so it
 * keeps matching the active handle even when the pointer briefly outruns
 * the small hit target. Tailwind's own `cursor-*` utilities (used for the
 * handles' resting hover cursor) are declared separately as literal
 * classes in ResizeHandles, since Tailwind's class scanner can't see a
 * value built from this map at runtime — the two must be kept in sync by
 * hand.
 */
export const RESIZE_HANDLE_CURSORS: Record<ResizeDirection, string> = {
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
  nw: "nwse-resize",
  se: "nwse-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
};

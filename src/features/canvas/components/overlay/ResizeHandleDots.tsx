"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import { cn } from "@/lib/utils";
import type { ResizeDirection } from "@/features/editor/types/resize";

export interface ResizeHandleDotsProps {
  activeDirection: ResizeDirection | null;
  onPointerDown: (direction: ResizeDirection) => (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;
}

const HANDLE_DIRECTIONS: readonly ResizeDirection[] = [
  "n",
  "ne",
  "e",
  "se",
  "s",
  "sw",
  "w",
  "nw",
];

/**
 * Each handle's resting position and cursor as one literal Tailwind class
 * string per direction — deliberately not composed from the
 * RESIZE_HANDLE_CURSORS map (see resize.ts), since Tailwind's class
 * scanner only picks up classes it can find as literal text in source.
 * Centered exactly on the selection box's edge/corner (via the
 * translate-1/2 pair) so the handle sits straddling the outline, reading
 * as "just outside" it without needing separate offset math per side.
 */
const HANDLE_POSITION_CLASSES: Record<ResizeDirection, string> = {
  n: "top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize",
  s: "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-ns-resize",
  e: "top-1/2 right-0 -translate-y-1/2 translate-x-1/2 cursor-ew-resize",
  w: "top-1/2 left-0 -translate-y-1/2 -translate-x-1/2 cursor-ew-resize",
  nw: "top-0 left-0 -translate-y-1/2 -translate-x-1/2 cursor-nwse-resize",
  se: "bottom-0 right-0 translate-y-1/2 translate-x-1/2 cursor-nwse-resize",
  ne: "top-0 right-0 -translate-y-1/2 translate-x-1/2 cursor-nesw-resize",
  sw: "bottom-0 left-0 translate-y-1/2 -translate-x-1/2 cursor-nesw-resize",
};

/**
 * The eight resize-handle dots' shared presentation, extracted so both
 * ResizeHandles (Flow — useResizeSession) and FreeChildResizeHandles
 * (Free — useFreeChildResizeSession, Checkpoint 3.4.4) render byte-
 * identical markup/positioning from one place, differing only in which
 * session hook supplies the pointer handlers. Plain `div`s, not
 * `button`s — no default tab stop, no accessible-name requirement,
 * matching the checkpoint's "don't introduce unnecessary tab stops,
 * keyboard resizing is a future milestone" instruction; the parent
 * CanvasOverlay is already aria-hidden, consistent with the rest of the
 * (pointer-only) overlay tree.
 *
 * A completed mouse down+up on a handle also fires a native `click`
 * afterward, same as any element. Handles live in the overlay layer, not
 * inside the resized document node itself, so that click's target has no
 * `data-node-id` ancestor — left alone, it would bubble to
 * CanvasInteractionBoundary's window click listener and read as "clicked
 * blank canvas," clearing the very selection the user is mid-resize on.
 * Stopping propagation on the handle's own click (not just its
 * pointerdown, which is a separate event) is what keeps a resize from
 * ever deselecting its target.
 */
export function ResizeHandleDots({
  activeDirection,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: ResizeHandleDotsProps) {
  return (
    <>
      {HANDLE_DIRECTIONS.map((direction) => (
        <div
          key={direction}
          data-resize-handle={direction}
          className={cn(
            "pointer-events-auto absolute size-2.5 rounded-full border-2 border-canvas-selection bg-white shadow-sm transition-transform duration-100 hover:scale-125",
            HANDLE_POSITION_CLASSES[direction],
            activeDirection === direction && "scale-125 bg-canvas-selection",
          )}
          onPointerDown={onPointerDown(direction)}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onClick={(event) => event.stopPropagation()}
        />
      ))}
    </>
  );
}

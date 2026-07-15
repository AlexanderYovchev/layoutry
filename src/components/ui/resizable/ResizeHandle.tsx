"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import { cn } from "@/lib/utils";

interface ResizeHandleProps {
  /** Identifies which panel this resizes for assistive technology, e.g. "Resize Resource Panel". */
  "aria-label": string;
  /** Current, minimum, and maximum panel width in pixels — exposes the handle's state per the ARIA separator (widget) pattern. Purely informational: there is no keyboard-driven resize yet. */
  valueNow: number;
  valueMin: number;
  valueMax: number;
  isDragging: boolean;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  className?: string;
}

/**
 * Generic draggable edge for horizontally resizing a side panel.
 * Positioning (which edge of the panel it sits against) is left to the
 * consumer via className; the same handle will work for a future
 * bottom console or any other resizable region once a vertical variant
 * is needed.
 */
export function ResizeHandle({
  "aria-label": ariaLabel,
  valueNow,
  valueMin,
  valueMax,
  isDragging,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  className,
}: ResizeHandleProps) {
  return (
    <div
      role="separator"
      aria-label={ariaLabel}
      aria-orientation="vertical"
      aria-valuenow={valueNow}
      aria-valuemin={valueMin}
      aria-valuemax={valueMax}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className={cn(
        // The outer box is the actual hit target — wider than the 1px
        // visual line it draws (see the inner div below) so the handle
        // stays practically usable without widening what's on screen.
        "group absolute inset-y-0 z-10 w-2.5 shrink-0 cursor-col-resize touch-none select-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500",
        className,
      )}
    >
      <div
        className={cn(
          "absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors duration-150 ease-out",
          isDragging
            ? "bg-zinc-400 dark:bg-zinc-600"
            : "bg-transparent group-hover:bg-zinc-300 dark:group-hover:bg-zinc-700",
        )}
      />
    </div>
  );
}

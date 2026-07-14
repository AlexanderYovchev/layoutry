"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import { cn } from "@/lib/utils";

interface ResizeHandleProps {
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
  isDragging,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  className,
}: ResizeHandleProps) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className={cn(
        "group absolute inset-y-0 z-10 w-1.5 shrink-0 cursor-col-resize touch-none select-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500",
        className,
      )}
    >
      <div
        className={cn(
          "absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors",
          isDragging
            ? "bg-zinc-400 dark:bg-zinc-600"
            : "bg-transparent group-hover:bg-zinc-300 dark:group-hover:bg-zinc-700",
        )}
      />
    </div>
  );
}

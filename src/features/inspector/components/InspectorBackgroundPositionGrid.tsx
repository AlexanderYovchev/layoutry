"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { InspectorPropertyStateDot } from "@/features/inspector/components/InspectorPropertyStateDot";
import type { BackgroundPosition } from "@/features/editor/types/background";
import type { PropertyState } from "@/features/inspector/types/propertyState";

interface InspectorBackgroundPositionGridProps {
  value: BackgroundPosition | undefined;
  onSelect: (position: BackgroundPosition) => void;
  disabled?: boolean;
  state?: PropertyState;
  /** Reset affordance rendered after the grid — typically an InspectorResetButton. */
  reset?: ReactNode;
}

const GRID: BackgroundPosition[] = [
  "top-left",
  "top-center",
  "top-right",
  "center-left",
  "center",
  "center-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

const POSITION_LABELS: Record<BackgroundPosition, string> = {
  "top-left": "Top left",
  "top-center": "Top center",
  "top-right": "Top right",
  "center-left": "Center left",
  center: "Center",
  "center-right": "Center right",
  "bottom-left": "Bottom left",
  "bottom-center": "Bottom center",
  "bottom-right": "Bottom right",
};

/**
 * The nine-point beginner position grid (Checkpoint 4.3) — a 3x3 button
 * grid rather than free X/Y inputs (out of scope for this checkpoint —
 * see BackgroundPosition's own doc comment on how a future free-form
 * position widens the type without migrating existing presets). 2D
 * Arrow-key navigation mirrors InspectorSegmentedRow's 1D Left/Right
 * pattern, extended to Up/Down across rows. Each cell's accessible name
 * is a plain-language label ("Top left", "Center"), not a coordinate.
 */
export function InspectorBackgroundPositionGrid({ value, onSelect, disabled = false, state, reset }: InspectorBackgroundPositionGridProps) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const row = Math.floor(index / 3);
    const col = index % 3;
    let nextRow = row;
    let nextCol = col;
    if (event.key === "ArrowRight") nextCol = (col + 1) % 3;
    else if (event.key === "ArrowLeft") nextCol = (col + 2) % 3;
    else if (event.key === "ArrowDown") nextRow = (row + 1) % 3;
    else if (event.key === "ArrowUp") nextRow = (row + 2) % 3;
    else return;
    event.preventDefault();
    buttonRefs.current[nextRow * 3 + nextCol]?.focus();
  }

  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <div className="flex min-w-0 items-center gap-1 text-zinc-500 dark:text-zinc-400">
        <span className="truncate">Position</span>
        {state && <InspectorPropertyStateDot state={state} />}
      </div>
      <div className="flex items-center gap-1">
        <div
          role="group"
          aria-label="Position"
          className="grid grid-cols-3 gap-1 rounded-md border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-900"
        >
          {GRID.map((position, index) => {
            const isActive = position === value;
            return (
              <button
                key={position}
                ref={(el) => {
                  buttonRefs.current[index] = el;
                }}
                type="button"
                disabled={disabled}
                aria-label={POSITION_LABELS[position]}
                title={POSITION_LABELS[position]}
                aria-pressed={isActive}
                onClick={() => onSelect(position)}
                onKeyDown={(event) => handleKeyDown(event, index)}
                className={cn(
                  "flex size-5 items-center justify-center rounded-sm transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 disabled:pointer-events-none disabled:opacity-40",
                  isActive
                    ? "bg-zinc-300 dark:bg-zinc-700"
                    : "bg-zinc-200/60 hover:bg-zinc-200 dark:bg-zinc-800/60 dark:hover:bg-zinc-800",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-1.5 rounded-full",
                    isActive ? "bg-zinc-700 dark:bg-zinc-200" : "bg-zinc-400 dark:bg-zinc-600",
                  )}
                />
              </button>
            );
          })}
        </div>
        {reset}
      </div>
    </div>
  );
}

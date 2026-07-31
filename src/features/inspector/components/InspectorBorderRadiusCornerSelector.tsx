"use client";

import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { BORDER_RADIUS_CORNERS, type BorderRadiusCorner } from "@/features/editor/types/borderRadius";

interface InspectorBorderRadiusCornerSelectorProps {
  value: BorderRadiusCorner;
  onSelect: (corner: BorderRadiusCorner) => void;
  /** Corners that currently have an explicit radius value — rendered as a filled dot rather than a bare outline, same at-a-glance-summary role InspectorBorderVisualSideSelector's configuredSides plays. */
  configuredCorners: ReadonlySet<BorderRadiusCorner>;
  disabled?: boolean;
}

const CORNER_LABELS: Record<BorderRadiusCorner, string> = {
  topLeft: "Top left corner",
  topRight: "Top right corner",
  bottomRight: "Bottom right corner",
  bottomLeft: "Bottom left corner",
};

/** row 0 = top, row 1 = bottom; col 0 = left, col 1 = right — a plain 2x2 grid, the natural shape for exactly four corners. */
const CORNER_POSITION: Record<BorderRadiusCorner, { row: 0 | 1; col: 0 | 1 }> = {
  topLeft: { row: 0, col: 0 },
  topRight: { row: 0, col: 1 },
  bottomRight: { row: 1, col: 1 },
  bottomLeft: { row: 1, col: 0 },
};
const CORNER_BY_POSITION: Record<string, BorderRadiusCorner> = {
  "0-0": "topLeft",
  "0-1": "topRight",
  "1-1": "bottomRight",
  "1-0": "bottomLeft",
};

/**
 * A small rectangle representing the element's four corners (Checkpoint
 * 4.5's #7) — a deliberate sibling of InspectorBorderVisualSideSelector,
 * not a variant of it: that one selects an *edge* from four (rendered as
 * strips along each side); this one selects a *corner* from four
 * (rendered as a dot at each corner). Forcing one shape into the other's
 * visual metaphor would make both harder to read, and a future
 * checkpoint needing a third kind of four-way selector (unlikely, but
 * this shape generalizes) can follow the same "small dedicated
 * primitive" precedent rather than growing either existing one a mode
 * switch.
 *
 * Arrow-key navigation treats the four corners as a plain 2x2 grid:
 * Up/Down move to the top/bottom row *in the same column*, Left/Right
 * move to the left/right column *in the same row* — the direct 2D
 * analog of InspectorBackgroundPositionGrid's row/column navigation,
 * scaled down from a 3x3 grid to 2x2. This differs from
 * InspectorBorderVisualSideSelector's own "each arrow always jumps to
 * one specific, fixed edge" rule, because a corner is genuinely
 * two-dimensional (it has both a row and a column) where a side is not.
 */
export function InspectorBorderRadiusCornerSelector({
  value,
  onSelect,
  configuredCorners,
  disabled = false,
}: InspectorBorderRadiusCornerSelectorProps) {
  const buttonRefs = useRef<Record<BorderRadiusCorner, HTMLButtonElement | null>>({
    topLeft: null,
    topRight: null,
    bottomRight: null,
    bottomLeft: null,
  });

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, corner: BorderRadiusCorner) {
    const { row, col } = CORNER_POSITION[corner];
    let nextRow = row;
    let nextCol = col;
    if (event.key === "ArrowUp") nextRow = 0;
    else if (event.key === "ArrowDown") nextRow = 1;
    else if (event.key === "ArrowLeft") nextCol = 0;
    else if (event.key === "ArrowRight") nextCol = 1;
    else return;
    event.preventDefault();
    buttonRefs.current[CORNER_BY_POSITION[`${nextRow}-${nextCol}`]]?.focus();
  }

  return (
    <div
      role="group"
      aria-label="Border radius corner"
      className="relative mx-auto size-16 shrink-0 rounded-md border border-dashed border-zinc-300 dark:border-zinc-700"
    >
      {BORDER_RADIUS_CORNERS.map((corner) => {
        const isSelected = corner === value;
        const isConfigured = configuredCorners.has(corner);
        return (
          <button
            key={corner}
            ref={(el) => {
              buttonRefs.current[corner] = el;
            }}
            type="button"
            disabled={disabled}
            aria-label={CORNER_LABELS[corner]}
            title={CORNER_LABELS[corner]}
            aria-pressed={isSelected}
            onClick={() => onSelect(corner)}
            onKeyDown={(event) => handleKeyDown(event, corner)}
            className={cn(
              "absolute size-3 rounded-sm transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 disabled:pointer-events-none disabled:opacity-40",
              corner === "topLeft" && "top-1 left-1",
              corner === "topRight" && "top-1 right-1",
              corner === "bottomRight" && "bottom-1 right-1",
              corner === "bottomLeft" && "bottom-1 left-1",
              isSelected
                ? "bg-blue-500"
                : isConfigured
                  ? "bg-zinc-400 hover:bg-zinc-500 dark:bg-zinc-500 dark:hover:bg-zinc-400"
                  : "bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600",
            )}
          />
        );
      })}
    </div>
  );
}

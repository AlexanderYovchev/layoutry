"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { InspectorPropertyStateDot } from "@/features/inspector/components/InspectorPropertyStateDot";
import { SHAPE_PRESETS, type ShapePreset } from "@/features/editor/types/shape";
import type { PropertyState } from "@/features/inspector/types/propertyState";
import {
  inspectorChoiceCellClassName,
  inspectorChoiceGridClassName,
  inspectorChoiceMarkClassName,
} from "@/features/inspector/components/inspectorChoiceGridClassNames";

interface InspectorShapeGridProps {
  /** The preset to highlight as active, or undefined for a mixed multi-selection (no single preset highlighted). */
  activePreset: ShapePreset | undefined;
  onSelect: (preset: ShapePreset) => void;
  disabled?: boolean;
  state?: PropertyState;
  /** Reset affordance rendered after the grid — typically an InspectorResetButton. */
  reset?: ReactNode;
}

const COLUMNS = 4;

/**
 * The Shape preset picker (Checkpoint 1.15.4) — same 2D grid-of-buttons
 * shape as InspectorBackgroundPositionGrid/InspectorObjectPositionGrid
 * (arrow-key navigation, a small swatch per cell, a plain-language
 * accessible name), reused here for both the single-node
 * (InspectorShapeSection) and bulk (InspectorBulkShapeSection) surfaces —
 * shared rather than duplicated, since both need the exact same 11
 * presets and interaction shape, differing only in the value/onSelect
 * they're wired to.
 *
 * Each cell's tiny preview swatch reads its `clip-path` directly from
 * SHAPE_PRESETS — the same central mapping the Canvas renderer
 * (resolveShapeStyle) reads — so the preview can never drift out of sync
 * with what actually renders (section 11 of this checkpoint's own brief:
 * "preview == Canvas behavior"). "Rectangle" (the "none" preset) has no
 * clip-path at all, so its swatch is simply an unclipped filled square,
 * accurately representing "no shape."
 */
export function InspectorShapeGrid({ activePreset, onSelect, disabled = false, state, reset }: InspectorShapeGridProps) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Clamped (not wrapped) navigation — unlike the fixed 3x3 grids
  // InspectorBackgroundPositionGrid/InspectorObjectPositionGrid use, this
  // grid's last row is ragged (11 presets over 4 columns), so a modulo-
  // based wrap would land on a nonexistent cell; simply stopping at each
  // edge is correct and unsurprising for a ragged grid.
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const lastIndex = SHAPE_PRESETS.length - 1;
    let nextIndex = index;
    if (event.key === "ArrowRight") nextIndex = Math.min(index + 1, lastIndex);
    else if (event.key === "ArrowLeft") nextIndex = Math.max(index - 1, 0);
    else if (event.key === "ArrowDown") nextIndex = Math.min(index + COLUMNS, lastIndex);
    else if (event.key === "ArrowUp") nextIndex = Math.max(index - COLUMNS, 0);
    else return;
    event.preventDefault();
    buttonRefs.current[nextIndex]?.focus();
  }

  return (
    <div className="flex flex-col gap-1.5 text-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1 text-fg-secondary">
          <span className="truncate">Shape</span>
          {state && <InspectorPropertyStateDot state={state} />}
        </div>
        {reset}
      </div>
      <div
        role="group"
        aria-label="Shape"
        className={cn("grid grid-cols-4 gap-1", inspectorChoiceGridClassName)}
      >
        {SHAPE_PRESETS.map((preset, index) => {
          const isActive = preset.id === activePreset;
          return (
            <button
              key={preset.id}
              ref={(el) => {
                buttonRefs.current[index] = el;
              }}
              type="button"
              disabled={disabled}
              aria-label={preset.label}
              title={preset.label}
              aria-pressed={isActive}
              onClick={() => onSelect(preset.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={cn(
                "flex h-9 items-center justify-center rounded-sm transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-40",
                inspectorChoiceCellClassName(isActive),
              )}
            >
              <span
                aria-hidden="true"
                style={preset.clipPath ? { clipPath: preset.clipPath } : undefined}
                className={cn("size-4 shrink-0", inspectorChoiceMarkClassName(isActive))}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { InspectorPropertyStateDot } from "@/features/inspector/components/InspectorPropertyStateDot";
import { OBJECT_POSITION_PRESETS, type ObjectPositionPresetKey } from "@/features/editor/types/mediaFit";
import type { PropertyState } from "@/features/inspector/types/propertyState";

interface InspectorObjectPositionGridProps {
  /** The preset key exactly matching the current *effective* x/y (see detectObjectPositionPreset), or undefined for a custom position that matches none of the nine. */
  activeKey: ObjectPositionPresetKey | undefined;
  onSelect: (preset: { key: ObjectPositionPresetKey; x: number; y: number }) => void;
  disabled?: boolean;
  state?: PropertyState;
  /** Reset affordance rendered after the grid — typically an InspectorResetButton. */
  reset?: ReactNode;
}

const GRID: readonly ObjectPositionPresetKey[] = OBJECT_POSITION_PRESETS.map((preset) => preset.key);
const PRESET_BY_KEY: Record<ObjectPositionPresetKey, { x: number; y: number; label: string }> = Object.fromEntries(
  OBJECT_POSITION_PRESETS.map((preset) => [preset.key, { x: preset.x, y: preset.y, label: preset.label }]),
) as Record<ObjectPositionPresetKey, { x: number; y: number; label: string }>;

/**
 * The Object Position 3x3 grid (Checkpoint 5.6) — same visual/interaction
 * shape as InspectorBackgroundPositionGrid (2D Arrow-key navigation, a
 * dot-in-cell button per position, plain-language accessible names), but
 * a deliberately separate component: Background Position is a fixed
 * 9-keyword enum with no custom escape hatch, while Object Position's
 * underlying value is a pair of arbitrary (even out-of-range) percentages
 * — this grid only ever *selects* one of the nine exact presets, it never
 * owns the custom X/Y fields rendered alongside it in
 * InspectorMediaSection. `activeKey` is derived by the caller from live
 * document data (detectObjectPositionPreset), not tracked here — this
 * component holds no local state at all, which is what keeps it immune
 * to the stale-view-after-Undo/Redo bug class found and fixed in
 * Checkpoint 5.5's InspectorAspectRatioSection.
 */
export function InspectorObjectPositionGrid({ activeKey, onSelect, disabled = false, state, reset }: InspectorObjectPositionGridProps) {
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
          {GRID.map((key, index) => {
            const preset = PRESET_BY_KEY[key];
            const isActive = key === activeKey;
            return (
              <button
                key={key}
                ref={(el) => {
                  buttonRefs.current[index] = el;
                }}
                type="button"
                disabled={disabled}
                aria-label={`Position ${preset.label.toLowerCase()}`}
                title={preset.label}
                aria-pressed={isActive}
                onClick={() => onSelect({ key, x: preset.x, y: preset.y })}
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

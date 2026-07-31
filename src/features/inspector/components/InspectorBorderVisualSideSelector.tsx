"use client";

import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { BORDER_SIDES, type BorderSide } from "@/features/editor/types/border";

interface InspectorBorderVisualSideSelectorProps {
  value: BorderSide;
  onSelect: (side: BorderSide) => void;
  /** Sides that currently have explicit border settings — rendered as a filled strip rather than a bare outline, so the selector doubles as an at-a-glance summary of which sides are configured (Checkpoint 4.4's #9). */
  configuredSides: ReadonlySet<BorderSide>;
  disabled?: boolean;
}

const SIDE_LABELS: Record<BorderSide, string> = {
  top: "Top border",
  right: "Right border",
  bottom: "Bottom border",
  left: "Left border",
};

/**
 * A small rectangle representing the element's four edges (Checkpoint
 * 4.4's #9) — clicking (or arrow-navigating to, then activating) an edge
 * selects it for the Width/Style/Color controls above. Arrow keys jump
 * directly to the geometrically corresponding side (Up -> top, Right ->
 * right, ...) rather than cycling through a 1D order, since the widget's
 * whole point is that each button already sits at a fixed geometric
 * position — a direct mapping reads more predictably than "next/previous"
 * would. Deliberately built as its own small primitive rather than
 * extending InspectorBackgroundPositionGrid (that one selects a *point*
 * from nine; this one selects an *edge* from four) so a future Border
 * Radius corner-selector variant can share this component's shape without
 * this one growing an unrelated point-vs-edge mode switch.
 */
export function InspectorBorderVisualSideSelector({
  value,
  onSelect,
  configuredSides,
  disabled = false,
}: InspectorBorderVisualSideSelectorProps) {
  const buttonRefs = useRef<Record<BorderSide, HTMLButtonElement | null>>({
    top: null,
    right: null,
    bottom: null,
    left: null,
  });

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    let next: BorderSide | undefined;
    if (event.key === "ArrowUp") next = "top";
    else if (event.key === "ArrowRight") next = "right";
    else if (event.key === "ArrowDown") next = "bottom";
    else if (event.key === "ArrowLeft") next = "left";
    else return;
    event.preventDefault();
    buttonRefs.current[next]?.focus();
  }

  return (
    <div
      role="group"
      aria-label="Border side"
      className="relative mx-auto size-16 shrink-0 rounded-md border border-dashed border-zinc-300 dark:border-zinc-700"
    >
      {BORDER_SIDES.map((side) => {
        const isSelected = side === value;
        const isConfigured = configuredSides.has(side);
        return (
          <button
            key={side}
            ref={(el) => {
              buttonRefs.current[side] = el;
            }}
            type="button"
            disabled={disabled}
            aria-label={SIDE_LABELS[side]}
            title={SIDE_LABELS[side]}
            aria-pressed={isSelected}
            onClick={() => onSelect(side)}
            onKeyDown={handleKeyDown}
            className={cn(
              "absolute rounded-sm transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 disabled:pointer-events-none disabled:opacity-40",
              side === "top" && "inset-x-2 top-0 h-2",
              side === "bottom" && "inset-x-2 bottom-0 h-2",
              side === "left" && "inset-y-2 left-0 w-2",
              side === "right" && "inset-y-2 right-0 w-2",
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

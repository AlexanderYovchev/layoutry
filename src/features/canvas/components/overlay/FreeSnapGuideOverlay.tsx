"use client";

import type { RefObject } from "react";
import { useMeasuredNodeRect } from "@/features/canvas/hooks/useMeasuredNodeRect";
import { localOriginInset } from "@/features/canvas/utils/freeLayoutFrame";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { SnapDistanceLabel, SnapGuideSegment, SnapSpacingIndicator } from "@/features/editor/types/snap";

interface FreeSnapGuideOverlayProps {
  canvasRootRef: RefObject<HTMLElement | null>;
}

/**
 * The guide values are in the container's local Free frame, whose origin is
 * its padding-box corner (inside the border, where its absolute children
 * render; BC-13.2), not border + padding.
 */
function readOriginInset(canvasRootRef: RefObject<HTMLElement | null>, containerId: string): { left: number; top: number } {
  const containerEl = canvasRootRef.current?.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(containerId)}"]`);
  return containerEl ? localOriginInset(containerEl) : { left: 0, top: 0 };
}

function formatPx(value: number): string {
  return `${Number.isInteger(value) ? value : value.toFixed(1)}`;
}

/** A small CSS-px measurement chip, centred on (x, y) in overlay space. */
function Label({ x, y, value, kind }: { x: number; y: number; value: number; kind: "distance" | "spacing" }) {
  return (
    <span
      data-canvas-overlay={kind === "distance" ? "snap-distance-label" : "snap-spacing-label"}
      className={cn(
        "absolute -translate-x-1/2 -translate-y-1/2 rounded-sm px-1 py-px font-mono text-[10px] leading-none font-medium whitespace-nowrap text-white",
        kind === "distance" ? "bg-canvas-guide" : "bg-fuchsia-600",
      )}
      style={{ left: x, top: y }}
    >
      {formatPx(value)}
    </span>
  );
}

/**
 * BC-13.3 — the editor-only guide overlay for a Free drag (inside
 * CanvasOverlay, which renders nothing in Preview and is outside the
 * document surface, so nothing here is ever exported):
 * - the winning alignment line per axis — solid when the element is aligned
 *   (snapped, or exactly aligned already), dashed when it's a nearby
 *   alignment that wasn't applied (Snap off, or Alt/Option held: D22);
 * - one CSS-px distance label per line, to the nearest referenced element;
 * - equal-spacing indicators: each equal gap as a bracket with its value.
 * Fixed 1px lines and 10px labels in screen space (no zoom yet). No
 * animation, and pointer-events:none so it never intercepts the drag.
 */
export function FreeSnapGuideOverlay({ canvasRootRef }: FreeSnapGuideOverlayProps) {
  const guides = useEditorStore((state) => state.activeSnapGuides);
  const containerRect = useMeasuredNodeRect(canvasRootRef, guides?.containerId ?? null, { trackScroll: true });

  if (!guides || !containerRect) return null;

  const inset = readOriginInset(canvasRootRef, guides.containerId);
  const originX = containerRect.left + inset.left;
  const originY = containerRect.top + inset.top;
  const vertical: SnapGuideSegment | undefined = guides.vertical;
  const horizontal: SnapGuideSegment | undefined = guides.horizontal;

  const distanceLabel = (label: SnapDistanceLabel, index: number) => {
    const middle = (label.from + label.to) / 2;
    return label.axis === "x" ? (
      <Label key={`d${index}`} x={originX + middle} y={originY + label.at} value={label.value} kind="distance" />
    ) : (
      <Label key={`d${index}`} x={originX + label.at} y={originY + middle} value={label.value} kind="distance" />
    );
  };

  const spacingIndicator = (indicator: SnapSpacingIndicator, index: number) =>
    indicator.gaps.map((gap, gapIndex) => {
      const middle = (gap.from + gap.to) / 2;
      const horizontalGap = indicator.axis === "x";
      return (
        <div key={`s${index}-${gapIndex}`}>
          <div
            data-canvas-overlay="snap-spacing-gap"
            className={cn("absolute border-fuchsia-600", horizontalGap ? "h-1.5 border-x" : "w-1.5 border-y", !indicator.achieved && "border-dashed opacity-70")}
            style={
              horizontalGap
                ? { left: originX + gap.from, top: originY + indicator.at - 3, width: gap.to - gap.from }
                : { left: originX + indicator.at - 3, top: originY + gap.from, height: gap.to - gap.from }
            }
          >
            <div className={cn("absolute bg-fuchsia-600", horizontalGap ? "inset-x-0 top-1/2 h-px" : "inset-y-0 left-1/2 w-px")} />
          </div>
          {horizontalGap ? (
            <Label x={originX + middle} y={originY + indicator.at - 10} value={indicator.value} kind="spacing" />
          ) : (
            <Label x={originX + indicator.at + 14} y={originY + middle} value={indicator.value} kind="spacing" />
          )}
        </div>
      );
    });

  return (
    <div className="pointer-events-none" data-canvas-overlay="snap-guides">
      {vertical && (
        <div
          data-canvas-overlay="snap-guide-vertical"
          data-achieved={vertical.achieved ? "true" : "false"}
          className={cn("absolute w-px", vertical.achieved ? "bg-canvas-guide" : "border-canvas-guide border-l border-dashed")}
          style={{ left: originX + vertical.coordinate, top: originY + vertical.from, height: Math.max(0, vertical.to - vertical.from) }}
        />
      )}
      {horizontal && (
        <div
          data-canvas-overlay="snap-guide-horizontal"
          data-achieved={horizontal.achieved ? "true" : "false"}
          className={cn("absolute h-px", horizontal.achieved ? "bg-canvas-guide" : "border-canvas-guide border-t border-dashed")}
          style={{ top: originY + horizontal.coordinate, left: originX + horizontal.from, width: Math.max(0, horizontal.to - horizontal.from) }}
        />
      )}
      {guides.distances.map(distanceLabel)}
      {guides.spacing.map(spacingIndicator)}
    </div>
  );
}

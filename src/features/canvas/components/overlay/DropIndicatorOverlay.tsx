"use client";

import type { RefObject } from "react";
import { useMeasuredNodeRect } from "@/features/canvas/hooks/useMeasuredNodeRect";
import type { DropZone } from "@/features/editor/utils/resolveDropZone";

interface DropIndicatorOverlayProps {
  canvasRootRef: RefObject<HTMLElement | null>;
  targetId: string;
  zone: DropZone;
}

/**
 * Replaces Checkpoint 3.3's container-glow-only feedback with a
 * position-aware indicator: a thin line flush with the target's top or
 * bottom edge for "before"/"after", or the same dashed-outline-plus-tint
 * treatment 3.3 used for "inside" — so the indicator always shows
 * exactly where the drop would land, never just "somewhere in here."
 */
export function DropIndicatorOverlay({
  canvasRootRef,
  targetId,
  zone,
}: DropIndicatorOverlayProps) {
  const rect = useMeasuredNodeRect(canvasRootRef, targetId);
  if (!rect) return null;

  if (zone === "inside") {
    return (
      <div
        data-canvas-overlay="drop-inside"
        className="absolute rounded-xs bg-blue-50/60 outline-2 -outline-offset-2 outline-dashed outline-blue-400 dark:bg-blue-950/30"
        style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
      />
    );
  }

  const lineTop = (zone === "before" ? rect.top : rect.top + rect.height) - 1;

  return (
    <div
      data-canvas-overlay="drop-line"
      className="absolute h-0.5 rounded-full bg-blue-500"
      style={{ top: lineTop, left: rect.left, width: rect.width }}
    />
  );
}

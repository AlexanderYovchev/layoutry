"use client";

import type { RefObject } from "react";
import { useMeasuredNodeRect } from "@/features/canvas/hooks/useMeasuredNodeRect";

interface HoverOverlayProps {
  canvasRootRef: RefObject<HTMLElement | null>;
  nodeId: string;
}

/** Visually weaker than SelectionOverlay and never shown on top of it — see CanvasOverlay. */
export function HoverOverlay({ canvasRootRef, nodeId }: HoverOverlayProps) {
  const rect = useMeasuredNodeRect(canvasRootRef, nodeId);
  if (!rect) return null;

  return (
    <div
      data-canvas-overlay="hover"
      className="absolute rounded-xs outline-1 -outline-offset-1 outline-blue-300"
      style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
    />
  );
}

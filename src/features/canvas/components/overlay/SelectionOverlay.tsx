"use client";

import type { RefObject } from "react";
import { ResizeOverlay } from "@/features/canvas/components/overlay/ResizeOverlay";
import { useMeasuredNodeRect } from "@/features/canvas/hooks/useMeasuredNodeRect";
import { getElementDisplayName } from "@/features/editor/utils/elementDisplayName";
import { cn } from "@/lib/utils";
import type { EditorElementNode } from "@/features/editor/types/document";

interface SelectionOverlayProps {
  canvasRootRef: RefObject<HTMLElement | null>;
  node: EditorElementNode;
}

const LABEL_HEIGHT_PX = 24;

export function SelectionOverlay({ canvasRootRef, node }: SelectionOverlayProps) {
  const rect = useMeasuredNodeRect(canvasRootRef, node.id);
  if (!rect) return null;

  const labelFitsAbove = rect.top >= LABEL_HEIGHT_PX;

  return (
    <div
      data-canvas-overlay="selection"
      className="absolute rounded-xs outline-2 -outline-offset-1 outline-blue-500"
      style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
    >
      <span
        className={cn(
          "absolute left-0 whitespace-nowrap rounded-md bg-blue-500 px-1.5 py-0.5 text-xs font-medium text-white shadow-sm",
          labelFitsAbove ? "-top-6" : "top-0",
        )}
      >
        {getElementDisplayName(node)}
      </span>
      <ResizeOverlay node={node} rect={rect} canvasRootRef={canvasRootRef} />
    </div>
  );
}

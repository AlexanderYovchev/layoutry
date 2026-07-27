"use client";

import type { RefObject } from "react";
import { ResizeHandleDots } from "@/features/canvas/components/overlay/ResizeHandleDots";
import { useResizeSession, type ResizeHandleStart } from "@/features/canvas/hooks/useResizeSession";
import type { MeasuredNodeRect } from "@/features/canvas/hooks/useMeasuredNodeRect";

interface ResizeHandlesProps {
  nodeId: string;
  /** The node's currently measured rect (same one SelectionOverlay already positioned itself from). */
  rect: MeasuredNodeRect;
  /** The node's dimensions.offsetX/offsetY right now (0 if never west/north-resized). */
  offsetX: number;
  offsetY: number;
  canvasRootRef: RefObject<HTMLElement | null>;
}

/**
 * Eight Flow-mode resize handles for the currently selected resizable
 * element, rendered inside SelectionOverlay's already-positioned box
 * (see ResizeOverlay) so each handle only needs a position relative to
 * that box, never its own rect math. See ResizeHandleDots for the shared
 * handle presentation (also used by Free-mode's FreeChildResizeHandles,
 * Checkpoint 3.4.4) and useResizeSession for the drag/history behavior.
 */
export function ResizeHandles({ nodeId, rect, offsetX, offsetY, canvasRootRef }: ResizeHandlesProps) {
  const { activeDirection, onHandlePointerDown, onHandlePointerMove, onHandlePointerUp, onHandlePointerCancel } =
    useResizeSession(nodeId, canvasRootRef);

  const start: ResizeHandleStart = {
    startWidth: rect.width,
    startHeight: rect.height,
    startLeft: rect.left,
    startTop: rect.top,
    startOffsetX: offsetX,
    startOffsetY: offsetY,
  };

  return (
    <ResizeHandleDots
      activeDirection={activeDirection}
      onPointerDown={(direction) => onHandlePointerDown(direction, start)}
      onPointerMove={onHandlePointerMove}
      onPointerUp={onHandlePointerUp}
      onPointerCancel={onHandlePointerCancel}
    />
  );
}

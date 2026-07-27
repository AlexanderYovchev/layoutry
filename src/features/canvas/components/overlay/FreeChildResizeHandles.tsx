"use client";

import { ResizeHandleDots } from "@/features/canvas/components/overlay/ResizeHandleDots";
import {
  useFreeChildResizeSession,
  type FreeChildResizeHandleStart,
} from "@/features/canvas/hooks/useFreeChildResizeSession";
import type { FreeLayoutGeometry } from "@/features/editor/types/layout";

interface FreeChildResizeHandlesProps {
  nodeId: string;
  /** The node's current Free-layout geometry — the session's start snapshot, container-content-relative (not the canvas-root-relative rect Flow's ResizeHandles uses). */
  geometry: FreeLayoutGeometry;
}

/**
 * Eight Free-mode resize handles (Checkpoint 3.4.4) for the currently
 * selected node when its parent is a Free container — the Free-mode
 * counterpart to ResizeHandles, sharing the same handle presentation
 * (see ResizeHandleDots) but driven by useFreeChildResizeSession instead
 * of useResizeSession, since a Free child's x/y/width/height (not a
 * margin-anchored flow box) is what a west/north handle actually moves.
 */
export function FreeChildResizeHandles({ nodeId, geometry }: FreeChildResizeHandlesProps) {
  const { activeDirection, onHandlePointerDown, onHandlePointerMove, onHandlePointerUp, onHandlePointerCancel } =
    useFreeChildResizeSession(nodeId);

  const start: FreeChildResizeHandleStart = {
    startX: geometry.x,
    startY: geometry.y,
    startWidth: geometry.width,
    startHeight: geometry.height,
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

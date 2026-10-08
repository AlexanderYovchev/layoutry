"use client";

import type { RefObject } from "react";
import { ResizeHandleDots } from "@/features/canvas/components/overlay/ResizeHandleDots";
import { useResizeSession, type ResizeHandleStart } from "@/features/canvas/hooks/useResizeSession";
import { measureOffsetBoxSize } from "@/features/canvas/utils/measureOffsetBoxSize";
import type { MeasuredNodeRect } from "@/features/canvas/hooks/useMeasuredNodeRect";

interface ResizeHandlesProps {
  nodeId: string;
  /** The node's currently measured rect (same one SelectionOverlay already positioned itself from). Still used for startLeft/startTop (the clamp-bounds reference) and as a fallback for startWidth/startHeight when the live element can't be found. */
  rect: MeasuredNodeRect;
  /** The node's dimensions.offsetX/offsetY right now (0 if never west/north-resized). */
  offsetX: number;
  offsetY: number;
  /** The node's own authored Translate (Checkpoint 1.15.6.14.3) — used only to correct startLeft/startTop back to the node's untransformed flow position (see this checkpoint's own report, Part L); rotate/scale are not correctable this way and remain a documented, narrow clamp-boundary approximation. */
  translateX?: number;
  translateY?: number;
  canvasRootRef: RefObject<HTMLElement | null>;
}

/**
 * Eight Flow-mode resize handles for the currently selected resizable
 * element, rendered inside SelectionOverlay's already-positioned box
 * (see ResizeOverlay) so each handle only needs a position relative to
 * that box, never its own rect math. See ResizeHandleDots for the shared
 * handle presentation (also used by Free-mode's FreeChildResizeHandles,
 * Checkpoint 3.4.4) and useResizeSession for the drag/history behavior.
 *
 * startWidth/startHeight (Checkpoint 1.15.6.14.3) deliberately read
 * `element.offsetWidth/offsetHeight` rather than `rect.width/height` —
 * see measureOffsetBoxSize's own doc comment for why this is the approved,
 * narrow geometry fix that keeps Transform safe to render in Design
 * without corrupting stored dimensions. Falls back to `rect` only when
 * the live element can't be found (defensive; shouldn't normally happen
 * while a resize handle for it is rendered at all).
 */
export function ResizeHandles({ nodeId, rect, offsetX, offsetY, translateX, translateY, canvasRootRef }: ResizeHandlesProps) {
  const { activeDirection, onHandlePointerDown, onHandlePointerMove, onHandlePointerUp, onHandlePointerCancel } =
    useResizeSession(nodeId, canvasRootRef);

  // Deliberately NOT computed at render time (canvasRootRef.current must
  // only ever be read inside an event handler, never during render) —
  // built fresh at the moment a handle is actually grabbed, inside this
  // same onPointerDown callback ResizeHandles already passes down.
  function buildStart(): ResizeHandleStart {
    const offsetSize = measureOffsetBoxSize(canvasRootRef.current, nodeId);
    return {
      startWidth: offsetSize?.width ?? rect.width,
      startHeight: offsetSize?.height ?? rect.height,
      // Correct for the node's own authored Translate: rect.left/top
      // reflect the PAINTED (translated) position, but the resize clamp
      // needs the untransformed flow position (see computeResizeResult's
      // own bounds math). Rotate/scale have no equivalently exact
      // correction and are a documented, narrow residual approximation
      // (Checkpoint 1.15.6.14.3's own report, Part L) — the tracked
      // width/height itself stays correct regardless (see startWidth/
      // startHeight above); only the clamp boundary distance can be
      // slightly off under a self-rotate/scale.
      startLeft: rect.left - (translateX ?? 0),
      startTop: rect.top - (translateY ?? 0),
      startOffsetX: offsetX,
      startOffsetY: offsetY,
    };
  }

  return (
    <ResizeHandleDots
      activeDirection={activeDirection}
      // ResizeHandleDots calls `onPointerDown(direction)` once per handle
      // AT ITS OWN RENDER TIME to produce each dot's DOM event handler
      // (see its own `onPointerDown={onPointerDown(direction)}`) — so
      // `buildStart()` must be called inside the INNERMOST returned
      // function (only invoked when the actual pointerdown DOM event
      // fires), never as an eagerly-evaluated argument to
      // onHandlePointerDown here, or it would read canvasRootRef.current
      // during render after all, just one call-frame removed from where
      // the lint rule can see it.
      onPointerDown={(direction) => (event) => onHandlePointerDown(direction, buildStart())(event)}
      onPointerMove={onHandlePointerMove}
      onPointerUp={onHandlePointerUp}
      onPointerCancel={onHandlePointerCancel}
    />
  );
}

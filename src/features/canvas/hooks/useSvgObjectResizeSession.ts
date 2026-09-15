"use client";

import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { resolveSvgPointerPosition } from "@/features/canvas/utils/resolveSvgPointerPosition";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { normalizeDragToBounds } from "@/features/editor/utils/svgObjectGeometry";

export type SvgResizeCorner = "nw" | "ne" | "sw" | "se";

export interface UseSvgObjectResizeSessionResult {
  getHandleHandlers: (
    objectId: string,
    corner: SvgResizeCorner,
    anchor: { x: number; y: number },
  ) => {
    onPointerDown: (event: ReactPointerEvent<SVGElement>) => void;
    onPointerMove: (event: ReactPointerEvent<SVGElement>) => void;
    onPointerUp: (event: ReactPointerEvent<SVGElement>) => void;
    onPointerCancel: (event: ReactPointerEvent<SVGElement>) => void;
  };
}

/**
 * Select-tool resize for Rectangle/Ellipse (Checkpoint 1.15.6, section 29
 * of its own brief — the required v1 scope; Polygon/Path bounding-box
 * scaling is explicitly deferred, see this checkpoint's own report). The
 * `anchor` is the OPPOSITE corner from the one being dragged — held fixed
 * for the whole gesture, exactly like the outer document's own
 * useResizeSession anchors from the opposite edge — so
 * normalizeDragToBounds always has two stable, order-independent corners
 * to build a non-negative bounding box from.
 */
export function useSvgObjectResizeSession(svgNodeId: string): UseSvgObjectResizeSessionResult {
  const startRef = useRef<{ objectId: string; anchor: { x: number; y: number } } | null>(null);
  // A pointerdown+pointerup with zero pointermove in between (a plain
  // click on the handle) has nothing to commit — without this guard,
  // commitTransaction() would still unconditionally push the pre-drag
  // snapshot as a real, undoable no-op history entry, the exact
  // Checkpoint 5.7 bug class useResizeSession/useFreeChildMoveSession's
  // own identical didMoveRef guards were originally found and fixed for.
  const didMoveRef = useRef(false);

  const findSvg = useCallback((event: ReactPointerEvent<SVGElement>): SVGSVGElement | null => {
    return event.currentTarget.ownerSVGElement ?? (event.currentTarget instanceof SVGSVGElement ? event.currentTarget : null);
  }, []);

  const getHandleHandlers = useCallback(
    (objectId: string, _corner: SvgResizeCorner, anchor: { x: number; y: number }) => {
      const onPointerDown = (event: ReactPointerEvent<SVGElement>) => {
        event.stopPropagation();
        const svg = findSvg(event);
        if (!svg) return;

        event.currentTarget.setPointerCapture(event.pointerId);
        useEditorStore.getState().beginTransaction();
        didMoveRef.current = false;
        startRef.current = { objectId, anchor };
      };

      const onPointerMove = (event: ReactPointerEvent<SVGElement>) => {
        const start = startRef.current;
        const svg = findSvg(event);
        if (!start || !svg) return;
        didMoveRef.current = true;

        const point = resolveSvgPointerPosition(svg, event.clientX, event.clientY);
        const bounds = normalizeDragToBounds(start.anchor.x, start.anchor.y, point.x, point.y);
        useEditorStore.getState().resizeSvgObjectLive(svgNodeId, start.objectId, bounds);
      };

      const endSession = (event: ReactPointerEvent<SVGElement>) => {
        if (!startRef.current) return;
        event.currentTarget.releasePointerCapture(event.pointerId);
        startRef.current = null;
        const store = useEditorStore.getState();
        if (didMoveRef.current) {
          store.commitTransaction();
        } else {
          store.cancelTransaction();
        }
      };

      return { onPointerDown, onPointerMove, onPointerUp: endSession, onPointerCancel: endSession };
    },
    [findSvg, svgNodeId],
  );

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || !startRef.current) return;
      event.stopPropagation();

      const store = useEditorStore.getState();
      const snapshot = store.transactionSnapshot;
      if (snapshot) {
        useEditorStore.setState({ document: snapshot.document, selection: snapshot.selection });
      }
      store.cancelTransaction();
      startRef.current = null;
    }

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, []);

  return { getHandleHandlers };
}

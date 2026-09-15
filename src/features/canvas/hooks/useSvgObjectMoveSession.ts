"use client";

import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { resolveSvgPointerPosition } from "@/features/canvas/utils/resolveSvgPointerPosition";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";

export interface UseSvgObjectMoveSessionResult {
  /** Attach directly to a rendered vector object element (only while the Select tool is active — the caller gates on that). Applies the plain/Ctrl-toggle/Shift-add selection semantics (section 25 of this checkpoint's own brief) immediately, then begins a move drag; a genuine click with no movement in between is a pure selection change with zero document mutation (the same didMove-gated "click vs drag" distinction useFreeChildMoveSession already established). */
  getObjectHandlers: (objectId: string) => {
    onPointerDown: (event: ReactPointerEvent<SVGElement>) => void;
    onPointerMove: (event: ReactPointerEvent<SVGElement>) => void;
    onPointerUp: (event: ReactPointerEvent<SVGElement>) => void;
    onPointerCancel: (event: ReactPointerEvent<SVGElement>) => void;
  };
}

/**
 * Select-tool move (Checkpoint 1.15.6, sections 25/28 of its own brief)
 * — shares the exact pointer-capture/begin-commit-transaction/didMove-
 * gated-click/Escape-cancel shape useFreeChildMoveSession already
 * established for ordinary document nodes, applied to vector object ids
 * instead. Movement is vector CONTENT (never guarded by Parent Style
 * Protection — see translateSvgObjectsLive's own doc comment), so unlike
 * useFreeChildMoveSession's own pointerdown, there is no protection
 * pre-check here at all.
 */
export function useSvgObjectMoveSession(svgNodeId: string): UseSvgObjectMoveSessionResult {
  const startRef = useRef<{ x: number; y: number; objectIds: string[] } | null>(null);
  const didMoveRef = useRef(false);

  const findSvg = useCallback((event: ReactPointerEvent<SVGElement>): SVGSVGElement | null => {
    return event.currentTarget.ownerSVGElement ?? (event.currentTarget instanceof SVGSVGElement ? event.currentTarget : null);
  }, []);

  const getObjectHandlers = useCallback(
    (objectId: string) => {
      const onPointerDown = (event: ReactPointerEvent<SVGElement>) => {
        event.stopPropagation();
        const store = useEditorStore.getState();

        if (event.ctrlKey || event.metaKey) {
          store.toggleSvgObjectSelection(objectId);
        } else if (event.shiftKey) {
          store.addSvgObjectToSelection(objectId);
        } else if (!store.selectedSvgObjectIds.includes(objectId)) {
          store.selectSvgObjectOnly(objectId);
        }
        // A plain click on an already-selected object (part of a larger
        // selection) intentionally leaves the whole selection intact —
        // the same "don't collapse a multi-selection just because one of
        // its members was pressed again" rule the outer document's own
        // move sessions rely on for grouped drags.
        const objectIds = useEditorStore.getState().selectedSvgObjectIds;

        const svg = findSvg(event);
        if (!svg) return;
        const point = resolveSvgPointerPosition(svg, event.clientX, event.clientY);

        event.currentTarget.setPointerCapture(event.pointerId);
        store.beginTransaction();
        didMoveRef.current = false;
        startRef.current = { x: point.x, y: point.y, objectIds };
      };

      const onPointerMove = (event: ReactPointerEvent<SVGElement>) => {
        const start = startRef.current;
        const svg = findSvg(event);
        if (!start || !svg) return;
        didMoveRef.current = true;

        const point = resolveSvgPointerPosition(svg, event.clientX, event.clientY);
        const dx = point.x - start.x;
        const dy = point.y - start.y;
        if (dx === 0 && dy === 0) return;

        useEditorStore.getState().translateSvgObjectsLive(svgNodeId, start.objectIds, dx, dy);
        startRef.current = { ...start, x: point.x, y: point.y };
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

  return { getObjectHandlers };
}

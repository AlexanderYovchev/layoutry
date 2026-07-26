"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { computeResizeResult } from "@/features/canvas/utils/computeResizeResult";
import { resolveResizeBounds } from "@/features/canvas/utils/resolveResizeBounds";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import {
  DEFAULT_RESIZE_CONSTRAINTS,
  RESIZE_HANDLE_CURSORS,
  type ResizeBounds,
  type ResizeDirection,
  type ResizeSession,
} from "@/features/editor/types/resize";

/** Everything a resize session needs to know about the node at the exact moment a handle is grabbed. */
export interface ResizeHandleStart {
  startWidth: number;
  startHeight: number;
  /** The node's current rendered position relative to the canvas root (already reflects any prior offsetX/offsetY). */
  startLeft: number;
  startTop: number;
  /** The node's dimensions.offsetX/offsetY right now — a west/north drag composes on top of these. */
  startOffsetX: number;
  startOffsetY: number;
}

export interface UseResizeSessionResult {
  /** The handle currently being dragged, or null between drags — drives each handle's "active/highlighted" style. */
  activeDirection: ResizeDirection | null;
  onHandlePointerDown: (
    direction: ResizeDirection,
    start: ResizeHandleStart,
  ) => (event: ReactPointerEvent<HTMLDivElement>) => void;
  onHandlePointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onHandlePointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onHandlePointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;
}

const UNBOUNDED: ResizeBounds = {
  left: -Infinity,
  top: -Infinity,
  right: Infinity,
  bottom: Infinity,
};

/**
 * Owns one resize drag end-to-end, independent of rendering: pointer
 * capture (so the drag keeps tracking even once the cursor outruns the
 * small handle), one containing-block measurement at pointer-down (never
 * repeated mid-drag), a rAF-throttled commit loop, and writing live
 * width/height/offsetX/offsetY straight into the document store every
 * frame rather than only on pointerup. Committing continuously — not
 * keeping a separate "preview" value — is what makes the selection
 * outline, the handles themselves, and the Inspector all stay in sync for
 * free: they all read the same store, there's nothing else to reconcile,
 * and there is no separate temporary transform to clean up on release.
 *
 * Pointer Capture (not a window-level listener) is deliberate: once
 * captured in onHandlePointerDown, this element keeps receiving
 * move/up events for that pointer even outside its own bounds, which is
 * exactly what a resize handle needs and mirrors the jsdom
 * setPointerCapture polyfill already present in test/setup.ts.
 *
 * History (Checkpoint 3.4.3): begins a resize transaction at pointer-down
 * (snapshotting the pre-drag document once) and commits it at pointer-up/
 * pointer-cancel, so every live per-frame resizeElement call in between
 * contributes to a single undo step rather than one per frame. Escape
 * mid-drag cancels the transaction instead: the document is restored to
 * exactly what the transaction snapshotted, and nothing is pushed to
 * history at all — as if the drag had never happened.
 */
export function useResizeSession(
  nodeId: string,
  canvasRootRef: RefObject<HTMLElement | null>,
): UseResizeSessionResult {
  const resizeElement = useEditorStore((state) => state.resizeElement);
  const [activeDirection, setActiveDirection] = useState<ResizeDirection | null>(null);
  const sessionRef = useRef<ResizeSession | null>(null);
  const latestPointerRef = useRef({ x: 0, y: 0 });
  const frameRef = useRef<number | null>(null);

  const commit = useCallback(() => {
    frameRef.current = null;
    const session = sessionRef.current;
    if (!session) return;
    const result = computeResizeResult(
      session,
      latestPointerRef.current.x,
      latestPointerRef.current.y,
      DEFAULT_RESIZE_CONSTRAINTS,
    );
    resizeElement(session.nodeId, result);
  }, [resizeElement]);

  const scheduleCommit = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(commit);
  }, [commit]);

  const onHandlePointerDown = useCallback(
    (direction: ResizeDirection, start: ResizeHandleStart) =>
      (event: ReactPointerEvent<HTMLDivElement>) => {
        event.stopPropagation();
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        useEditorStore.getState().beginResizeTransaction();

        const canvasRoot = canvasRootRef.current;
        const targetEl = canvasRoot?.querySelector<HTMLElement>(
          `[data-node-id="${CSS.escape(nodeId)}"]`,
        );
        const bounds =
          canvasRoot && targetEl ? resolveResizeBounds(canvasRoot, targetEl) : UNBOUNDED;

        sessionRef.current = {
          nodeId,
          direction,
          startWidth: start.startWidth,
          startHeight: start.startHeight,
          startLeft: start.startLeft,
          startTop: start.startTop,
          startOffsetX: start.startOffsetX,
          startOffsetY: start.startOffsetY,
          startPointerX: event.clientX,
          startPointerY: event.clientY,
          bounds,
        };
        latestPointerRef.current = { x: event.clientX, y: event.clientY };
        setActiveDirection(direction);

        document.body.style.cursor = RESIZE_HANDLE_CURSORS[direction];
        document.body.style.userSelect = "none";
      },
    [nodeId, canvasRootRef],
  );

  const onHandlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!sessionRef.current) return;
      latestPointerRef.current = { x: event.clientX, y: event.clientY };
      scheduleCommit();
    },
    [scheduleCommit],
  );

  const endSession = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!sessionRef.current) return;

      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      // Always commit the final pointer position on release, even if it
      // arrived in the same tick as a still-pending frame — otherwise the
      // last few pixels of a fast drag could be dropped.
      commit();
      useEditorStore.getState().commitResizeTransaction();

      event.currentTarget.releasePointerCapture(event.pointerId);
      sessionRef.current = null;
      setActiveDirection(null);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    },
    [commit],
  );

  // Escape cancels an in-progress resize (rather than clearing selection,
  // which is CanvasInteractionBoundary's own Escape behavior for when no
  // drag is active) — reverts the document to exactly what it was at
  // pointer-down and discards the transaction, so nothing is recorded to
  // history at all.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || !sessionRef.current) return;
      event.stopPropagation();

      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }

      const store = useEditorStore.getState();
      const snapshot = store.transactionSnapshot;
      if (snapshot) {
        useEditorStore.setState({
          document: snapshot.document,
          selectedElementId: snapshot.selectedElementId,
        });
      }
      store.cancelResizeTransaction();

      sessionRef.current = null;
      setActiveDirection(null);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, []);

  return {
    activeDirection,
    onHandlePointerDown,
    onHandlePointerMove,
    onHandlePointerUp: endSession,
    onHandlePointerCancel: endSession,
  };
}

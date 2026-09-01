"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { computeContainerChildScaling, deriveFlooredContainerOuterSize } from "@/features/canvas/utils/computeContainerChildScaling";
import { computeResizeResult } from "@/features/canvas/utils/computeResizeResult";
import { resolveContainerScalingSnapshot, type ContainerScalingSnapshot } from "@/features/canvas/utils/resolveContainerScalingSnapshot";
import { resolveResizeBounds } from "@/features/canvas/utils/resolveResizeBounds";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { getResizeConstraintsForTag, type ElementResizeConstraints } from "@/features/editor/types/layout";
import {
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
  const applyFreeContainerChildGeometriesLive = useEditorStore(
    (state) => state.applyFreeContainerChildGeometriesLive,
  );
  const [activeDirection, setActiveDirection] = useState<ResizeDirection | null>(null);
  const sessionRef = useRef<ResizeSession | null>(null);
  const constraintsRef = useRef<ElementResizeConstraints>(getResizeConstraintsForTag());
  const containerScalingRef = useRef<ContainerScalingSnapshot | null>(null);
  const latestPointerRef = useRef({ x: 0, y: 0 });
  const frameRef = useRef<number | null>(null);
  // Checkpoint 5.7 bug fix (found via this checkpoint's own real-browser
  // undo/redo verification — a plain click, no drag, on a resize handle
  // was materializing explicit dimensions from whatever the node's
  // current rendered size happened to be, AND pushing a real, undoable
  // history entry, purely from a pointerdown+pointerup with zero
  // pointermove events in between). See endSession's own comment for the
  // fix.
  const didMoveRef = useRef(false);

  const commit = useCallback(() => {
    frameRef.current = null;
    const session = sessionRef.current;
    if (!session) return;
    const result = computeResizeResult(
      session,
      latestPointerRef.current.x,
      latestPointerRef.current.y,
      constraintsRef.current,
    );

    // Checkpoint 3.4.4: this node is itself a Free container with
    // children (see resolveContainerScalingSnapshot) — its own resize
    // must also proportionally scale/clamp them, atomically, in the
    // same store write (see applyFreeContainerChildGeometries). The
    // plain leaf/non-Free-container path below is completely unchanged.
    const containerScaling = containerScalingRef.current;
    if (containerScaling) {
      const flooredSize = deriveFlooredContainerOuterSize(
        result.preferredWidth,
        result.preferredHeight,
        containerScaling.startContentBounds,
        containerScaling.outerToContentInset,
      );
      const newContentBounds = {
        width: flooredSize.width - containerScaling.outerToContentInset.width,
        height: flooredSize.height - containerScaling.outerToContentInset.height,
      };
      const childGeometries = computeContainerChildScaling(
        containerScaling.children,
        containerScaling.startContentBounds,
        newContentBounds,
        containerScaling.policy,
      );
      applyFreeContainerChildGeometriesLive(
        containerScaling.containerId,
        { dimensions: { ...result, preferredWidth: flooredSize.width, preferredHeight: flooredSize.height } },
        childGeometries,
      );
      return;
    }

    resizeElement(session.nodeId, result);
  }, [resizeElement, applyFreeContainerChildGeometriesLive]);

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
        didMoveRef.current = false;

        const canvasRoot = canvasRootRef.current;
        const targetEl = canvasRoot?.querySelector<HTMLElement>(
          `[data-node-id="${CSS.escape(nodeId)}"]`,
        );
        constraintsRef.current = getResizeConstraintsForTag();
        const bounds =
          canvasRoot && targetEl ? resolveResizeBounds(canvasRoot, targetEl) : UNBOUNDED;
        containerScalingRef.current = resolveContainerScalingSnapshot(
          targetEl ?? null,
          start.startWidth,
          start.startHeight,
        );

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
      didMoveRef.current = true;
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
      // A plain click (pointerdown immediately followed by pointerup, no
      // pointermove in between) has nothing to commit (Checkpoint 5.7 fix
      // — see didMoveRef's own doc comment). Cancelling (not committing)
      // the transaction here means no history entry is pushed and no
      // dimensions are silently materialized from whatever the node
      // currently happens to render at. Always commit the final pointer
      // position on a *genuine* release, even if it arrived in the same
      // tick as a still-pending frame — otherwise the last few pixels of
      // a fast drag could be dropped.
      if (didMoveRef.current) {
        commit();
        useEditorStore.getState().commitResizeTransaction();
      } else {
        useEditorStore.getState().cancelResizeTransaction();
      }

      event.currentTarget.releasePointerCapture(event.pointerId);
      sessionRef.current = null;
      containerScalingRef.current = null;
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
          selection: snapshot.selection,
        });
      }
      store.cancelResizeTransaction();

      sessionRef.current = null;
      containerScalingRef.current = null;
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

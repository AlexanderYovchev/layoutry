"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { computeContainerChildScaling, deriveFlooredContainerOuterSize } from "@/features/canvas/utils/computeContainerChildScaling";
import {
  computeFreeChildResizeResult,
  type FreeChildResizeSession,
} from "@/features/canvas/utils/computeFreeChildResizeResult";
import { measureFreeContainerBounds } from "@/features/canvas/utils/measureFreeContainerBounds";
import { resolveContainerScalingSnapshot, type ContainerScalingSnapshot } from "@/features/canvas/utils/resolveContainerScalingSnapshot";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { getEffectiveAspectRatioLocked } from "@/features/editor/rules/elementCapabilities";
import { findNodeById } from "@/features/editor/utils/findNodeById";
import { getResizeConstraintsForTag, type ElementResizeConstraints } from "@/features/editor/types/layout";
import { RESIZE_HANDLE_CURSORS, type ResizeDirection } from "@/features/editor/types/resize";

export interface FreeChildResizeHandleStart {
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
}

export interface UseFreeChildResizeSessionResult {
  activeDirection: ResizeDirection | null;
  onHandlePointerDown: (
    direction: ResizeDirection,
    start: FreeChildResizeHandleStart,
  ) => (event: ReactPointerEvent<HTMLDivElement>) => void;
  onHandlePointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onHandlePointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onHandlePointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;
}

const UNBOUNDED = { width: Infinity, height: Infinity };

/**
 * Resize handles for a Free container's direct child (Checkpoint 3.4.4)
 * — the Free-mode counterpart to useResizeSession, sharing its exact
 * pointer-capture/rAF-throttled-commit/begin-commit-transaction/Escape-
 * cancel shape (see useFreeChildMoveSession for the same reasoning on
 * why this is a sibling hook rather than a change to useResizeSession
 * itself). Committed continuously (every frame), same reasoning as the
 * Flow resize session: the canvas, its selection overlay, and the
 * Inspector's X/Y/Width/Height fields all stay in sync for free.
 *
 * aspectRatioLocked is resolved once per drag from the node's own
 * override or its tag's supportsIntrinsicAspectRatio default (see
 * computeFreeChildResizeResult) — read from the DOM's data-node-type
 * attribute plus a live document lookup for the override. The resize
 * floor itself (getResizeConstraintsForTag) is no longer tag-dependent
 * (Checkpoint 1.12.1) — every tag shares the same small, generic minimum.
 */
export function useFreeChildResizeSession(nodeId: string): UseFreeChildResizeSessionResult {
  const setFreeChildGeometryLive = useEditorStore((state) => state.setFreeChildGeometryLive);
  const applyFreeContainerChildGeometriesLive = useEditorStore(
    (state) => state.applyFreeContainerChildGeometriesLive,
  );
  const [activeDirection, setActiveDirection] = useState<ResizeDirection | null>(null);
  const sessionRef = useRef<FreeChildResizeSession | null>(null);
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
    const result = computeFreeChildResizeResult(
      session,
      latestPointerRef.current.x,
      latestPointerRef.current.y,
      constraintsRef.current,
    );

    // Checkpoint 3.4.4: this Free child is itself a Free container with
    // children (see resolveContainerScalingSnapshot) — mirrors
    // useResizeSession's identical branch, just writing freeLayout
    // instead of dimensions for the container's own self-update.
    const containerScaling = containerScalingRef.current;
    if (containerScaling) {
      const flooredSize = deriveFlooredContainerOuterSize(
        result.width,
        result.height,
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
        { freeLayout: { ...result, width: flooredSize.width, height: flooredSize.height } },
        childGeometries,
      );
      return;
    }

    setFreeChildGeometryLive(nodeId, result);
  }, [nodeId, setFreeChildGeometryLive, applyFreeContainerChildGeometriesLive]);

  const scheduleCommit = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(commit);
  }, [commit]);

  const onHandlePointerDown = useCallback(
    (direction: ResizeDirection, start: FreeChildResizeHandleStart) =>
      (event: ReactPointerEvent<HTMLDivElement>) => {
        event.stopPropagation();
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        useEditorStore.getState().beginResizeTransaction();
        didMoveRef.current = false;

        const targetEl = window.document.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(nodeId)}"]`);
        const tag = targetEl?.getAttribute("data-node-type") ?? "";
        constraintsRef.current = getResizeConstraintsForTag();

        const containerEl = targetEl?.parentElement?.closest<HTMLElement>("[data-node-id]") ?? null;
        const parentBounds = containerEl ? measureFreeContainerBounds(containerEl) : UNBOUNDED;
        containerScalingRef.current = resolveContainerScalingSnapshot(
          targetEl ?? null,
          start.startWidth,
          start.startHeight,
        );

        const aspectRatioLocked = resolveAspectRatioLocked(nodeId, tag);

        sessionRef.current = {
          direction,
          startX: start.startX,
          startY: start.startY,
          startWidth: start.startWidth,
          startHeight: start.startHeight,
          startPointerX: event.clientX,
          startPointerY: event.clientY,
          parentBounds,
          aspectRatioLocked,
        };
        latestPointerRef.current = { x: event.clientX, y: event.clientY };
        setActiveDirection(direction);

        document.body.style.cursor = RESIZE_HANDLE_CURSORS[direction];
        document.body.style.userSelect = "none";
      },
    [nodeId],
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
      // pointermove in between) has nothing to commit — see didMoveRef's
      // own doc comment. Cancelling (not committing) the transaction here
      // means no history entry is pushed and no dimensions are silently
      // materialized from whatever the node currently happens to render
      // at.
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
        useEditorStore.setState({ document: snapshot.document, selection: snapshot.selection });
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

/** Looks up the live node by id, then delegates to the shared effective-value resolution (see getEffectiveAspectRatioLocked's own doc comment — Checkpoint 5.7 extracted that pure logic so the Inspector's Resize Proportions control resolves the identical effective state). */
function resolveAspectRatioLocked(nodeId: string, tag: string): boolean {
  const node = findNodeById(useEditorStore.getState().document, nodeId);
  return getEffectiveAspectRatioLocked({ aspectRatioLocked: node?.aspectRatioLocked, tag });
}

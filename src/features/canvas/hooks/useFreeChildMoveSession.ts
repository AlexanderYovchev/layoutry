"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { computeFreeChildMoveResult, type FreeChildMoveStart } from "@/features/canvas/utils/computeFreeChildMoveResult";
import { measureFreeContainerBounds } from "@/features/canvas/utils/measureFreeContainerBounds";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { describeStyleLockNotice, getStyleProtection } from "@/features/editor/rules/styleProtection";

export interface UseFreeChildMoveSessionResult {
  isDragging: boolean;
  // Element, not HTMLElement — matches NodeDragSource.listeners' generic
  // (defaults to Element) so useNodeDragSource can return these handlers
  // directly without a type mismatch.
  onPointerDown: (event: ReactPointerEvent<Element>) => void;
  onPointerMove: (event: ReactPointerEvent<Element>) => void;
  onPointerUp: (event: ReactPointerEvent<Element>) => void;
  onPointerCancel: (event: ReactPointerEvent<Element>) => void;
}

/**
 * Drag-to-reposition for a Free container's direct child (Checkpoint
 * 3.4.4) — the Free-mode counterpart to useResizeSession, sharing the
 * exact same pointer-capture/rAF-throttled-commit/begin-commit-
 * transaction/Escape-cancel shape (kept as its own hook rather than
 * folded into useResizeSession, which stays untouched for Flow's
 * offsetX/Y margin-based resize; see the checkpoint plan's "existing
 * tested code is extended, not replaced" decision).
 *
 * Unlike a Flow reorder-drag (dnd-kit's useNodeDragSource path), this
 * never changes the document tree — it only ever writes this one node's
 * freeLayout, committed continuously (every frame, not just on release)
 * so the canvas, its own selection overlay, and the Inspector's X/Y
 * fields all stay in sync for free, exactly like a resize drag already
 * does.
 *
 * Needs no canvasRootRef, unlike useResizeSession: every value computed
 * here (startX/Y, parentBounds) is relative to the node's own immediate
 * parent, not to the canvas root, so a single global data-node-id lookup
 * (there is exactly one Canvas per app instance — see useRenderedNodeSize
 * for the same reasoning) is all pointer-down needs.
 */
export function useFreeChildMoveSession(nodeId: string): UseFreeChildMoveSessionResult {
  const setFreeChildGeometryLive = useEditorStore((state) => state.setFreeChildGeometryLive);
  const [isDragging, setIsDragging] = useState(false);
  const startRef = useRef<FreeChildMoveStart | null>(null);
  const latestPointerRef = useRef({ x: 0, y: 0 });
  const frameRef = useRef<number | null>(null);
  // Checkpoint 5.7 bug fix (found via that checkpoint's own real-browser
  // undo/redo verification — a plain click, no drag, on a Free child
  // (e.g. simply to select it) was pushing a real, undoable history
  // entry purely from a pointerdown+pointerup with zero pointermove
  // events in between, exactly the same class of bug found and fixed in
  // useResizeSession/useFreeChildResizeSession's own endSession — see
  // their identical comments). See endSession's own comment for the fix.
  const didMoveRef = useRef(false);

  const commit = useCallback(() => {
    frameRef.current = null;
    const start = startRef.current;
    if (!start) return;
    const result = computeFreeChildMoveResult(start, latestPointerRef.current.x, latestPointerRef.current.y);
    setFreeChildGeometryLive(nodeId, result);
  }, [nodeId, setFreeChildGeometryLive]);

  const scheduleCommit = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(commit);
  }, [commit]);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<Element>) => {
      // Checkpoint 1.15.3, section 30 — Free-layout movement authors CSS
      // position, so it's blocked for a protected node the same way
      // resize is (section 28/29). Deliberately returns BEFORE
      // stopPropagation/pointer capture: the plain click this same
      // pointerdown/pointerup pair still produces (for selection, via
      // CanvasInteractionBoundary's own listener) must keep working
      // exactly as it does for any other node — only the drag mechanics
      // are skipped here.
      const store = useEditorStore.getState();
      const protection = getStyleProtection(store.document, nodeId);
      if (protection.protected) {
        store.showEditorNotice(describeStyleLockNotice([protection], false));
        return;
      }

      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      useEditorStore.getState().beginResizeTransaction();
      didMoveRef.current = false;

      const targetEl = window.document.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(nodeId)}"]`);
      const containerEl = targetEl?.parentElement?.closest<HTMLElement>("[data-node-id]") ?? null;
      const parentBounds = containerEl ? measureFreeContainerBounds(containerEl) : { width: Infinity, height: Infinity };

      const rect = targetEl?.getBoundingClientRect();
      const containerRect = containerEl?.getBoundingClientRect();
      const startX = rect && containerRect ? rect.left - containerRect.left : 0;
      const startY = rect && containerRect ? rect.top - containerRect.top : 0;

      startRef.current = {
        startX,
        startY,
        width: rect?.width ?? 0,
        height: rect?.height ?? 0,
        startPointerX: event.clientX,
        startPointerY: event.clientY,
        parentBounds,
      };
      latestPointerRef.current = { x: event.clientX, y: event.clientY };
      setIsDragging(true);
    },
    [nodeId],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<Element>) => {
      if (!startRef.current) return;
      didMoveRef.current = true;
      latestPointerRef.current = { x: event.clientX, y: event.clientY };
      scheduleCommit();
    },
    [scheduleCommit],
  );

  const endSession = useCallback(
    (event: ReactPointerEvent<Element>) => {
      if (!startRef.current) return;

      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      // A plain click (pointerdown immediately followed by pointerup, no
      // pointermove in between — e.g. simply selecting the node) has
      // nothing to commit (Checkpoint 5.7 fix — see didMoveRef's own doc
      // comment). Cancelling (not committing) the transaction here means
      // no history entry is pushed for a click that was never actually a
      // move.
      if (didMoveRef.current) {
        commit();
        useEditorStore.getState().commitResizeTransaction();
      } else {
        useEditorStore.getState().cancelResizeTransaction();
      }

      event.currentTarget.releasePointerCapture(event.pointerId);
      startRef.current = null;
      setIsDragging(false);
    },
    [commit],
  );

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || !startRef.current) return;
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

      startRef.current = null;
      setIsDragging(false);
    }

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, []);

  return {
    isDragging,
    onPointerDown,
    onPointerMove,
    onPointerUp: endSession,
    onPointerCancel: endSession,
  };
}

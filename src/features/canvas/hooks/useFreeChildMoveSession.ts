"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useSnapGuidePublisher } from "@/features/canvas/hooks/useSnapGuidePublisher";
import { buildFreeSnapGuides } from "@/features/canvas/utils/buildFreeSnapGuides";
import { createFreeSnapContext, type FreeSnapContext } from "@/features/canvas/utils/createFreeSnapContext";
import {
  clampFreeChildAxis,
  computeRawFreeChildMovePosition,
  type FreeChildMoveStart,
} from "@/features/canvas/utils/computeFreeChildMoveResult";
import { measureFreeContainerFrame, type Rect } from "@/features/canvas/utils/freeLayoutFrame";
import {
  ALL_EDGES,
  NO_SNAP_LOCK,
  resolveSnap,
  SNAP_EPSILON,
  translateBox,
  type SnapAdjust,
  type SnapLock,
  type SnapResult,
  type SnapSourceEdges,
} from "@/features/canvas/utils/snapEngine";
import { computeEqualSpacingCandidates } from "@/features/canvas/utils/snapEqualSpacing";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { describeStyleLockNotice, getStyleProtection } from "@/features/editor/rules/styleProtection";
import { TRANSFORM_ANCESTOR_BLOCKED_NOTICE, getTransformBlockingAncestor } from "@/features/editor/rules/transformGeometrySafety";
import { findNodeById } from "@/features/editor/utils/findNodeById";

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

/** Below this pointer displacement (px) Shift has no dominant axis yet. */
const SHIFT_DEAD_ZONE_PX = 2;

/**
 * Drag-to-reposition for a Free container's direct child (Checkpoint
 * 3.4.4): pointer capture, a rAF-throttled live commit of this one node's
 * freeLayout, begin/commit transaction (one Undo step), Escape restores.
 * It never changes the document tree.
 *
 * BC-13.3 — snapping runs through the shared engine (snapEngine):
 * - targets: the parent's padding box and every visible element inside the
 *   container (collectFreeSnapTargets), measured once at pointer-down;
 * - the 6 screen-px threshold, independent axes, locks with hysteresis,
 *   deterministic ties, deduplicated lines, equal spacing among direct
 *   siblings;
 * - a candidate the containment rule would move is rejected (no false
 *   guide);
 * - Alt/Option held: nothing is applied, but alignment is still detected and
 *   shown as a nearby guide (D4/D22), the same as with Snap turned off;
 * - Shift held: movement is constrained to the dominant axis (from the total
 *   drag displacement); the other axis stays where it was when Shift was
 *   pressed (no jump), and only the free axis snaps (D42);
 * - guide state is written to the store only when it changes.
 * The order per frame is: proposed geometry → Shift constraint → snapping →
 * containment clamp → live write.
 */
export function useFreeChildMoveSession(nodeId: string): UseFreeChildMoveSessionResult {
  const setFreeChildGeometryLive = useEditorStore((state) => state.setFreeChildGeometryLive);
  const setActiveSnapGuides = useEditorStore((state) => state.setActiveSnapGuides);
  const [isDragging, setIsDragging] = useState(false);
  const startRef = useRef<FreeChildMoveStart | null>(null);
  const snapRef = useRef<FreeSnapContext | null>(null);
  const latestPointerRef = useRef({ x: 0, y: 0 });
  const modifiersRef = useRef({ alt: false, shift: false });
  const lockRef = useRef<SnapLock>(NO_SNAP_LOCK);
  const shiftAnchorRef = useRef<{ x: number; y: number } | null>(null);
  const shiftUsedRef = useRef(false);
  const lastPositionRef = useRef<{ x: number; y: number } | null>(null);
  const frameRef = useRef<number | null>(null);
  // Checkpoint 5.7: a plain click (pointerdown + pointerup with no move) must
  // not push a history entry — see endSession.
  const didMoveRef = useRef(false);

  const { publish: publishGuides, reset: resetGuides } = useSnapGuidePublisher();

  const resetSessionState = useCallback(() => {
    startRef.current = null;
    snapRef.current = null;
    lockRef.current = NO_SNAP_LOCK;
    shiftAnchorRef.current = null;
    lastPositionRef.current = null;
    resetGuides();
  }, [resetGuides]);

  const commit = useCallback(() => {
    frameRef.current = null;
    const start = startRef.current;
    if (!start) return;
    const pointer = latestPointerRef.current;
    const modifiers = modifiersRef.current;
    let raw = computeRawFreeChildMovePosition(start, pointer.x, pointer.y);

    // Shift: lock the non-dominant axis at its position when Shift went down.
    let edges: SnapSourceEdges = ALL_EDGES;
    if (modifiers.shift) {
      shiftUsedRef.current = true;
      shiftAnchorRef.current ??= lastPositionRef.current ?? { x: start.startX, y: start.startY };
      const dx = Math.abs(pointer.x - start.startPointerX);
      const dy = Math.abs(pointer.y - start.startPointerY);
      if (Math.max(dx, dy) >= SHIFT_DEAD_ZONE_PX) {
        if (dx >= dy) {
          raw = { x: raw.x, y: shiftAnchorRef.current.y };
          edges = { x: ALL_EDGES.x, y: [] };
        } else {
          raw = { x: shiftAnchorRef.current.x, y: raw.y };
          edges = { x: [], y: ALL_EDGES.y };
        }
      }
    } else {
      shiftAnchorRef.current = null;
    }

    const maxX = Math.max(0, start.parentBounds.width - start.width);
    const maxY = Math.max(0, start.parentBounds.height - start.height);
    let x = raw.x;
    let y = raw.y;
    let result: SnapResult | null = null;
    const context = snapRef.current;

    if (context) {
      const { offset } = context;
      const visual: Rect = { x: raw.x + offset.x, y: raw.y + offset.y, width: start.width + offset.width, height: start.height + offset.height };
      // A candidate is valid only if the stored position it implies stays
      // inside the (unchanged) containment rule on that axis.
      const adjust: SnapAdjust = (box, axis, edge, delta) => {
        const next = translateBox(box, axis, edge, delta);
        if (!next) return null;
        const stored = axis === "x" ? next.x - offset.x : next.y - offset.y;
        const max = axis === "x" ? maxX : maxY;
        return stored < -SNAP_EPSILON || stored > max + SNAP_EPSILON ? null : next;
      };
      const spacing = [
        ...(edges.x.length > 0 ? computeEqualSpacingCandidates("x", visual, context.siblingTargets) : []),
        ...(edges.y.length > 0 ? computeEqualSpacingCandidates("y", visual, context.siblingTargets) : []),
      ];
      result = resolveSnap({
        box: visual,
        edges,
        index: context.index,
        spacing,
        enabled: useEditorStore.getState().snapEnabled && !modifiers.alt,
        lock: lockRef.current,
        adjust,
      });
      lockRef.current = result.lock;
      x = result.box.x - offset.x;
      y = result.box.y - offset.y;
    }

    const clampedX = clampFreeChildAxis(x, 0, maxX);
    const clampedY = clampFreeChildAxis(y, 0, maxY);
    lastPositionRef.current = { x: clampedX, y: clampedY };

    if (context && result) {
      const finalVisual: Rect = {
        x: clampedX + context.offset.x,
        y: clampedY + context.offset.y,
        width: start.width + context.offset.width,
        height: start.height + context.offset.height,
      };
      publishGuides(buildFreeSnapGuides(context.containerId, result, finalVisual, context.rectById, context.parentRect));
    } else {
      publishGuides(null);
    }
    setFreeChildGeometryLive(nodeId, { x: clampedX, y: clampedY, width: start.width, height: start.height });
  }, [nodeId, publishGuides, setFreeChildGeometryLive]);

  const scheduleCommit = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(commit);
  }, [commit]);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<Element>) => {
      // Checkpoint 1.15.3, section 30 — blocked for a protected node.
      // Returns BEFORE stopPropagation/pointer capture so the plain click
      // (selection) still works.
      const store = useEditorStore.getState();
      const protection = getStyleProtection(store.document, nodeId);
      if (protection.protected) {
        store.showEditorNotice(describeStyleLockNotice([protection], false));
        return;
      }
      // Checkpoint 1.15.6.14.3 — blocked under a transformed ancestor (see
      // transformGeometrySafety); also before capture, so a click selects.
      if (getTransformBlockingAncestor(store.document, nodeId)) {
        store.showEditorNotice(TRANSFORM_ANCESTOR_BLOCKED_NOTICE);
        return;
      }

      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      useEditorStore.getState().beginResizeTransaction();
      didMoveRef.current = false;
      shiftUsedRef.current = false;
      modifiersRef.current = { alt: event.altKey, shift: event.shiftKey };

      const targetEl = window.document.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(nodeId)}"]`);
      const containerEl = targetEl?.parentElement?.closest<HTMLElement>("[data-node-id]") ?? null;
      const containerId = containerEl?.getAttribute("data-node-id") ?? null;
      // BC-13.2 frame: containment (unchanged content-box rule) and the
      // snapping boundaries (padding box) from one measurement.
      const frame = containerEl ? measureFreeContainerFrame(containerEl) : null;
      const parentBounds = frame ? frame.containment : { width: Infinity, height: Infinity };

      // Checkpoint 1.15.6.14.3: the start position and size come from the
      // document (node.freeLayout), immune to transforms anywhere above.
      const movingNode = findNodeById(store.document, nodeId);
      const startX = movingNode?.freeLayout?.x ?? 0;
      const startY = movingNode?.freeLayout?.y ?? 0;
      const width = movingNode?.freeLayout?.width ?? 0;
      const height = movingNode?.freeLayout?.height ?? 0;

      snapRef.current = null;
      if (frame && containerEl && containerId && targetEl && movingNode?.freeLayout) {
        snapRef.current = createFreeSnapContext(containerEl, frame, store.document, containerId, { ...movingNode, freeLayout: movingNode.freeLayout }, targetEl);
      }

      startRef.current = {
        startX,
        startY,
        width,
        height,
        startPointerX: event.clientX,
        startPointerY: event.clientY,
        parentBounds,
        containerId,
      };
      latestPointerRef.current = { x: event.clientX, y: event.clientY };
      lockRef.current = NO_SNAP_LOCK;
      shiftAnchorRef.current = null;
      lastPositionRef.current = { x: startX, y: startY };
      resetGuides();
      setIsDragging(true);
    },
    [nodeId, resetGuides],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<Element>) => {
      if (!startRef.current) return;
      didMoveRef.current = true;
      latestPointerRef.current = { x: event.clientX, y: event.clientY };
      modifiersRef.current = { alt: event.altKey, shift: event.shiftKey };
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
      // A plain click (no pointermove) commits nothing (Checkpoint 5.7).
      if (didMoveRef.current) {
        commit();
        useEditorStore.getState().commitResizeTransaction();
      } else {
        useEditorStore.getState().cancelResizeTransaction();
      }
      // BC-13.3: after a Shift-constrained drag, the click that follows the
      // release would otherwise ADD the element to the selection
      // (CanvasInteractionBoundary's Shift+click). The drag selects the
      // element the way a plain drag's click does, and that one click is
      // consumed.
      if (didMoveRef.current && shiftUsedRef.current) {
        const swallow = (click: MouseEvent) => click.stopPropagation();
        window.addEventListener("click", swallow, { capture: true, once: true });
        window.setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
        useEditorStore.getState().selectOnly(nodeId);
      }
      setActiveSnapGuides(null);

      event.currentTarget.releasePointerCapture(event.pointerId);
      resetSessionState();
      setIsDragging(false);
    },
    [commit, nodeId, resetSessionState, setActiveSnapGuides],
  );

  // Alt/Shift pressed or released without moving the pointer still update
  // the frame. Alt's default is prevented while dragging (Firefox would
  // otherwise toggle its menu bar on release).
  useEffect(() => {
    if (!isDragging) return;
    function handleModifier(event: KeyboardEvent) {
      if (event.key !== "Alt" && event.key !== "Shift") return;
      if (event.key === "Alt") event.preventDefault();
      modifiersRef.current = { alt: event.altKey, shift: event.shiftKey };
      scheduleCommit();
    }
    window.addEventListener("keydown", handleModifier, true);
    window.addEventListener("keyup", handleModifier, true);
    return () => {
      window.removeEventListener("keydown", handleModifier, true);
      window.removeEventListener("keyup", handleModifier, true);
    };
  }, [isDragging, scheduleCommit]);

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
      store.setActiveSnapGuides(null);

      resetSessionState();
      setIsDragging(false);
    }

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [resetSessionState]);

  return {
    isDragging,
    onPointerDown,
    onPointerMove,
    onPointerUp: endSession,
    onPointerCancel: endSession,
  };
}

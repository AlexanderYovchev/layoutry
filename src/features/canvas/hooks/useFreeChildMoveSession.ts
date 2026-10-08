"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  clampFreeChildAxis,
  computeRawFreeChildMovePosition,
  type FreeChildMoveStart,
} from "@/features/canvas/utils/computeFreeChildMoveResult";
import { measureFreeContainerBounds } from "@/features/canvas/utils/measureFreeContainerBounds";
import { resolveFreeMoveSnap, SNAP_THRESHOLD_PX, type FreeMoveSnapBox } from "@/features/canvas/utils/resolveFreeMoveSnap";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { describeStyleLockNotice, getStyleProtection } from "@/features/editor/rules/styleProtection";
import { TRANSFORM_ANCESTOR_BLOCKED_NOTICE, getTransformBlockingAncestor } from "@/features/editor/rules/transformGeometrySafety";
import { findNodeById } from "@/features/editor/utils/findNodeById";
import type { ActiveSnapGuides } from "@/features/editor/types/snap";

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
  const setActiveSnapGuides = useEditorStore((state) => state.setActiveSnapGuides);
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

  // Checkpoint 1.15.6.1.1 — Snap inserts itself between the raw pointer-
  // delta position and the existing parent-containment clamp (section 21:
  // "proposed geometry -> snapping -> containment/clamp"), so a snap to
  // the parent's right/bottom edge still gets the exact same final
  // containment guarantee applied afterward, and Snap-off behaves
  // byte-for-byte like this hook did before Snap existed.
  const commit = useCallback(() => {
    frameRef.current = null;
    const start = startRef.current;
    if (!start) return;

    const raw = computeRawFreeChildMovePosition(start, latestPointerRef.current.x, latestPointerRef.current.y);
    let x = raw.x;
    let y = raw.y;
    let guides: ActiveSnapGuides | null = null;

    if (useEditorStore.getState().snapEnabled && start.containerId) {
      const snap = resolveFreeMoveSnap(
        { x: raw.x, y: raw.y, width: start.width, height: start.height },
        start.parentBounds,
        start.siblings ?? [],
        SNAP_THRESHOLD_PX,
      );
      x = snap.x;
      y = snap.y;
      if (snap.verticalGuide !== undefined || snap.horizontalGuide !== undefined) {
        guides = { containerId: start.containerId, vertical: snap.verticalGuide, horizontal: snap.horizontalGuide };
      }
    }

    const clampedX = clampFreeChildAxis(x, 0, Math.max(0, start.parentBounds.width - start.width));
    const clampedY = clampFreeChildAxis(y, 0, Math.max(0, start.parentBounds.height - start.height));

    setActiveSnapGuides(guides);
    setFreeChildGeometryLive(nodeId, { x: clampedX, y: clampedY, width: start.width, height: start.height });
  }, [nodeId, setFreeChildGeometryLive, setActiveSnapGuides]);

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

      // Checkpoint 1.15.6.14.3 geometry-safety restriction — see
      // useResizeSession's identical check (transformGeometrySafety.ts)
      // for the full reasoning. Deliberately also returns BEFORE
      // stopPropagation/pointer capture, same as the protection check
      // above, so a plain click (selection) on a blocked descendant still
      // works exactly as it would on any other node.
      if (getTransformBlockingAncestor(store.document, nodeId)) {
        store.showEditorNotice(TRANSFORM_ANCESTOR_BLOCKED_NOTICE);
        return;
      }

      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      useEditorStore.getState().beginResizeTransaction();
      didMoveRef.current = false;

      const targetEl = window.document.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(nodeId)}"]`);
      const containerEl = targetEl?.parentElement?.closest<HTMLElement>("[data-node-id]") ?? null;
      const parentBounds = containerEl ? measureFreeContainerBounds(containerEl) : { width: Infinity, height: Infinity };
      const containerId = containerEl?.getAttribute("data-node-id") ?? null;

      // Checkpoint 1.15.6.14.3 geometry fix (approved by the 1.15.6.14.2.1
      // feasibility audit, Part M/U) — the drag-start structural position
      // AND size now read directly from the document model
      // (node.freeLayout), never a getBoundingClientRect() measurement:
      // fully immune to any Transform anywhere in the ancestor chain (not
      // just this node's own), matching the exact precedent
      // FreeChildResizeHandles already established for the materially
      // identical Free-resize case. This was an undocumented
      // inconsistency against that precedent, not a necessity — see this
      // checkpoint's own report.
      const movingNode = findNodeById(store.document, nodeId);
      const startX = movingNode?.freeLayout?.x ?? 0;
      const startY = movingNode?.freeLayout?.y ?? 0;
      const width = movingNode?.freeLayout?.width ?? 0;
      const height = movingNode?.freeLayout?.height ?? 0;

      // Snap's own sibling targets (Checkpoint 1.15.6.1.1) — read once
      // from the DOCUMENT (not re-measured via the DOM) since every
      // sibling's freeLayout is already the exact parent-content-box-
      // relative geometry resolveFreeMoveSnap needs, and siblings never
      // move mid-gesture (only this one node does) so one read at
      // pointer-down is correct for the whole drag (section 24 — no
      // per-frame DOM queries). The moving node itself is excluded by
      // construction (filtered out by id, never by position — see
      // resolveFreeMoveSnap's own "moving-element exclusion" comment).
      const containerNode = containerId ? findNodeById(store.document, containerId) : undefined;
      const siblings: FreeMoveSnapBox[] = (containerNode?.children ?? [])
        .filter((child) => child.id !== nodeId && child.freeLayout)
        .map((child) => ({ x: child.freeLayout!.x, y: child.freeLayout!.y, width: child.freeLayout!.width, height: child.freeLayout!.height }));

      startRef.current = {
        startX,
        startY,
        width,
        height,
        startPointerX: event.clientX,
        startPointerY: event.clientY,
        parentBounds,
        containerId,
        siblings,
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
      // Guides are purely a during-the-gesture affordance (section 17 —
      // "disappear on pointer-up"); the final committed geometry is
      // already in the document by now regardless of whether it was
      // reached via a snap.
      setActiveSnapGuides(null);

      event.currentTarget.releasePointerCapture(event.pointerId);
      startRef.current = null;
      setIsDragging(false);
    },
    [commit, setActiveSnapGuides],
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
      store.setActiveSnapGuides(null);

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

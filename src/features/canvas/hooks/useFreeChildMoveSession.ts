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
import { createFreeInteraction, type FreeInteraction } from "@/features/canvas/utils/createFreeInteraction";
import { createFreeSnapContext, referencedTargetIds } from "@/features/canvas/utils/createFreeSnapContext";
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
  type SnapSourceEdges,
} from "@/features/canvas/utils/snapEngine";
import { computeEqualSpacingCandidates } from "@/features/canvas/utils/snapEqualSpacing";
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

/** Below this pointer displacement (px) Shift has no dominant axis yet. */
const SHIFT_DEAD_ZONE_PX = 2;

/**
 * Drag-to-reposition for a Free container's direct child (Checkpoint
 * 3.4.4): pointer capture, a live write of this one node's freeLayout per
 * frame, one Undo step. It never changes the document tree.
 *
 * BC-13.3 — snapping runs through the shared engine (snapEngine):
 * - targets: the parent's padding box and every visible element inside the
 *   container (collectFreeSnapTargets);
 * - the 6 screen-px threshold, independent axes, locks with hysteresis,
 *   deterministic ties, deduplicated lines, equal spacing among direct
 *   siblings;
 * - a candidate the containment rule would move is rejected (no false
 *   guide);
 * - Alt/Option held: nothing is applied, but alignment is still detected and
 *   shown as a nearby guide (D4/D22), the same as with Snap turned off;
 * - Shift held: movement is constrained to the dominant axis (from the total
 *   drag displacement); the other axis stays where it was when Shift was
 *   pressed (no jump), and only the free axis snaps (D42).
 * The order per frame is: proposed geometry → Shift constraint → snapping →
 * containment clamp → live write.
 *
 * BC-13.5 — the lifecycle (frames, auto-scroll and scroll compensation,
 * Escape/pointercancel/lost capture/blur/keyboard cancellation with an exact
 * rollback, deletion and project-switch invalidation, the final pointer
 * position, no-op detection, target refresh) is createFreeInteraction's,
 * shared with the resize handles.
 */
export function useFreeChildMoveSession(nodeId: string): UseFreeChildMoveSessionResult {
  const setFreeChildGeometryLive = useEditorStore((state) => state.setFreeChildGeometryLive);
  const [isDragging, setIsDragging] = useState(false);
  const interactionRef = useRef<FreeInteraction | null>(null);
  const { publish: publishGuides, reset: resetGuides } = useSnapGuidePublisher();

  // Unmounting mid-drag (the element or its container leaves the Canvas)
  // rolls the interaction back.
  useEffect(() => () => interactionRef.current?.cancel("unmount"), []);

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
      interactionRef.current?.cancel("unmount");

      event.stopPropagation();
      const captureEl = event.currentTarget;
      captureEl.setPointerCapture(event.pointerId);

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
      const start: FreeChildMoveStart = {
        startX: movingNode?.freeLayout?.x ?? 0,
        startY: movingNode?.freeLayout?.y ?? 0,
        width: movingNode?.freeLayout?.width ?? 0,
        height: movingNode?.freeLayout?.height ?? 0,
        startPointerX: event.clientX,
        startPointerY: event.clientY,
        parentBounds,
        containerId,
      };
      const maxX = Math.max(0, start.parentBounds.width - start.width);
      const maxY = Math.max(0, start.parentBounds.height - start.height);

      // Per-interaction state (never outlives it).
      let lock: SnapLock = NO_SNAP_LOCK;
      let shiftAnchor: { x: number; y: number } | null = null;
      let shiftUsed = false;
      let lastPosition = { x: start.startX, y: start.startY };
      resetGuides();

      const interaction = createFreeInteraction({
        nodeId,
        captureEl,
        pointerId: event.pointerId,
        startPointer: { x: event.clientX, y: event.clientY },
        modifiers: { alt: event.altKey, shift: event.shiftKey },
        containerEl,
        originals: new Map([[nodeId, movingNode?.freeLayout]]),
        measureSnap: () => {
          const live = findNodeById(useEditorStore.getState().document, nodeId);
          if (!containerEl || !containerId || !targetEl || !live?.freeLayout || !targetEl.isConnected) return null;
          return createFreeSnapContext(containerEl, measureFreeContainerFrame(containerEl), useEditorStore.getState().document, containerId, { ...live, freeLayout: live.freeLayout }, targetEl);
        },
        onFrame: ({ pointer, alt, shift, snap }) => {
          let raw = computeRawFreeChildMovePosition(start, pointer.x, pointer.y);

          // Shift: lock the non-dominant axis at its position when Shift went down.
          let edges: SnapSourceEdges = ALL_EDGES;
          if (shift) {
            shiftUsed = true;
            shiftAnchor ??= lastPosition;
            const dx = Math.abs(pointer.x - start.startPointerX);
            const dy = Math.abs(pointer.y - start.startPointerY);
            if (Math.max(dx, dy) >= SHIFT_DEAD_ZONE_PX) {
              if (dx >= dy) {
                raw = { x: raw.x, y: shiftAnchor.y };
                edges = { x: ALL_EDGES.x, y: [] };
              } else {
                raw = { x: shiftAnchor.x, y: raw.y };
                edges = { x: [], y: ALL_EDGES.y };
              }
            }
          } else {
            shiftAnchor = null;
          }

          let x = raw.x;
          let y = raw.y;
          let references: string[] = [];
          let guides: ActiveSnapGuides | null = null;
          if (snap) {
            const { offset } = snap;
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
              ...(edges.x.length > 0 ? computeEqualSpacingCandidates("x", visual, snap.siblingTargets) : []),
              ...(edges.y.length > 0 ? computeEqualSpacingCandidates("y", visual, snap.siblingTargets) : []),
            ];
            const result = resolveSnap({
              box: visual,
              edges,
              index: snap.index,
              spacing,
              enabled: useEditorStore.getState().snapEnabled && !alt,
              lock,
              adjust,
            });
            lock = result.lock;
            x = result.box.x - offset.x;
            y = result.box.y - offset.y;
            const finalVisual: Rect = {
              x: clampFreeChildAxis(x, 0, maxX) + offset.x,
              y: clampFreeChildAxis(y, 0, maxY) + offset.y,
              width: start.width + offset.width,
              height: start.height + offset.height,
            };
            guides = buildFreeSnapGuides(snap.containerId, result, finalVisual, snap.rectById, snap.parentRect);
            references = referencedTargetIds(result);
          } else {
            lock = NO_SNAP_LOCK;
          }

          const clampedX = clampFreeChildAxis(x, 0, maxX);
          const clampedY = clampFreeChildAxis(y, 0, maxY);
          lastPosition = { x: clampedX, y: clampedY };
          publishGuides(guides);
          setFreeChildGeometryLive(nodeId, { x: clampedX, y: clampedY, width: start.width, height: start.height });
          return references;
        },
        onEnd: (reason) => {
          if (interactionRef.current === interaction) interactionRef.current = null;
          // BC-13.3: after a Shift-constrained drag, the click that follows the
          // release would otherwise ADD the element to the selection
          // (CanvasInteractionBoundary's Shift+click). The drag selects the
          // element the way a plain drag's click does, and that one click is
          // consumed.
          if (reason === "commit" && shiftUsed) {
            const swallow = (click: MouseEvent) => click.stopPropagation();
            window.addEventListener("click", swallow, { capture: true, once: true });
            window.setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
            useEditorStore.getState().selectOnly(nodeId);
          }
          resetGuides();
          setIsDragging(false);
        },
      });
      interactionRef.current = interaction;
      setIsDragging(true);
    },
    [nodeId, publishGuides, resetGuides, setFreeChildGeometryLive],
  );

  const onPointerMove = useCallback((event: ReactPointerEvent<Element>) => {
    interactionRef.current?.pointerMove(event);
  }, []);

  const onPointerUp = useCallback((event: ReactPointerEvent<Element>) => {
    interactionRef.current?.pointerUp(event);
  }, []);

  // BC-13.5 (D21): an interrupted gesture is rolled back, never committed.
  const onPointerCancel = useCallback(() => {
    interactionRef.current?.cancel("pointercancel");
  }, []);

  return { isDragging, onPointerDown, onPointerMove, onPointerUp, onPointerCancel };
}

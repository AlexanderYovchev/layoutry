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
import { computeContainerChildScaling, deriveFlooredContainerOuterSize } from "@/features/canvas/utils/computeContainerChildScaling";
import {
  computeFreeChildResizeResult,
  type FreeChildResizeSession,
} from "@/features/canvas/utils/computeFreeChildResizeResult";
import { createFreeInteraction, type FreeInteraction } from "@/features/canvas/utils/createFreeInteraction";
import { createFreeSnapContext, referencedTargetIds } from "@/features/canvas/utils/createFreeSnapContext";
import { measureFreeContainerFrame } from "@/features/canvas/utils/freeLayoutFrame";
import { resolveFreeResizeSnap } from "@/features/canvas/utils/resolveFreeResizeSnap";
import { NO_SNAP_LOCK, SNAP_EPSILON, type SnapAxis, type SnapLock } from "@/features/canvas/utils/snapEngine";
import { resolveContainerScalingSnapshot } from "@/features/canvas/utils/resolveContainerScalingSnapshot";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { getEffectiveAspectRatioLocked } from "@/features/editor/rules/elementCapabilities";
import { describeStyleLockNotice, getStyleProtection } from "@/features/editor/rules/styleProtection";
import { findNodeById } from "@/features/editor/utils/findNodeById";
import { getResizeConstraintsForTag, type FreeLayoutGeometry } from "@/features/editor/types/layout";
import { getTransformSettings, hasNonIdentityRotateOrScale } from "@/features/editor/types/transform";
import { TRANSFORM_ANCESTOR_BLOCKED_NOTICE, getTransformBlockingAncestor } from "@/features/editor/rules/transformGeometrySafety";
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

/** Rendered and stored sizes closer than this (px) are treated as the same. */
const SIZE_TRACKING_TOLERANCE_PX = 0.5;

/**
 * Resize handles for a Free container's direct child (Checkpoint 3.4.4)
 * — the Free-mode counterpart to useResizeSession. Written live every
 * frame, one Undo step per resize: the canvas, its selection overlay, and
 * the Inspector's X/Y/Width/Height fields all stay in sync for free.
 *
 * aspectRatioLocked is resolved once per drag from the node's own
 * override or its tag's supportsIntrinsicAspectRatio default (see
 * computeFreeChildResizeResult). The resize floor (getResizeConstraintsForTag)
 * is the same small, generic minimum for every tag (Checkpoint 1.12.1).
 *
 * BC-13.4 — snapping through the shared engine (resolveFreeResizeSnap):
 * - the same target eligibility as dragging (createFreeSnapContext);
 * - only the edges the handle controls snap; the opposite edge stays
 *   anchored;
 * - every candidate is validated (minimum size, containment, the container
 *   scaling floor, a locked corner's ratio);
 * - Alt/Option or Snap off: nothing is applied, nearby alignment is still
 *   shown. Shift has no resize meaning (unchanged).
 * Snapping is unavailable when resizing an element with its own rotate/
 * scale, and on an axis whose rendered size doesn't follow the stored size.
 *
 * BC-13.5 — the lifecycle (frames, auto-scroll and scroll compensation,
 * cancellation with an exact rollback of the element AND any children a
 * nested Free container scaled, invalidation, the final pointer position,
 * no-op detection, target refresh) is createFreeInteraction's, shared with
 * the Free drag.
 */
export function useFreeChildResizeSession(nodeId: string): UseFreeChildResizeSessionResult {
  const setFreeChildGeometryLive = useEditorStore((state) => state.setFreeChildGeometryLive);
  const applyFreeContainerChildGeometriesLive = useEditorStore(
    (state) => state.applyFreeContainerChildGeometriesLive,
  );
  const [activeDirection, setActiveDirection] = useState<ResizeDirection | null>(null);
  const interactionRef = useRef<FreeInteraction | null>(null);
  const { publish: publishGuides, reset: resetGuides } = useSnapGuidePublisher();

  // The handles unmount mid-resize (selection change, deletion, Preview):
  // the resize is rolled back.
  useEffect(() => () => interactionRef.current?.cancel("unmount"), []);

  const onHandlePointerDown = useCallback(
    (direction: ResizeDirection, start: FreeChildResizeHandleStart) =>
      (event: ReactPointerEvent<HTMLDivElement>) => {
        event.stopPropagation();
        event.preventDefault();

        // Checkpoint 1.15.3, section 28/29 — same pre-check as useResizeSession.
        const store = useEditorStore.getState();
        const protection = getStyleProtection(store.document, nodeId);
        if (protection.protected) {
          store.showEditorNotice(describeStyleLockNotice([protection], false));
          return;
        }

        // Checkpoint 1.15.6.14.3 geometry-safety restriction — see
        // useResizeSession's identical check for the full reasoning.
        if (getTransformBlockingAncestor(store.document, nodeId)) {
          store.showEditorNotice(TRANSFORM_ANCESTOR_BLOCKED_NOTICE);
          return;
        }
        interactionRef.current?.cancel("unmount");

        const captureEl = event.currentTarget;
        captureEl.setPointerCapture(event.pointerId);

        const targetEl = window.document.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(nodeId)}"]`);
        const tag = targetEl?.getAttribute("data-node-type") ?? "";
        const constraints = getResizeConstraintsForTag();
        const containerEl = targetEl?.parentElement?.closest<HTMLElement>("[data-node-id]") ?? null;
        const containerId = containerEl?.getAttribute("data-node-id") ?? null;
        // BC-13.2 frame: the unchanged containment rule and the snapping
        // boundaries (padding box) from one measurement.
        const frame = containerEl ? measureFreeContainerFrame(containerEl) : null;
        const parentBounds = frame ? frame.containment : UNBOUNDED;
        const containerScaling = resolveContainerScalingSnapshot(targetEl ?? null, start.startWidth, start.startHeight);
        const node = findNodeById(store.document, nodeId);
        const session: FreeChildResizeSession = {
          direction,
          startX: start.startX,
          startY: start.startY,
          startWidth: start.startWidth,
          startHeight: start.startHeight,
          startPointerX: event.clientX,
          startPointerY: event.clientY,
          parentBounds,
          aspectRatioLocked: getEffectiveAspectRatioLocked({ aspectRatioLocked: node?.aspectRatioLocked, tag }),
        };
        const snappable = !hasNonIdentityRotateOrScale(getTransformSettings(node ?? {}));
        const flooredSize = (geometry: FreeLayoutGeometry) =>
          containerScaling
            ? deriveFlooredContainerOuterSize(geometry.width, geometry.height, containerScaling.startContentBounds, containerScaling.outerToContentInset)
            : { width: geometry.width, height: geometry.height };

        // The nodes this resize may write: itself, plus the children a nested
        // Free container scales — all rolled back together on cancel.
        const originals = new Map<string, FreeLayoutGeometry | undefined>([[nodeId, node?.freeLayout]]);
        for (const child of node?.children ?? []) if (containerScaling) originals.set(child.id, child.freeLayout);

        let lock: SnapLock = NO_SNAP_LOCK;
        let coupledWinner: SnapAxis | null = null;
        let axes = { x: false, y: false };
        resetGuides();

        const interaction = createFreeInteraction({
          nodeId,
          captureEl,
          pointerId: event.pointerId,
          startPointer: { x: event.clientX, y: event.clientY },
          modifiers: { alt: event.altKey, shift: event.shiftKey },
          containerEl,
          originals,
          measureSnap: () => {
            const live = findNodeById(useEditorStore.getState().document, nodeId);
            if (!snappable || !containerEl || !containerId || !targetEl?.isConnected || !live?.freeLayout) return null;
            const context = createFreeSnapContext(containerEl, measureFreeContainerFrame(containerEl), useEditorStore.getState().document, containerId, { ...live, freeLayout: live.freeLayout }, targetEl);
            // An axis whose rendered size doesn't follow the stored size (e.g.
            // content taller than the box) can't be snapped exactly.
            axes = {
              x: !context.measured || Math.abs(context.offset.width) <= SIZE_TRACKING_TOLERANCE_PX,
              y: !context.measured || Math.abs(context.offset.height) <= SIZE_TRACKING_TOLERANCE_PX,
            };
            return context;
          },
          onFrame: ({ pointer, alt, snap }) => {
            const proposal = computeFreeChildResizeResult(session, pointer.x, pointer.y, constraints);
            let result = proposal;
            let references: string[] = [];
            if (snap) {
              const snapped = resolveFreeResizeSnap({
                direction,
                proposal,
                offset: snap.offset,
                axes,
                containment: session.parentBounds,
                constraints,
                aspectRatio:
                  session.aspectRatioLocked && session.startWidth > 0 && session.startHeight > 0 ? session.startWidth / session.startHeight : null,
                // A nested Free container can't shrink below its scaling floor: a
                // candidate the floor would change isn't exact, so it's rejected.
                accept: containerScaling
                  ? (geometry) => {
                      const size = flooredSize(geometry);
                      return Math.abs(size.width - geometry.width) <= SNAP_EPSILON && Math.abs(size.height - geometry.height) <= SNAP_EPSILON;
                    }
                  : undefined,
                index: snap.index,
                siblingTargets: snap.siblingTargets,
                enabled: useEditorStore.getState().snapEnabled && !alt,
                lock,
                coupledWinner,
              });
              result = snapped.geometry;
              lock = snapped.result.lock;
              coupledWinner = snapped.coupledWinner;
              const size = flooredSize(result);
              const finalVisual = { x: result.x + snap.offset.x, y: result.y + snap.offset.y, width: size.width, height: size.height };
              publishGuides(buildFreeSnapGuides(snap.containerId, snapped.result, finalVisual, snap.rectById, snap.parentRect));
              references = referencedTargetIds(snapped.result);
            } else {
              lock = NO_SNAP_LOCK;
              publishGuides(null);
            }

            // Checkpoint 3.4.4: this Free child is itself a Free container with
            // children — they scale with it in the same live write.
            if (containerScaling) {
              const floored = flooredSize(result);
              const newContentBounds = {
                width: floored.width - containerScaling.outerToContentInset.width,
                height: floored.height - containerScaling.outerToContentInset.height,
              };
              const childGeometries = computeContainerChildScaling(
                containerScaling.children,
                containerScaling.startContentBounds,
                newContentBounds,
                containerScaling.policy,
              );
              applyFreeContainerChildGeometriesLive(
                containerScaling.containerId,
                { freeLayout: { ...result, width: floored.width, height: floored.height } },
                childGeometries,
              );
            } else {
              setFreeChildGeometryLive(nodeId, result);
            }
            return references;
          },
          onEnd: () => {
            if (interactionRef.current === interaction) interactionRef.current = null;
            resetGuides();
            setActiveDirection(null);
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
          },
        });
        interactionRef.current = interaction;
        setActiveDirection(direction);
        document.body.style.cursor = RESIZE_HANDLE_CURSORS[direction];
        document.body.style.userSelect = "none";
      },
    [nodeId, publishGuides, resetGuides, setFreeChildGeometryLive, applyFreeContainerChildGeometriesLive],
  );

  const onHandlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    interactionRef.current?.pointerMove(event);
  }, []);

  const onHandlePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    interactionRef.current?.pointerUp(event);
  }, []);

  // BC-13.5 (D21): an interrupted gesture is rolled back, never committed.
  const onHandlePointerCancel = useCallback(() => {
    interactionRef.current?.cancel("pointercancel");
  }, []);

  return {
    activeDirection,
    onHandlePointerDown,
    onHandlePointerMove,
    onHandlePointerUp,
    onHandlePointerCancel,
  };
}

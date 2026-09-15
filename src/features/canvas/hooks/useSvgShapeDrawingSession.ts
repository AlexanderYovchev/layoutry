"use client";

import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { resolveSvgPointerPosition } from "@/features/canvas/utils/resolveSvgPointerPosition";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { generateSvgObjectId } from "@/features/editor/commands/svgSceneCommands";
import { resolveSvgObjectCreationStyle } from "@/features/editor/utils/svgObjectDefaults";
import { getSvgObjectBounds, isDegenerateDrag, isDegenerateLine, normalizeDragToBounds } from "@/features/editor/utils/svgObjectGeometry";
import { findNodeById } from "@/features/editor/utils/findNodeById";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { SvgVectorObject } from "@/features/editor/types/svgScene";

export interface UseSvgShapeDrawingSessionResult {
  /** Attach to the `<svg>` root — only ever meaningful while activeSvgTool is "rect"/"ellipse"/"line" (the caller gates rendering/attachment on that). The rest of the gesture (move/up/cancel) is tracked via window-level listeners installed on pointerdown — see this hook's own top comment for why. */
  onPointerDown: (event: ReactPointerEvent<SVGSVGElement>) => void;
}

/**
 * Drag-to-draw for the Rectangle/Ellipse/Line tools (Checkpoint 1.15.6,
 * sections 16-18 of its own brief) — begin/commit-transaction shape
 * shared with every other continuous drag in this codebase (useResizeSession,
 * useFreeChildMoveSession), with two deliberate differences from those:
 *
 * 1. The object being drawn doesn't exist yet at pointer-down, so this
 *    ADDS it live (addSvgObjectLive, no history) and then resizes/
 *    repositions it live on every subsequent move (resizeSvgObjectLive/
 *    setSvgLineEndpointLive) — the scene rendering path SvgElement.tsx
 *    already has is what actually shows the live preview; no separate
 *    "draft" rendering exists for these three tools (contrast Polygon/
 *    Pen, which DO use a separate svgDraft — see commitSvgDraft).
 *
 * 2. Move/up/cancel are tracked via plain `window`-level pointermove/
 *    pointerup/pointercancel listeners installed on pointerdown, rather
 *    than native `setPointerCapture` on the `<svg>` root (every other
 *    drag session in this codebase captures on the element being dragged
 *    — a resize handle, a Free child, a vector object — all deliberately
 *    smaller/simpler targets than "the whole SVG"). This was adopted
 *    while investigating a real browser bug found during this
 *    checkpoint's own verification: a mouse-drag starting on top of
 *    PAINTED SVG content (e.g. the starter Rectangle's own fill) could
 *    be hijacked by the browser's native "drag this image out" affordance
 *    — the same one an `<img>` has — which silently swallows the rest of
 *    the pointer stream with no error at all. The actual fix is
 *    SvgElement.tsx's own `onDragStart={(e) => e.preventDefault()}` (see
 *    its doc comment); window listeners here are an independent,
 *    already-proven-correct choice kept for its own merits (no reliance
 *    on a specific element retaining capture across the live DOM churn
 *    this session's own addSvgObjectLive/resizeSvgObjectLive calls cause)
 *    rather than a required workaround. The move/up handlers are plain
 *    functions declared fresh INSIDE onPointerDown (not cross-render
 *    useCallback-memoized) — they only need to stay stable for the
 *    lifetime of one drag, not across renders, which sidesteps the
 *    self-referencing-closure dependency cycle a memoized version of "a
 *    handler that removes its own listener" would otherwise create;
 *    `detachRef` gives the Escape handler and the unmount cleanup a way
 *    to reach into whichever drag is currently in flight, if any.
 *
 * A degenerate result (see isDegenerateDrag/isDegenerateLine — an
 * accidental click, not a real gesture) CANCELS the transaction instead
 * of committing: the live-added object is discarded and the document
 * reverts to exactly what it was before pointer-down, with zero history
 * entry (section 58 of this checkpoint's own brief — never create
 * invisible garbage objects from accidental clicks).
 */
export function useSvgShapeDrawingSession(
  svgNode: EditorElementNode,
  svgRef: React.RefObject<SVGSVGElement | null>,
): UseSvgShapeDrawingSessionResult {
  const startRef = useRef<{ x: number; y: number; objectId: string } | null>(null);
  const didMoveRef = useRef(false);
  const detachRef = useRef<() => void>(() => {});

  const restoreAndCancel = useCallback(() => {
    const store = useEditorStore.getState();
    const snapshot = store.transactionSnapshot;
    if (snapshot) {
      useEditorStore.setState({ document: snapshot.document, selection: snapshot.selection });
    }
    store.cancelTransaction();
  }, []);

  const endSession = useCallback(
    (svgNodeId: string) => {
      const start = startRef.current;
      if (!start) return;
      startRef.current = null;

      const store = useEditorStore.getState();

      if (!didMoveRef.current) {
        restoreAndCancel();
        store.clearSvgObjectSelection();
        return;
      }

      const svgNodeLive = findNodeById(store.document, svgNodeId);
      const object = svgNodeLive?.svgScene?.objects.find((candidate) => candidate.id === start.objectId);

      const degenerate = !object || (object.type === "line" ? isDegenerateLine(object) : isDegenerateDrag(getSvgObjectBounds(object)));

      if (degenerate) {
        restoreAndCancel();
        store.clearSvgObjectSelection();
        return;
      }

      store.commitTransaction();
      store.setActiveSvgTool("select");
    },
    [restoreAndCancel],
  );

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      // Only ever meaningful for a background press — a press that lands
      // directly on an already-drawn object (or a resize handle) is the
      // Select tool's own concern (useSvgObjectMoveSession), which stops
      // propagation on its own pointerdown before this ever runs.
      const tool = useEditorStore.getState().activeSvgTool;
      if (tool !== "rect" && tool !== "ellipse" && tool !== "line") return;
      const svg = svgRef.current;
      if (!svg) return;

      event.stopPropagation();
      didMoveRef.current = false;

      const point = resolveSvgPointerPosition(svg, event.clientX, event.clientY);
      const objectId = generateSvgObjectId(tool === "rect" ? "rect" : tool === "ellipse" ? "ellipse" : "line");
      const style = resolveSvgObjectCreationStyle(svgNode, tool === "rect" ? "rect" : tool === "ellipse" ? "ellipse" : "line");

      const object: SvgVectorObject =
        tool === "line"
          ? { id: objectId, type: "line", x1: point.x, y1: point.y, x2: point.x, y2: point.y, ...style }
          : tool === "rect"
            ? { id: objectId, type: "rect", x: point.x, y: point.y, width: 0, height: 0, ...style }
            : { id: objectId, type: "ellipse", cx: point.x, cy: point.y, rx: 0, ry: 0, ...style };

      const store = useEditorStore.getState();
      store.beginTransaction();
      store.addSvgObjectLive(svgNode.id, object);
      store.selectSvgObjectOnly(objectId);

      startRef.current = { x: point.x, y: point.y, objectId };

      const svgNodeId = svgNode.id;

      function handlePointerMove(moveEvent: PointerEvent) {
        const start = startRef.current;
        if (!start || !svg) return;
        didMoveRef.current = true;

        const movePoint = resolveSvgPointerPosition(svg, moveEvent.clientX, moveEvent.clientY);
        const currentStore = useEditorStore.getState();
        const currentTool = currentStore.activeSvgTool;

        if (currentTool === "line") {
          currentStore.setSvgLineEndpointLive(svgNodeId, start.objectId, movePoint.x, movePoint.y);
          return;
        }
        const bounds = normalizeDragToBounds(start.x, start.y, movePoint.x, movePoint.y);
        currentStore.resizeSvgObjectLive(svgNodeId, start.objectId, bounds);
      }

      function detach() {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerUp);
        detachRef.current = () => {};
      }

      function handlePointerUp() {
        detach();
        endSession(svgNodeId);
      }

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerUp);
      detachRef.current = detach;
    },
    [svgNode, svgRef, endSession],
  );

  // Escape mid-drag cancels this in-progress shape exactly like
  // useResizeSession/useFreeChildMoveSession already cancel their own
  // continuous drags (section 39 of this checkpoint's own brief: "if an
  // unfinished drawing exists, cancel draft" is Escape's top priority
  // inside SVG Edit Mode) — same capture-phase + stopPropagation shape,
  // so this fires before the outer CanvasInteractionBoundary's own
  // Escape-clears-selection handler ever sees the key.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || !startRef.current) return;
      event.stopPropagation();
      detachRef.current();

      restoreAndCancel();
      useEditorStore.getState().clearSvgObjectSelection();
      startRef.current = null;
    }

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [restoreAndCancel]);

  // Unmounting mid-drag (e.g. exiting edit mode) must not leave a stray
  // window listener behind.
  useEffect(() => {
    return () => detachRef.current();
  }, []);

  return { onPointerDown };
}

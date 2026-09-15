"use client";

import { useCallback, type MouseEvent as ReactMouseEvent } from "react";
import { resolveSvgPointerPosition } from "@/features/canvas/utils/resolveSvgPointerPosition";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";

export interface UseSvgPathDrawingInteractionResult {
  /** Click = add the next point (or start the draft on the very first click) — attach to the `<svg>` background, only while activeSvgTool is "polygon"/"pen" (the caller gates on that). */
  onClick: (event: ReactMouseEvent<SVGSVGElement>) => void;
  /** Double-click = finish (commit) the draft — section 19/20 of this checkpoint's own brief. */
  onDoubleClick: (event: ReactMouseEvent<SVGSVGElement>) => void;
}

/**
 * Polygon/Pen's own click-to-accumulate-points interaction (Checkpoint
 * 1.15.6, sections 19/20 of its own brief) — deliberately NOT a drag
 * session (contrast useSvgShapeDrawingSession): each click adds one
 * point to the store's own `svgDraft` (kept entirely as UI state until
 * Enter/double-click commits it — see useEditorStore's own
 * commitSvgDraft), so this hook is a thin coordinate-conversion +
 * dispatch layer with no local session state of its own at all.
 */
export function useSvgPathDrawingInteraction(svgRef: React.RefObject<SVGSVGElement | null>): UseSvgPathDrawingInteractionResult {
  const onClick = useCallback(
    (event: ReactMouseEvent<SVGSVGElement>) => {
      // A native double-click fires TWO "click" events (detail 1, then
      // detail 2) before its own "dblclick" — without this guard, the
      // second click of the finishing double-click would add one
      // unwanted extra point immediately before onDoubleClick commits.
      // MouseEvent.detail is the standard, timer-free way to tell a
      // genuine single click apart from the first half of a double-click.
      if (event.detail > 1) return;

      const svg = svgRef.current;
      if (!svg) return;
      const point = resolveSvgPointerPosition(svg, event.clientX, event.clientY);

      const store = useEditorStore.getState();
      const tool = store.activeSvgTool;
      if (tool !== "polygon" && tool !== "pen") return;

      if (store.svgDraft) {
        store.addSvgDraftPoint(point);
      } else {
        store.startSvgDraft(tool, point);
      }
    },
    [svgRef],
  );

  const onDoubleClick = useCallback((event: ReactMouseEvent<SVGSVGElement>) => {
    event.preventDefault();
    const store = useEditorStore.getState();
    if (!store.svgDraft) return;
    store.commitSvgDraft();
  }, []);

  return { onClick, onDoubleClick };
}

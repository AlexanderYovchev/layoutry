"use client";

import { useEffect, useState, type RefObject } from "react";

export interface MeasuredNodeRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Measures a rendered document node's box relative to the canvas root
 * via getBoundingClientRect, so an overlay can be positioned without
 * ever touching the target's own layout. Re-measures on canvas/target
 * resize (ResizeObserver) and window resize; scrolling needs no extra
 * handling since the overlay is an absolutely-positioned sibling inside
 * the same scrolling box as the content it tracks.
 *
 * Deliberately useEffect, not useLayoutEffect: canvasRootRef is attached
 * to an ancestor outside this hook's own component, and React's commit
 * walk is bottom-up, so a descendant's layout effect can run before an
 * ancestor's ref is attached on first paint. Regular effects fire only
 * after every ref in the tree is attached, trading one frame's delay for
 * correctness on the initial mount.
 */
export function useMeasuredNodeRect(
  canvasRootRef: RefObject<HTMLElement | null>,
  nodeId: string | null,
): MeasuredNodeRect | null {
  const [rect, setRect] = useState<MeasuredNodeRect | null>(null);

  useEffect(() => {
    const canvasRoot = canvasRootRef.current;
    if (!canvasRoot || !nodeId) {
      setRect(null);
      return;
    }

    const target = canvasRoot.querySelector<HTMLElement>(
      `[data-node-id="${CSS.escape(nodeId)}"]`,
    );
    if (!target) {
      setRect(null);
      return;
    }

    const runMeasure = () => {
      const rootBox = canvasRoot.getBoundingClientRect();
      const targetBox = target.getBoundingClientRect();
      setRect({
        top: targetBox.top - rootBox.top,
        left: targetBox.left - rootBox.left,
        width: targetBox.width,
        height: targetBox.height,
      });
    };

    runMeasure();

    const resizeObserver = new ResizeObserver(runMeasure);
    resizeObserver.observe(canvasRoot);
    resizeObserver.observe(target);
    window.addEventListener("resize", runMeasure);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", runMeasure);
    };
  }, [canvasRootRef, nodeId]);

  return rect;
}

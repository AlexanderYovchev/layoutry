"use client";

import { useEffect, useState } from "react";

export interface RenderedNodeSize {
  width: number;
  height: number;
}

/**
 * The node's actual rendered box size, read directly from the DOM by
 * data-node-id — display-only, for the Inspector to show when a parent's
 * CSS containment (elementDimensionsStyle's maxWidth/maxHeight: "100%")
 * is currently clamping a node below its stored preferredWidth/
 * preferredHeight (see Checkpoint 3.4.3). Never used to drive a document
 * mutation; the document model stays the only source of truth for what
 * the user asked for. There is exactly one Canvas per app instance, so
 * this queries the global document rather than needing a canvasRootRef
 * the way overlay positioning (useMeasuredNodeRect) does.
 */
export function useRenderedNodeSize(nodeId: string | null): RenderedNodeSize | null {
  const [size, setSize] = useState<RenderedNodeSize | null>(null);

  useEffect(() => {
    if (!nodeId) return;

    const target = window.document.querySelector<HTMLElement>(
      `[data-node-id="${CSS.escape(nodeId)}"]`,
    );
    if (!target) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to the DOM not having this node yet, not deriving a render-time value; a real DOM query can only happen after mount
      setSize(null);
      return;
    }

    const measure = () => {
      const rect = target.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };

    measure();

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(target);
    return () => resizeObserver.disconnect();
  }, [nodeId]);

  // nodeId (not just the effect's own async measurement) is the
  // authoritative "is there anything to report" signal — computed
  // directly here rather than via an extra setState call in the effect
  // for the "no nodeId" case, since that branch needs no DOM read at all.
  return nodeId ? size : null;
}

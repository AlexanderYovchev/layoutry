"use client";

import { useLayoutEffect, useState } from "react";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";

/**
 * The font size, in px, the Canvas actually renders for a node (BC-01.4) —
 * what Typography's Font size field shows while the node has no authored
 * font size. Without it the field fell back to a fixed 16 while an H1
 * renders at its `heading` default (text-3xl, 1.875rem = 30px), so Arrow
 * Up wrote 17px and shrank the heading.
 *
 * Read from the rendered element, the same "start from what's actually on
 * screen" approach useRenderedNodeSize takes for unset dimensions: it
 * reflects exactly what the Canvas applies — the document default
 * presentations (documentDefaultStyles.ts, which Export prints verbatim),
 * inheritance from ancestors, and rem/em units — without a second,
 * hand-maintained copy of the cascade. Display only: nothing is written to
 * the document until the user edits the field.
 *
 * Re-measured after every document change (a layout effect, so the Canvas
 * DOM from the same commit is already in place and the field never paints
 * a stale value), because an ancestor's edit can change what this node
 * inherits without changing the node itself. Null until measured, or when
 * the node isn't rendered.
 */
export function useRenderedFontSize(nodeId: string | null): number | null {
  const documentModel = useEditorStore((state) => state.document);
  const [measured, setMeasured] = useState<{ nodeId: string; px: number } | null>(null);

  useLayoutEffect(() => {
    if (!nodeId) return;
    const target = window.document.querySelector<HTMLElement>(`[data-document-surface] [data-node-id="${CSS.escape(nodeId)}"]`);
    const px = target ? Number.parseFloat(window.getComputedStyle(target).fontSize) : Number.NaN;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a DOM measurement can only happen after the Canvas commits; same reason as useRenderedNodeSize
    setMeasured(Number.isFinite(px) && px > 0 ? { nodeId, px: Math.round(px * 100) / 100 } : null);
  }, [nodeId, documentModel]);

  return measured && measured.nodeId === nodeId ? measured.px : null;
}

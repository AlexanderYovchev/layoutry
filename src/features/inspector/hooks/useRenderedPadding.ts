"use client";

import { useLayoutEffect, useState } from "react";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EdgeSide } from "@/features/editor/types/spacing";

export type RenderedPadding = Record<EdgeSide, number>;

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function measure(nodeId: string): RenderedPadding | null {
  const target = window.document.querySelector<HTMLElement>(
    `[data-document-surface] [data-node-id="${CSS.escape(nodeId)}"]`,
  );
  if (!target) return null;
  const style = window.getComputedStyle(target);
  const sides = {
    top: Number.parseFloat(style.paddingTop),
    right: Number.parseFloat(style.paddingRight),
    bottom: Number.parseFloat(style.paddingBottom),
    left: Number.parseFloat(style.paddingLeft),
  };
  if (!Object.values(sides).every(Number.isFinite)) return null;
  return {
    top: round(sides.top),
    right: round(sides.right),
    bottom: round(sides.bottom),
    left: round(sides.left),
  };
}

/**
 * The padding the Canvas actually renders for a node (BC-05.3) — what an
 * unset padding side shows in Spacing. Without it an unset side read 0
 * while, for example, a button renders 8px / 16px from its own default
 * presentation. Same approach, and the same reasons, as
 * useRenderedTypography: read from the rendered element so it reflects
 * exactly the default presentations Export also prints, with no second,
 * hand-written table of defaults. Display only — nothing is written until
 * the user edits a side.
 *
 * Re-measured after every document change, in a layout effect, so the
 * field never paints a stale value. Pass null to skip measuring (every
 * side authored). Null until measured, or when the node isn't rendered.
 */
export function useRenderedPadding(
  nodeId: string | null,
): RenderedPadding | null {
  const documentModel = useEditorStore((state) => state.document);
  const [measured, setMeasured] = useState<{
    nodeId: string;
    padding: RenderedPadding;
  } | null>(null);

  useLayoutEffect(() => {
    if (!nodeId) return;
    const padding = measure(nodeId);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a DOM measurement can only happen after the Canvas commits; same reason as useRenderedTypography
    setMeasured(padding ? { nodeId, padding } : null);
  }, [nodeId, documentModel]);

  return measured && measured.nodeId === nodeId ? measured.padding : null;
}

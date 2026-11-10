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
 * The padding the Canvas actually renders for each of `nodeIds` (BC-05.3,
 * several at once since BC-05.4) — what an unset padding side shows in
 * Spacing, for one element or a multi-selection. Without it an unset side
 * read 0 while, for example, a button renders 8px / 16px from its own
 * default presentation. Same approach, and the same reasons, as
 * useRenderedTypography: read from the rendered element so it reflects
 * exactly the default presentations Export also prints, with no second,
 * hand-written table of defaults. Display only — nothing is written until
 * the user edits a side.
 *
 * One layout effect measures every listed node after each document change
 * (one getComputedStyle per node), so the fields never paint a stale value.
 * Pass only the nodes that have an unset side; an empty list measures
 * nothing. A node that isn't rendered is missing from the result. Null
 * until the first measurement of this exact list.
 */
export function useRenderedPaddings(
  nodeIds: readonly string[],
): ReadonlyMap<string, RenderedPadding> | null {
  const documentModel = useEditorStore((state) => state.document);
  const key = nodeIds.join("\u0000");
  const [measured, setMeasured] = useState<{
    key: string;
    paddings: ReadonlyMap<string, RenderedPadding>;
  } | null>(null);

  useLayoutEffect(() => {
    // Nothing to measure: no state update, so no extra render per edit.
    if (key === "") return;
    const paddings = new Map<string, RenderedPadding>();
    for (const nodeId of key.split("\u0000")) {
      const padding = measure(nodeId);
      if (padding) paddings.set(nodeId, padding);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a DOM measurement can only happen after the Canvas commits; same reason as useRenderedTypography
    setMeasured({ key, paddings });
  }, [key, documentModel]);

  return measured && measured.key === key ? measured.paddings : null;
}

/** One node's rendered padding (see useRenderedPaddings). Pass null to skip measuring. */
export function useRenderedPadding(
  nodeId: string | null,
): RenderedPadding | null {
  const paddings = useRenderedPaddings(nodeId === null ? [] : [nodeId]);
  return nodeId === null ? null : (paddings?.get(nodeId) ?? null);
}

"use client";

import { useLayoutEffect, useState } from "react";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { MeasuredStyles } from "@/features/inspector/utils/effectiveCss";

function sameMeasurements(a: MeasuredStyles, b: MeasuredStyles): boolean {
  if (a.size !== b.size) return false;
  for (const [id, row] of a) {
    const other = b.get(id);
    if (!other) return false;
    for (const key of Object.keys(row)) if (row[key] !== other[key]) return false;
  }
  return true;
}

/**
 * The computed values of `cssProperties` (kebab-case) for each of
 * `nodeIds`, read from their rendered Canvas elements (BC-10.3) — the
 * generalisation of BC-05.4's useRenderedPaddings, for every multi-
 * selection section whose values can differ by tag default, inheritance
 * or relative units.
 *
 * - One layout effect per document or selection change reads every
 *   listed element once (one getComputedStyle each; the browser computes
 *   style for the whole batch at most once), before paint, so the
 *   Inspector never shows a stale value after an edit, Undo or Redo.
 * - An element that isn't rendered is missing from the result, so the
 *   caller sees "unknown", never a default.
 * - Off-screen elements and elements hidden by CSS (display: none) are
 *   still in the DOM and are read normally: computed values don't need a
 *   box.
 * - When nothing changed, the previous object is kept, so a section
 *   doesn't re-render for nothing.
 * Display only: nothing measured is ever written to the document.
 */
export function useRenderedStyles(nodeIds: readonly string[], cssProperties: readonly string[]): MeasuredStyles | null {
  const documentModel = useEditorStore((state) => state.document);
  const key = `${nodeIds.join("\u0000")}\u0001${cssProperties.join(",")}`;
  const [measured, setMeasured] = useState<{ key: string; styles: MeasuredStyles } | null>(null);

  useLayoutEffect(() => {
    if (nodeIds.length === 0) return;
    const styles = new Map<string, Record<string, string>>();
    for (const nodeId of nodeIds) {
      const target = window.document.querySelector<HTMLElement>(`[data-document-surface] [data-node-id="${CSS.escape(nodeId)}"]`);
      if (!target) continue;
      const computed = window.getComputedStyle(target);
      const row: Record<string, string> = {};
      for (const property of cssProperties) row[property] = computed.getPropertyValue(property);
      styles.set(nodeId, row);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a DOM measurement can only happen after the Canvas commits; same reason as useRenderedPaddings
    setMeasured((previous) => (previous && previous.key === key && sameMeasurements(previous.styles, styles) ? previous : { key, styles }));
    // nodeIds/cssProperties are captured by `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, documentModel]);

  return measured && measured.key === key ? measured.styles : null;
}

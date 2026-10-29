"use client";

import { useLayoutEffect, useState } from "react";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";

/** A computed CSS value that is either the `normal` keyword or a number. */
export type RenderedKeywordOrNumber = { kind: "normal" } | { kind: "number"; value: number };

export interface RenderedTypography {
  /** Computed font-size, px. */
  fontSizePx: number;
  /** Computed line-height as a unitless multiple of the element's own font size, or `normal`; null if unreadable. */
  lineHeight: RenderedKeywordOrNumber | null;
  /** Computed letter-spacing, px, or `normal`; null if unreadable. */
  letterSpacing: RenderedKeywordOrNumber | null;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function readKeywordOrPx(computed: string): RenderedKeywordOrNumber | null {
  if (computed === "normal") return { kind: "normal" };
  const px = Number.parseFloat(computed);
  return Number.isFinite(px) ? { kind: "number", value: px } : null;
}

function measure(nodeId: string): RenderedTypography | null {
  const target = window.document.querySelector<HTMLElement>(`[data-document-surface] [data-node-id="${CSS.escape(nodeId)}"]`);
  if (!target) return null;
  const style = window.getComputedStyle(target);
  const fontSizePx = Number.parseFloat(style.fontSize);
  const lineHeight = readKeywordOrPx(style.lineHeight);
  const letterSpacing = readKeywordOrPx(style.letterSpacing);
  if (!Number.isFinite(fontSizePx) || fontSizePx <= 0) return null;
  return {
    fontSizePx: round(fontSizePx, 2),
    // Browsers resolve a unitless line-height to px; dividing by the same
    // element's font size recovers the multiple the defaults are written in
    // (H1: 36px / 30px = 1.2).
    lineHeight: lineHeight?.kind === "number" ? { kind: "number", value: round(lineHeight.value / fontSizePx, 3) } : lineHeight,
    letterSpacing: letterSpacing?.kind === "number" ? { kind: "number", value: round(letterSpacing.value, 3) } : letterSpacing,
  };
}

/**
 * The typography the Canvas actually renders for a node (BC-01.4 font
 * size, extended in BC-01.5 to line height and letter spacing) — what
 * Typography's fields show while those properties are unset. Without it
 * the fields fell back to fixed guesses (16, 1.5, 0) while e.g. an H1
 * renders at 30px with line-height 1.2 and letter-spacing -0.025em.
 *
 * Read from the rendered element, the same "start from what's actually on
 * screen" approach useRenderedNodeSize takes for unset dimensions: it
 * reflects exactly what the Canvas applies — the document default
 * presentations (documentDefaultStyles.ts, which Export prints verbatim),
 * inheritance from ancestors, and units — without a second,
 * hand-maintained copy of the cascade. One getComputedStyle read covers
 * all three properties. `normal` is reported as `normal`, never turned into
 * a guessed number. Display only: nothing is written to the document until
 * the user edits a field.
 *
 * Re-measured after every document change (a layout effect, so the Canvas
 * DOM from the same commit is already in place and the fields never paint
 * a stale value), because an ancestor's edit can change what this node
 * inherits without changing the node itself. Pass null to skip measuring
 * (everything authored). Null until measured, or when the node isn't
 * rendered.
 */
export function useRenderedTypography(nodeId: string | null): RenderedTypography | null {
  const documentModel = useEditorStore((state) => state.document);
  const [measured, setMeasured] = useState<{ nodeId: string; typography: RenderedTypography } | null>(null);

  useLayoutEffect(() => {
    if (!nodeId) return;
    const typography = measure(nodeId);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a DOM measurement can only happen after the Canvas commits; same reason as useRenderedNodeSize
    setMeasured(typography ? { nodeId, typography } : null);
  }, [nodeId, documentModel]);

  return measured && measured.nodeId === nodeId ? measured.typography : null;
}

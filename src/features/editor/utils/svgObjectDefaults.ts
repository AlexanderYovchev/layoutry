import { DEFAULT_SVG_FILL, resolveSvgFill, resolveSvgStroke, resolveSvgStrokeWidth } from "@/features/editor/types/svg";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { SvgVectorObjectKind } from "@/features/editor/types/svgScene";

export interface SvgObjectCreationStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

/**
 * A newly created vector object's own starter styling (Checkpoint
 * 1.15.6, sections 18/23/24 of its own brief) — seeded from the owning
 * SVG's CURRENT legacy svgFill/svgStroke/svgStrokeWidth fields, treated
 * purely as CREATION defaults, never a live binding: changing the SVG's
 * own default styling afterward never restyles objects already drawn
 * (each object owns its style independently the moment it's created).
 * Shared by every drawing tool (the Canvas-side Rect/Ellipse/Line
 * sessions and the store's own Polygon/Pen draft-commit path) so all
 * five behave identically.
 *
 * Line is a deliberate special case (section 18): a fill-only line is
 * invisible, so a Line ALWAYS gets `fill: undefined` and a guaranteed
 * visible stroke — the owning SVG's own current stroke if it has one,
 * else DEFAULT_SVG_FILL (the same accent color 1.15.5's own factory
 * already uses as its "visible default") rather than leaving the new
 * line invisible.
 */
export function resolveSvgObjectCreationStyle(svgNode: EditorElementNode, kind: SvgVectorObjectKind): SvgObjectCreationStyle {
  const stroke = resolveSvgStroke(svgNode);
  const strokeWidth = stroke ? resolveSvgStrokeWidth(svgNode) : undefined;

  if (kind === "line") {
    return { stroke: stroke ?? DEFAULT_SVG_FILL, strokeWidth: strokeWidth ?? 1 };
  }
  return { fill: resolveSvgFill(svgNode), stroke, strokeWidth };
}

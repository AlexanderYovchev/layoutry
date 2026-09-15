import { formatSvgPoints } from "@/features/editor/utils/svgObjectGeometry";
import type { SvgPrimitiveKind } from "@/features/editor/types/svg";
import type { SvgVectorPoint } from "@/features/editor/types/svgScene";

/**
 * The one source of truth for every SVG starter primitive's own
 * coordinates (Checkpoint 1.15.5, section 11 of its own brief — "do not
 * duplicate coordinates across files"). Every value here is authored
 * against the default 0 0 100 100 viewBox (see types/svg.ts's
 * DEFAULT_SVG_VIEW_BOX). Originally lived under canvas/utils/ (1.15.5,
 * SvgElement.tsx's own sole consumer at the time); moved into the editor
 * feature in Checkpoint 1.15.6 once commands/svgSceneCommands.ts's own
 * migration step (materializeSvgStarterIntoScene) ALSO needed these
 * exact numbers to convert a legacy starter primitive into an equivalent
 * scene object — canvas may import editor (as it already does
 * throughout this codebase), never the reverse, so a shared module two
 * editor-feature files depend on cannot live under canvas/.
 *
 * Coordinates are kept deliberately simple/readable (whole numbers, at
 * most one decimal place) rather than precisely computed regular-polygon
 * vertices — this is starter geometry for a foundation checkpoint, not a
 * geometry engine (Checkpoint 1.15.5, section 31 of its own brief).
 */
export const SVG_RECTANGLE_GEOMETRY = { x: 10, y: 10, width: 80, height: 80 } as const;

export const SVG_CIRCLE_GEOMETRY = { cx: 50, cy: 50, r: 40 } as const;

export const SVG_TRIANGLE_POINT_LIST: readonly SvgVectorPoint[] = [
  { x: 50, y: 10 },
  { x: 90, y: 90 },
  { x: 10, y: 90 },
];

/**
 * A plain 10-point polygon alternating outer/inner radius (Checkpoint
 * 1.15.5, section 30 — no custom path parsing, no point-count control).
 * Coordinates deliberately mirror Checkpoint 1.15.4's CSS clip-path Star
 * preset's own percentages (that preset's 0-100% figures line up exactly
 * with this module's 0-100 viewBox units) — a visual coincidence worth
 * noting, not a shared dependency: the two features remain
 * architecturally independent (SVG geometry here, CSS clip-path there),
 * so this list is authored fresh, not imported from types/shape.ts.
 */
export const SVG_STAR_POINT_LIST: readonly SvgVectorPoint[] = [
  { x: 50, y: 0 },
  { x: 61, y: 35 },
  { x: 98, y: 35 },
  { x: 68, y: 57 },
  { x: 79, y: 91 },
  { x: 50, y: 70 },
  { x: 21, y: 91 },
  { x: 32, y: 57 },
  { x: 2, y: 35 },
  { x: 39, y: 35 },
];

/** The exact SVG `points` attribute strings — derived from the two point lists above, never authored separately, so the renderer's attribute and a future scene-materialized polygon's own points can never drift apart. */
export const SVG_TRIANGLE_POINTS = formatSvgPoints(SVG_TRIANGLE_POINT_LIST);
export const SVG_STAR_POINTS = formatSvgPoints(SVG_STAR_POINT_LIST);

export function getSvgPrimitiveLabel(kind: SvgPrimitiveKind): string {
  switch (kind) {
    case "rectangle":
      return "Rectangle";
    case "circle":
      return "Circle";
    case "triangle":
      return "Triangle";
    case "star":
      return "Star";
  }
}

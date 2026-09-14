import type { SvgPrimitiveKind } from "@/features/editor/types/svg";

/**
 * The one source of truth for every SVG starter primitive's own
 * coordinates (Checkpoint 1.15.5, section 11 of its own brief — "do not
 * duplicate coordinates across files"). Every value here is authored
 * against the default 0 0 100 100 viewBox (see types/svg.ts's
 * DEFAULT_SVG_VIEW_BOX) — SvgElement.tsx is the only current consumer,
 * but a future Inspector preview or test can read the exact same
 * constants rather than re-deriving them.
 *
 * Coordinates are kept deliberately simple/readable (whole numbers, at
 * most one decimal place) rather than precisely computed regular-polygon
 * vertices — this is starter geometry for a foundation checkpoint, not a
 * geometry engine (section 31 of this checkpoint's own brief).
 */
export const SVG_RECTANGLE_GEOMETRY = { x: 10, y: 10, width: 80, height: 80 } as const;

export const SVG_CIRCLE_GEOMETRY = { cx: 50, cy: 50, r: 40 } as const;

export const SVG_TRIANGLE_POINTS = "50,10 90,90 10,90";

/**
 * A plain 10-point polygon alternating outer/inner radius (section 30 —
 * no custom path parsing, no point-count control). Coordinates deliberately
 * mirror Checkpoint 1.15.4's CSS clip-path Star preset's own percentages
 * (that preset's 0-100% figures line up exactly with this module's 0-100
 * viewBox units) — a visual coincidence worth noting, not a shared
 * dependency: the two features remain architecturally independent (SVG
 * geometry here, CSS clip-path there — see this checkpoint's own report,
 * section T.8), so this string is authored fresh, not imported from
 * types/shape.ts.
 */
export const SVG_STAR_POINTS = "50,0 61,35 98,35 68,57 79,91 50,70 21,91 32,57 2,35 39,35";

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

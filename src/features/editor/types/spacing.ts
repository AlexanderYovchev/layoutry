/**
 * Margin/padding for any rendered box (Checkpoint 3.5). Deliberately a
 * separate concept from dimensions.offsetX/offsetY (the Checkpoint 3.4.3
 * west/north resize-anchor margin trick) and from a Free child's own
 * x/y position — see elementPositionStyle for how offsetX/Y and
 * spacing.margin compose additively into the same CSS property instead
 * of one silently overwriting the other.
 *
 * Every side is independently optional (BC-05.3, project format 2). An
 * absent side is unset: no declaration is written and the element keeps
 * whatever Layoutry's default presentation gives it (a button's own
 * padding, the base stylesheet's margin: 0). A number — including 0 — is
 * an authored declaration that Canvas, Preview and Export all apply.
 * Format 1 stored four required numbers and used 0 to mean "unset"; the
 * format 1 → 2 migration (projectFormatMigrations.ts) drops those zeros
 * so old projects render exactly as before.
 */
export type EdgeSide = "top" | "right" | "bottom" | "left";

export const EDGE_SIDES: readonly EdgeSide[] = ["top", "right", "bottom", "left"];

/** One box's sides. Absent = unset; any number (0 included) = authored. */
export type EdgeValues = Partial<Record<EdgeSide, number>>;

export type SpacingBox = "margin" | "padding";

/**
 * A node's spacing record. Each box is absent when none of its sides is
 * authored. The record itself stays once a node has one, even when both
 * boxes are empty: its presence is what retires the pre-3.5 container
 * default padding (see elementStyleRecipes' "container-padding"), so
 * resetting a container's padding returns it to the modern baseline
 * rather than reviving that legacy chrome.
 */
export interface ElementSpacing {
  margin?: EdgeValues;
  padding?: EdgeValues;
}

/** Both boxes, never undefined — for readers that only look sides up. */
export interface ResolvedSpacing {
  margin: EdgeValues;
  padding: EdgeValues;
}

const NO_EDGES: EdgeValues = {};

export function getElementSpacing(node: { spacing?: ElementSpacing }): ResolvedSpacing {
  return { margin: node.spacing?.margin ?? NO_EDGES, padding: node.spacing?.padding ?? NO_EDGES };
}

/** True when at least one side of `edges` is authored. Zero counts — it is a real declaration. */
export function hasAuthoredEdge(edges: EdgeValues | undefined): boolean {
  return edges !== undefined && EDGE_SIDES.some((side) => edges[side] !== undefined);
}

/** `edges` with `side` set (a number) or removed (undefined); undefined once no side is left. */
export function withEdgeSide(edges: EdgeValues | undefined, side: EdgeSide, value: number | undefined): EdgeValues | undefined {
  const next: EdgeValues = { ...edges };
  if (value === undefined) delete next[side];
  else next[side] = value;
  return hasAuthoredEdge(next) ? next : undefined;
}

/** The spacing record with one box replaced or removed. The record itself is kept (see ElementSpacing). */
export function withSpacingBox(spacing: ElementSpacing | undefined, box: SpacingBox, edges: EdgeValues | undefined): ElementSpacing {
  const next: ElementSpacing = { ...spacing };
  if (hasAuthoredEdge(edges)) next[box] = edges;
  else delete next[box];
  return next;
}

/** Side-by-side equality, where absent and 0 are different values. */
export function edgeValuesEqual(a: EdgeValues | undefined, b: EdgeValues | undefined): boolean {
  return EDGE_SIDES.every((side) => a?.[side] === b?.[side]);
}

/** The same number on all four sides. */
export function uniformEdges(value: number): EdgeValues {
  return { top: value, right: value, bottom: value, left: value };
}

export const SPACING_MIN_PX = 0;
export const SPACING_MAX_PX = 500;

/**
 * The one place a raw spacing input becomes a safe stored value: must be
 * finite (rejects NaN/Infinity from a malformed draft), clamped to
 * [0, 500] — padding, margin, and gap all share this same floor/ceiling
 * for Checkpoint 3.5 (margin's own negative-value support is explicitly
 * out of scope "unless implemented deliberately," so it isn't here).
 * Returns null for a non-finite input so the caller can reject the
 * commit outright rather than silently coercing it to 0.
 */
export function clampSpacingValue(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  return Math.max(SPACING_MIN_PX, Math.min(value, SPACING_MAX_PX));
}

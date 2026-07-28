/**
 * Margin/padding for any rendered box (Checkpoint 3.5). Deliberately a
 * separate concept from dimensions.offsetX/offsetY (the Checkpoint 3.4.3
 * west/north resize-anchor margin trick) and from a Free child's own
 * x/y position — see elementPositionStyle for how offsetX/Y and
 * spacing.margin compose additively into the same CSS property instead
 * of one silently overwriting the other.
 */
export interface EdgeValues {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ElementSpacing {
  margin: EdgeValues;
  padding: EdgeValues;
}

export const ZERO_EDGES: EdgeValues = { top: 0, right: 0, bottom: 0, left: 0 };

/** A node with no spacing set renders with zero margin/padding from this model (a container's own Tailwind classes may still apply their own default — see ContainerElement's legacy fallback). */
const DEFAULT_SPACING: ElementSpacing = { margin: ZERO_EDGES, padding: ZERO_EDGES };

export function getElementSpacing(node: { spacing?: ElementSpacing }): ElementSpacing {
  return node.spacing ?? DEFAULT_SPACING;
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

/** Applies clampSpacingValue to all four edges, discarding the whole update (returning null) if any single value is invalid — an EdgeValues commit is atomic, never partially applied. */
export function clampEdgeValues(edges: EdgeValues): EdgeValues | null {
  const top = clampSpacingValue(edges.top);
  const right = clampSpacingValue(edges.right);
  const bottom = clampSpacingValue(edges.bottom);
  const left = clampSpacingValue(edges.left);
  if (top === null || right === null || bottom === null || left === null) return null;
  return { top, right, bottom, left };
}

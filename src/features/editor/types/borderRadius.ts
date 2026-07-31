/**
 * Border radius for any radius-capable node (Checkpoint 4.5) — same
 * grouped, fully-optional settings-object shape border.ts established
 * (see EditorElementNode.borderRadius) rather than adding four separate
 * optional fields directly onto the node.
 *
 * Deliberately does NOT include an `all`/`allRadius` field alongside the
 * four corners, for the exact same reason border.ts's BorderSettings
 * doesn't: storing both creates an unresolvable "which wins" ambiguity
 * if they disagree. This mirrors BorderSettings (and, before it,
 * spacing.ts's ElementSpacing) exactly — always store every corner
 * independently; "Unified vs Individual" is purely local Inspector UI
 * state (see InspectorBorderRadiusSection's `mode`, derived the same way
 * InspectorBorderSection's own mode is, via a structural "are all four
 * corners equal" check), never persisted, never a second representation
 * of the same data.
 */

import type { CssLengthValue, CssUnit } from "@/features/editor/types/typography";

export type BorderRadiusCorner = "topLeft" | "topRight" | "bottomRight" | "bottomLeft";

export const BORDER_RADIUS_CORNERS: readonly BorderRadiusCorner[] = [
  "topLeft",
  "topRight",
  "bottomRight",
  "bottomLeft",
];

/** px/rem/em/% — a % radius is valid, standard CSS (Checkpoint 4.5's #5); unlike border width, which never accepts %. */
export const BORDER_RADIUS_UNITS: readonly CssUnit[] = ["px", "rem", "em", "%"];

export interface BorderRadiusSettings {
  topLeft?: CssLengthValue;
  topRight?: CssLengthValue;
  bottomRight?: CssLengthValue;
  bottomLeft?: CssLengthValue;
}

/** A node with no radius set renders with no border-radius CSS at all — see resolveBorderRadiusStyle. */
export function getBorderRadiusSettings(node: { borderRadius?: BorderRadiusSettings }): BorderRadiusSettings {
  return node.borderRadius ?? {};
}

export function getBorderRadiusCorner(radius: BorderRadiusSettings, corner: BorderRadiusCorner): CssLengthValue | undefined {
  return radius[corner];
}

function cornerKey(value: CssLengthValue | undefined): string {
  return value ? `${value.value}${value.unit}` : "";
}

/**
 * True when every corner holds an identical (or identically absent)
 * value — the same "does this already look uniform" heuristic
 * border.ts's borderSidesEqual uses, applied to corners instead of
 * sides. Used once, per freshly-selected node, to decide which
 * Inspector mode ("Unified"/"Individual Corners") to default into.
 */
export function borderRadiusCornersEqual(radius: BorderRadiusSettings): boolean {
  const [topLeft, topRight, bottomRight, bottomLeft] = BORDER_RADIUS_CORNERS.map((corner) => radius[corner]);
  const key = cornerKey(topLeft);
  return cornerKey(topRight) === key && cornerKey(bottomRight) === key && cornerKey(bottomLeft) === key;
}

/** Sets (or, with `value` undefined, clears) one corner — collapses the whole BorderRadiusSettings to `undefined` once every corner is empty, matching every other settings object's "unset" convention. */
export function withBorderRadiusCorner(
  radius: BorderRadiusSettings,
  corner: BorderRadiusCorner,
  value: CssLengthValue | undefined,
): BorderRadiusSettings | undefined {
  const next: BorderRadiusSettings = { ...radius, [corner]: value };
  if (value === undefined) delete next[corner];
  return Object.keys(next).length > 0 ? next : undefined;
}

/**
 * Writes the same value to all four corners in a single commit
 * (Checkpoint 4.5's "Unified" editing mode — one interaction, one
 * history entry) — the direct counterpart of border.ts's
 * withBorderAllSidesField.
 */
export function withBorderRadiusAllCorners(value: CssLengthValue | undefined): BorderRadiusSettings | undefined {
  if (value === undefined) return undefined;
  return { topLeft: value, topRight: value, bottomRight: value, bottomLeft: value };
}

/** Border radius must be finite and non-negative — zero is a valid, explicit "square corner" choice, not rejected like a negative value would be (Checkpoint 4.5's #5). */
export function isValidBorderRadiusValue(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

/** Defensive shape check for a value that might be malformed loaded-document data — never throws, never repairs; see resolveBorderRadiusStyle. */
export function isValidBorderRadiusCornerValue(value: unknown): value is CssLengthValue {
  if (typeof value !== "object" || value === null) return false;
  const corner = value as Partial<CssLengthValue>;
  return typeof corner.value === "number" && isValidBorderRadiusValue(corner.value) && typeof corner.unit === "string";
}

/**
 * Quick-apply radius presets (Checkpoint 4.5's #8) — each applies one
 * value to all four corners in one commit, exactly like a preset never
 * touches unrelated fields there is nothing else to preserve here (a
 * corner is a single length value, not a multi-field object like
 * BorderSideSettings), so unlike applyBorderPreset there is no
 * "preserve the other fields" concern.
 *
 * Circle is deliberately `50%` on every corner rather than any
 * measurement-based, size-clamping, or aspect-ratio-locking strategy —
 * standard CSS `border-radius: 50%` semantics apply each corner's
 * radius as 50% of its *own* box's width (horizontal component) and
 * height (vertical component) independently, so a non-square element
 * renders as an ellipse, not a forced circle. This is the same behavior
 * any CSS author already expects from `border-radius: 50%`, is fully
 * predictable without reading the element's rendered size, and never
 * silently resizes or reshapes the element to force true circularity —
 * which would be a much larger, undisclosed side effect for what the
 * brief frames as a convenience action. The preset is always available
 * regardless of the element's current shape (never conditionally
 * hidden), since gating it on a live measurement would require this
 * pure, resolver-adjacent model to depend on rendered DOM geometry.
 *
 * Pill uses a large fixed pixel value (9999px) rather than a percentage
 * for the same reason `border-radius: 9999px` is the standard "pill
 * button" idiom: the CSS radius-rendering algorithm automatically scales
 * every corner's radius down proportionally once the combined radii
 * would exceed the box's own size, so an oversized fixed value reliably
 * produces "fully rounded on the short axis" at any element size without
 * needing to know that size in advance — unlike a percentage, which
 * would need to already be size-aware to guarantee full rounding.
 */
export type BorderRadiusPreset = "none" | "small" | "medium" | "large" | "pill" | "circle";

const BORDER_RADIUS_PRESET_VALUES: Record<Exclude<BorderRadiusPreset, "none">, CssLengthValue> = {
  small: { value: 4, unit: "px" },
  medium: { value: 8, unit: "px" },
  large: { value: 16, unit: "px" },
  pill: { value: 9999, unit: "px" },
  circle: { value: 50, unit: "%" },
};

export function applyBorderRadiusPreset(preset: BorderRadiusPreset): BorderRadiusSettings | undefined {
  if (preset === "none") return undefined;
  return withBorderRadiusAllCorners(BORDER_RADIUS_PRESET_VALUES[preset]);
}

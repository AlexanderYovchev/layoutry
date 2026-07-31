/**
 * Border styling for any border-capable node (Checkpoint 4.4) — same
 * grouped, fully-optional settings-object shape typography/background
 * already established (see EditorElementNode.border) rather than adding a
 * dozen separate optional fields directly onto the node.
 *
 * Deliberately does NOT include the brief's illustrative `all` field
 * alongside `top`/`right`/`bottom`/`left` — storing both would create the
 * exact "duplicated fields" ambiguity the brief warns against (if `all`
 * and `top` were both populated, which wins?). Instead this mirrors
 * spacing.ts's own proven precedent: ElementSpacing always stores four
 * independent EdgeValues, and "linked" (here: "All Sides" vs "Individual
 * Sides") is purely an Inspector-local UI affordance (see
 * InspectorBorderSection's `mode` state, derived the same way
 * InspectorSpacingSection's EdgeGroup derives its own `linked` state via
 * borderSidesEqual) that decides whether editing one field writes it to
 * all four sides at once or to a single selected side — never a second
 * stored representation of the same data. This also generalizes cleanly
 * to a future per-corner Border Radius (a similar four-value object, just
 * keyed by corner instead of side) and a future single, non-per-side
 * Outline (which can reuse BorderSideSettings verbatim) without any
 * migration of this shape.
 */

import type { CssLengthValue } from "@/features/editor/types/typography";
import { isValidCssColor } from "@/features/editor/utils/cssColor";

export type BorderStyleValue =
  | "none"
  | "solid"
  | "dashed"
  | "dotted"
  | "double"
  | "groove"
  | "ridge"
  | "inset"
  | "outset";

export const BORDER_STYLE_VALUES: readonly BorderStyleValue[] = [
  "none",
  "solid",
  "dashed",
  "dotted",
  "double",
  "groove",
  "ridge",
  "inset",
  "outset",
];

export type BorderSide = "top" | "right" | "bottom" | "left";

export const BORDER_SIDES: readonly BorderSide[] = ["top", "right", "bottom", "left"];

/**
 * One side's border — width/style/color, each independently optional with
 * no synthesized default (matching TypographySettings's philosophy: an
 * unset field stays genuinely absent, deferring to the browser's own
 * initial values, rather than this model inventing "medium"/"none"/
 * "currentcolor" defaults that were never explicitly chosen).
 */
export interface BorderSideSettings {
  width?: CssLengthValue;
  style?: BorderStyleValue;
  /** Any valid CSS color string — see isValidCssColor. Absent means the browser's own `currentcolor` initial value applies. */
  color?: string;
}

export interface BorderSettings {
  top?: BorderSideSettings;
  right?: BorderSideSettings;
  bottom?: BorderSideSettings;
  left?: BorderSideSettings;
}

const EMPTY_SIDE: BorderSideSettings = {};

/** A node with no border set renders with no border CSS at all — the tag's own Tailwind chrome classes (or lack of any) govern until an explicit BorderSettings exists; see resolveBorderStyle and ContainerElement/ImageElement's `hasExplicitBorder` gate. */
export function getBorderSettings(node: { border?: BorderSettings }): BorderSettings {
  return node.border ?? {};
}

export function getBorderSide(border: BorderSettings, side: BorderSide): BorderSideSettings {
  return border[side] ?? EMPTY_SIDE;
}

/**
 * True when every side's settings are structurally identical (including
 * all four being entirely unset) — the same "does this look uniform"
 * heuristic InspectorSpacingSection's EdgeGroup uses (there, numeric
 * equality; here, a deep-ish compare across width/style/color) to decide
 * whether the Inspector's mode toggle should default to "All Sides" for a
 * freshly-selected node, without persisting that decision anywhere.
 */
export function borderSidesEqual(border: BorderSettings): boolean {
  const [top, right, bottom, left] = BORDER_SIDES.map((side) => getBorderSide(border, side));
  const sideKey = (side: BorderSideSettings) =>
    JSON.stringify([side.width?.value, side.width?.unit, side.style, side.color]);
  const topKey = sideKey(top);
  return sideKey(right) === topKey && sideKey(bottom) === topKey && sideKey(left) === topKey;
}

/**
 * Produces the next BorderSideSettings after setting (or, with `value`
 * undefined, resetting) exactly one field on a single side — same
 * collapse-to-undefined-once-empty convention as withTypographyField.
 */
export function withBorderSideField<K extends keyof BorderSideSettings>(
  current: BorderSideSettings,
  field: K,
  value: BorderSideSettings[K],
): BorderSideSettings | undefined {
  const next: BorderSideSettings = { ...current, [field]: value };
  if (value === undefined) delete next[field];
  return Object.keys(next).length > 0 ? next : undefined;
}

/** Replaces (or, with `settings` undefined, clears) one side's entire BorderSideSettings — collapses the whole BorderSettings to `undefined` once every side is empty, matching every other settings object's "unset" convention. */
export function withBorderSide(
  border: BorderSettings,
  side: BorderSide,
  settings: BorderSideSettings | undefined,
): BorderSettings | undefined {
  const next: BorderSettings = { ...border, [side]: settings };
  if (settings === undefined) delete next[side];
  return Object.keys(next).length > 0 ? next : undefined;
}

/**
 * Writes one field to all four sides in a single commit (Checkpoint
 * 4.4's "All Sides" editing mode — one interaction, one history entry).
 * Each side keeps its own other fields untouched, only `field` is
 * overwritten uniformly — so switching to Unified mode after Individual
 * editing left the sides different never destroys a side's unrelated
 * settings, only whichever single field was just edited.
 */
export function withBorderAllSidesField<K extends keyof BorderSideSettings>(
  border: BorderSettings,
  field: K,
  value: BorderSideSettings[K],
): BorderSettings | undefined {
  const next: BorderSettings = {};
  for (const side of BORDER_SIDES) {
    const sideResult = withBorderSideField(getBorderSide(border, side), field, value);
    if (sideResult !== undefined) next[side] = sideResult;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

/**
 * A quick-apply border preset (Checkpoint 4.4's #10) — width + style only,
 * deliberately never color: a preset changing an already-chosen border
 * color out from under the user would be a surprising side effect for a
 * "convenience action," so each side's existing color (or its absence,
 * which resolves to the browser's own currentcolor) is always preserved.
 * `null` represents the "None" preset, clearing the border entirely.
 */
export type BorderPreset = "none" | "thin" | "medium" | "thick" | "outline";

const BORDER_PRESET_VALUES: Record<Exclude<BorderPreset, "none">, { width: CssLengthValue; style: BorderStyleValue }> = {
  thin: { width: { value: 1, unit: "px" }, style: "solid" },
  medium: { width: { value: 2, unit: "px" }, style: "solid" },
  thick: { width: { value: 4, unit: "px" }, style: "solid" },
  outline: { width: { value: 2, unit: "px" }, style: "dashed" },
};

/** Applies a named preset to all four sides in one commit, preserving each side's existing color — see BorderPreset's doc comment. */
export function applyBorderPreset(border: BorderSettings, preset: BorderPreset): BorderSettings | undefined {
  if (preset === "none") return undefined;
  const { width, style } = BORDER_PRESET_VALUES[preset];
  let next: BorderSettings = border;
  for (const side of BORDER_SIDES) {
    const current = getBorderSide(next, side);
    next = { ...next, [side]: { ...current, width, style } };
  }
  return next;
}

/** Border width must be finite and non-negative — zero is a deliberate, valid choice ("no visible border," Checkpoint 4.4's #5), not rejected like a negative or non-finite value would be. */
export function isValidBorderWidthValue(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

export function isValidBorderStyleValue(value: string): value is BorderStyleValue {
  return (BORDER_STYLE_VALUES as readonly string[]).includes(value);
}

/**
 * Defensive validation for a value that might be malformed loaded-document
 * data (Checkpoint 4.4's #12 — "malformed loaded documents should safely
 * omit invalid border CSS," never throw). Never repairs; a side that fails
 * this check is skipped entirely by resolveBorderStyle rather than having
 * its valid fields partially rendered.
 */
export function isValidBorderSideSettings(value: unknown): value is BorderSideSettings {
  if (typeof value !== "object" || value === null) return false;
  const side = value as Record<string, unknown>;

  if ("width" in side && side.width !== undefined) {
    const width = side.width as Partial<CssLengthValue> | undefined;
    if (
      typeof width !== "object" ||
      width === null ||
      typeof width.value !== "number" ||
      !isValidBorderWidthValue(width.value) ||
      typeof width.unit !== "string"
    ) {
      return false;
    }
  }

  if ("style" in side && side.style !== undefined && !isValidBorderStyleValue(side.style as string)) return false;
  if ("color" in side && side.color !== undefined && !isValidCssColor(side.color as string)) return false;

  return true;
}

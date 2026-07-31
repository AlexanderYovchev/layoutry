/**
 * Visual effects (CSS filters) for any filter-capable node (Checkpoint
 * 4.7) — same grouped, fully-optional settings-object shape typography/
 * background/border/borderRadius/boxShadow already established (see
 * EditorElementNode.filters), rather than adding nine separate optional
 * fields directly onto the node. Like typography, no field here has a
 * synthesized default: there is no single sensible "default brightness"
 * across every tag, so an unset field must stay genuinely absent — see
 * getFilterSettings/withFilterField, and resolveFilterStyle, which only
 * emits CSS for fields actually present.
 *
 * Every field but `opacity` is a plain number rather than a value+unit
 * pair (departing from the brief's own illustrative model, which showed
 * `blur?: CssLengthValue` and `hueRotate?: CssAngleValue`):
 *
 *   - blur IS a CssLengthValue (px/rem/em) — a real length, exactly like
 *     Box Shadow's own blur field (see types/boxShadow.ts).
 *   - hueRotate is a plain `number` in degrees, NOT wrapped in a unit
 *     object — this app already has a precedent for a bare-degree angle
 *     (gradient.ts's LinearGradientSettings.angle), and hue-rotate is
 *     cyclic in the exact same way a gradient angle is (370deg and 10deg
 *     render identically) — see normalizeHueRotateValue below, which
 *     reuses gradient.ts's own normalizeGradientAngle rather than
 *     duplicating its wrap-into-[0,360) logic. Introducing a new
 *     CssAngleValue wrapper type would add a unit dropdown with exactly
 *     one real option ("deg") and no UI benefit — this checkpoint's own
 *     value-range spec never asks for grad/rad/turn.
 *   - opacity/brightness/contrast/saturate/grayscale/invert/sepia are all
 *     plain numbers representing a CSS percentage (e.g. `brightness: 150`
 *     means `brightness(150%)`) — matching the brief's own illustrative
 *     model exactly for these seven fields, and letting the resolver
 *     format every one of them the same way (see formatFilterFunctionCss).
 */

import { normalizeGradientAngle } from "@/features/editor/types/gradient";
import type { CssLengthValue, CssUnit } from "@/features/editor/types/typography";

/** px/rem/em only — CSS filter blur-radius is a `<length>`, never a `<percentage>`, matching box-shadow's own blur field (see SHADOW_LENGTH_UNITS). */
export const FILTER_BLUR_UNITS: readonly CssUnit[] = ["px", "rem", "em"];

export interface FilterSettings {
  /** Rendered via the standalone CSS `opacity` property, NOT the `filter: opacity()` function — see resolveFilterStyle's own doc comment for why. 0-100, a percentage. */
  opacity?: number;
  blur?: CssLengthValue;
  /** Percentage; CSS allows any non-negative value (no fixed upper bound — this checkpoint's "0-300%" is a suggested typical UI range, not a hard CSS ceiling). */
  brightness?: number;
  contrast?: number;
  saturate?: number;
  /** Percentage, hard-capped at 100 — grayscale/invert/sepia are true 0-100% effects; anything past full strength has no further visual meaning. */
  grayscale?: number;
  /** Degrees — cyclic, like a gradient angle; see this file's own doc comment. */
  hueRotate?: number;
  invert?: number;
  sepia?: number;
}

/** A node with no filters set renders with no `filter`/`opacity` CSS at all — the tag's own presentation governs, exactly like typography/background. */
export function getFilterSettings(node: { filters?: FilterSettings }): FilterSettings {
  return node.filters ?? {};
}

/**
 * Produces the next FilterSettings after setting (or, with `value`
 * undefined, resetting) exactly one field — collapses to `undefined`
 * (not `{}`) once every field has been cleared, matching every other
 * settings object's "unset" convention (see withTypographyField).
 */
export function withFilterField<K extends keyof FilterSettings>(
  current: FilterSettings,
  field: K,
  value: FilterSettings[K],
): FilterSettings | undefined {
  const next: FilterSettings = { ...current, [field]: value };
  if (value === undefined) delete next[field];
  return Object.keys(next).length > 0 ? next : undefined;
}

/** Opacity is a true 0-100% property — anything outside that range has no meaningful CSS rendering and is rejected outright, never clamped. */
export function isValidOpacityValue(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 100;
}

/** Blur radius must be non-negative, matching Box Shadow's own isValidShadowBlurValue. */
export function isValidBlurValue(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

/** Brightness/contrast/saturate accept any non-negative percentage — CSS itself imposes no upper bound (see this file's own doc comment). */
export function isValidBrightnessValue(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

export function isValidContrastValue(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

export function isValidSaturateValue(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

/** Grayscale is a true 0-100% effect — rejected outside that range, never clamped. */
export function isValidGrayscaleValue(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 100;
}

/** Defensive check only (is this even a real number) — the Inspector never rejects a hue-rotate angle, it normalizes it instead; see normalizeHueRotateValue. */
export function isValidHueRotateValue(value: number): boolean {
  return Number.isFinite(value);
}

export function isValidInvertValue(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 100;
}

export function isValidSepiaValue(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 100;
}

/** Wraps a hue-rotate angle into [0, 360) — angles are cyclic (370deg and 10deg render identically), so a typed value outside 0-360 is normalized rather than rejected, exactly like gradient.ts's own normalizeGradientAngle, which this reuses directly rather than duplicating. */
export function normalizeHueRotateValue(value: number): number {
  return normalizeGradientAngle(value);
}

/**
 * Defensive per-field check for a value that might be malformed loaded-
 * document data (this app has no persistence/import feature yet, but the
 * resolver must still never throw on bad data — Checkpoint 4.7's #8).
 * Deliberately per-*field*, not a single whole-object gate: unlike Box
 * Shadow's isValidShadowLayer (which validates one entire list item,
 * since a layer's fields are meaningless in isolation), FilterSettings'
 * nine fields are fully independent CSS properties — one malformed field
 * must not suppress every other, still-valid field in the same settings
 * object (this checkpoint's own explicit "remaining valid filters should
 * still render" requirement). See resolveFilterStyle, which calls this
 * once per field rather than once for the whole object.
 */
export function isValidFilterFieldValue<K extends keyof FilterSettings>(field: K, value: unknown): boolean {
  if (field === "blur") {
    if (typeof value !== "object" || value === null) return false;
    const length = value as Partial<CssLengthValue>;
    return typeof length.value === "number" && isValidBlurValue(length.value) && typeof length.unit === "string";
  }
  if (typeof value !== "number") return false;
  switch (field) {
    case "opacity":
      return isValidOpacityValue(value);
    case "brightness":
      return isValidBrightnessValue(value);
    case "contrast":
      return isValidContrastValue(value);
    case "saturate":
      return isValidSaturateValue(value);
    case "grayscale":
      return isValidGrayscaleValue(value);
    case "hueRotate":
      return isValidHueRotateValue(value);
    case "invert":
      return isValidInvertValue(value);
    case "sepia":
      return isValidSepiaValue(value);
    default:
      return false;
  }
}

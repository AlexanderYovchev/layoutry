/**
 * Background styling for any background-capable node (Checkpoint 4.3) —
 * same grouped, fully-optional settings-object shape typography/mediaFit/
 * spacing already established (see EditorElementNode.background) rather
 * than adding six separate optional fields directly onto the node. Like
 * typography (and unlike mediaFit), no field here has a synthesized
 * default: there is no single sensible "default background color" or
 * "default position," so an unset field must stay genuinely absent — see
 * getBackgroundSettings/withBackgroundField, and resolveBackgroundStyle,
 * which only emits CSS for fields actually present.
 *
 * Deliberately the smallest model that covers one solid color plus one
 * image layer — see this file's own doc comments on BackgroundSettings
 * for the specific future extension seams (gradients, multiple layers)
 * this shape was chosen to leave open without needing a migration.
 */

import type { CssUnit } from "@/features/editor/types/typography";

export type BackgroundSizeMode = "auto" | "cover" | "contain" | "custom";

/**
 * One axis (width or height) of a Custom background-size — either the
 * "auto" keyword or an explicit length, matching CSS's own
 * `background-size: <axis> <axis>` grammar where each axis independently
 * may be `auto` or a length/percentage (e.g. `auto 200px`). Never
 * converts between units on its own — see InspectorUnitSelect.
 */
export type BackgroundSizeAxisValue = { value: number; unit: CssUnit } | "auto";

export interface BackgroundCustomSize {
  width: BackgroundSizeAxisValue;
  height: BackgroundSizeAxisValue;
}

/**
 * The nine-point beginner grid (Checkpoint 4.3's required control). A
 * flat string union rather than a discriminated union up front —
 * deliberately, since a future free-form position only needs to *widen*
 * this type (e.g. `BackgroundPosition = BackgroundPosition | { x: ...; y:
 * ... }`); every preset value already stored in a document stays a valid
 * member of the widened type, so no migration of existing data is ever
 * required. See this checkpoint's non-goals: free X/Y controls are not
 * implemented yet, only designed for.
 */
export type BackgroundPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center-left"
  | "center"
  | "center-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export type BackgroundRepeat = "no-repeat" | "repeat" | "repeat-x" | "repeat-y" | "space" | "round";

export type BackgroundAttachment = "scroll" | "fixed" | "local";

export interface BackgroundSettings {
  /** Any valid CSS color string — see isValidCssColor (editor/utils/cssColor.ts) for what this model accepts. */
  color?: string;
  /** A single background-image URL/path — see isValidBackgroundImageUrl. No gradients or multiple layers yet (see this checkpoint's non-goals). */
  image?: string;
  /** Only meaningful once `image` is set (size/position/repeat/attachment all render as not-applicable in the Inspector until then — see InspectorBackgroundSection). "auto" is an explicit, deliberate choice distinct from this field being entirely absent (unset). */
  size?: BackgroundSizeMode;
  /** Only meaningful while size === "custom" — see withBackgroundSize, which keeps this coupled field in sync. */
  customSize?: BackgroundCustomSize;
  position?: BackgroundPosition;
  repeat?: BackgroundRepeat;
  attachment?: BackgroundAttachment;
}

/** A node with no background set renders with no background CSS at all — the tag's own Tailwind classes (or lack of any) govern, exactly like typography. */
export function getBackgroundSettings(node: { background?: BackgroundSettings }): BackgroundSettings {
  return node.background ?? {};
}

/**
 * Produces the next BackgroundSettings after setting (or, with `value`
 * undefined, resetting) exactly one field — collapses to `undefined` (not
 * `{}`) once every field has been cleared, matching typography's
 * withTypographyField. Not used for `size`/`customSize`, which are
 * coupled — see withBackgroundSize.
 */
export function withBackgroundField<K extends Exclude<keyof BackgroundSettings, "size" | "customSize">>(
  current: BackgroundSettings,
  field: K,
  value: BackgroundSettings[K],
): BackgroundSettings | undefined {
  const next: BackgroundSettings = { ...current, [field]: value };
  if (value === undefined) delete next[field];
  return Object.keys(next).length > 0 ? next : undefined;
}

/**
 * Sets `size` and `customSize` together in one write — the only two
 * fields in this model that are not independent (customSize is only
 * meaningful alongside size === "custom"). Switching to a non-custom mode
 * (or resetting size entirely, via `size: undefined`) always clears
 * customSize in the same write, so a stale customSize can never survive
 * behind a mode that no longer uses it.
 */
export function withBackgroundSize(
  current: BackgroundSettings,
  size: BackgroundSizeMode | undefined,
  customSize?: BackgroundCustomSize,
): BackgroundSettings | undefined {
  const next: BackgroundSettings = { ...current, size, customSize: size === "custom" ? customSize : undefined };
  if (next.size === undefined) delete next.size;
  if (next.customSize === undefined) delete next.customSize;
  return Object.keys(next).length > 0 ? next : undefined;
}

/** Renders one Custom background-size axis into CSS text — "auto" passes through verbatim, a length uses formatCssLength. */
export function formatBackgroundSizeAxis(axis: BackgroundSizeAxisValue): string {
  if (axis === "auto") return "auto";
  return axis.unit === "unitless" ? String(axis.value) : `${axis.value}${axis.unit}`;
}

/** A Custom size axis length must be a positive, finite number — zero or negative collapses the background entirely and is rejected outright rather than clamped. */
export function isValidBackgroundSizeValue(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

// A real URL/path never contains literal whitespace, quote, backtick, or
// backslash characters — rejecting those catches obviously-malformed
// input (including anything that could otherwise break out of the
// generated CSS url("...") string) without being stricter than genuine
// URLs/paths ever need to be. Deliberately permissive beyond that: this
// is syntax validation, not a guarantee the resource will load (see
// resolveBackgroundStyle and this checkpoint's report for the
// syntax-vs-load distinction) — a bare relative path like "hero.jpg" is
// just as valid here as "https://example.com/hero.jpg".
const IMAGE_URL_FORBIDDEN_CHARACTERS = /[\s"'`\\]/;

/** Syntactic validation only — never confirms the image actually loads (see #12/#15 of this checkpoint's brief). Accepts absolute http(s)/data/blob URLs, protocol-relative URLs, and project-relative paths; rejects anything containing whitespace or a character that could break out of the generated CSS string. */
export function isValidBackgroundImageUrl(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === "") return false;
  return !IMAGE_URL_FORBIDDEN_CHARACTERS.test(trimmed);
}

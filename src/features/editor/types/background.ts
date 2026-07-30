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
import type { GradientSettings } from "@/features/editor/types/gradient";

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

/** Shared by `background-position` (resolveBackgroundStyle) and a Radial gradient's `at <position>` (gradient.ts's formatRadialGradientCss) — both accept the identical CSS position keyword-pair syntax, so this mapping is owned once, here, alongside the type it maps. */
export const BACKGROUND_POSITION_CSS: Record<BackgroundPosition, string> = {
  "top-left": "left top",
  "top-center": "center top",
  "top-right": "right top",
  "center-left": "left center",
  center: "center",
  "center-right": "right center",
  "bottom-left": "left bottom",
  "bottom-center": "center bottom",
  "bottom-right": "right bottom",
};

export type BackgroundRepeat = "no-repeat" | "repeat" | "repeat-x" | "repeat-y" | "space" | "round";

export type BackgroundAttachment = "scroll" | "fixed" | "local";

/**
 * Which visual background-image source is active (Checkpoint 4.3.1) —
 * an element may use one at a time (a URL image or a gradient), never
 * both simultaneously (see this checkpoint's non-goals on layering).
 * Absent (undefined) means neither is active — see
 * getActiveBackgroundSource for the one place "which source renders"
 * is actually decided, including the backward-compatibility fallback
 * for a Checkpoint 4.3 document that has `image` set but predates this
 * field entirely.
 */
export type BackgroundSourceType = "image" | "gradient";

export interface BackgroundSettings {
  /** Any valid CSS color string — see isValidCssColor (editor/utils/cssColor.ts) for what this model accepts. Always independent of sourceType — a solid color can sit beneath either an image or a gradient, or exist entirely on its own. */
  color?: string;
  /** Which of `image`/`gradient` is currently active — see BackgroundSourceType and getActiveBackgroundSource. Switching this alone never touches `image` or `gradient` (Checkpoint 4.3.1's #2 — inactive source data is preserved so exploring one source never loses another's configuration). */
  sourceType?: BackgroundSourceType;
  /** A single background-image URL/path — see isValidBackgroundImageUrl. Only rendered while sourceType is (or falls back to) "image" — see resolveBackgroundStyle. */
  image?: string;
  /** Only meaningful once `image` is the active source (size/position/repeat/attachment all render as not-applicable in the Inspector until then — see InspectorBackgroundImageControls). "auto" is an explicit, deliberate choice distinct from this field being entirely absent (unset). */
  size?: BackgroundSizeMode;
  /** Only meaningful while size === "custom" — see withBackgroundSize, which keeps this coupled field in sync. */
  customSize?: BackgroundCustomSize;
  position?: BackgroundPosition;
  repeat?: BackgroundRepeat;
  attachment?: BackgroundAttachment;
  /** The structured gradient value — see types/gradient.ts. Only rendered while sourceType === "gradient"; preserved (not cleared) while `image` is active, so switching back to Gradient later restores it exactly — see withBackgroundGradientSource/withBackgroundGradientReset. */
  gradient?: GradientSettings;
}

/** A node with no background set renders with no background CSS at all — the tag's own Tailwind classes (or lack of any) govern, exactly like typography. */
export function getBackgroundSettings(node: { background?: BackgroundSettings }): BackgroundSettings {
  return node.background ?? {};
}

/**
 * The one place "which source actually renders" is decided (Checkpoint
 * 4.3.1) — used by both resolveBackgroundStyle (Canvas) and the
 * Inspector's own source selector, so they can never disagree. An
 * explicit `sourceType` always wins. Its absence falls back to "image"
 * if `image` happens to be set — the only way a Checkpoint 4.3 document
 * (written before `sourceType` existed) keeps rendering exactly as
 * before without any migration: every such document has at most one
 * background-image-like field (`image`), so "image is set" was already
 * an unambiguous, correct signal for "image is active" before this
 * checkpoint introduced the explicit field.
 */
export function getActiveBackgroundSource(background: BackgroundSettings): BackgroundSourceType | undefined {
  if (background.sourceType) return background.sourceType;
  if (background.image) return "image";
  return undefined;
}

/**
 * Activates Gradient as the source and sets its data in the same write
 * (Checkpoint 4.3.1's #4 — "one coherent document change," never a
 * separate commit for "turn on Gradient" then another for "fill in
 * default stops"). The caller decides what `gradient` to pass — either
 * a freshly-built default (getBackgroundSettings(node).gradient was
 * absent) or the previously-stored one (reactivating Gradient after
 * exploring Image), per #2's preservation rule.
 */
export function withBackgroundGradientSource(current: BackgroundSettings, gradient: GradientSettings): BackgroundSettings {
  return { ...current, sourceType: "gradient", gradient };
}

/**
 * Reset Gradient (Checkpoint 4.3.1's #19) — removes the stored gradient
 * entirely and returns the active source to None (never silently falls
 * back to a stored Image, even if one exists — the brief presents both
 * as valid choices and this is the one explicitly recommended: a
 * predictable, single rule rather than one that depends on what else
 * happens to be stored). A stored `image` is untouched either way.
 */
export function withBackgroundGradientReset(current: BackgroundSettings): BackgroundSettings | undefined {
  const next: BackgroundSettings = { ...current };
  delete next.gradient;
  if (next.sourceType === "gradient") delete next.sourceType;
  return Object.keys(next).length > 0 ? next : undefined;
}

/**
 * Produces the next BackgroundSettings after setting (or, with `value`
 * undefined, resetting) exactly one field — collapses to `undefined` (not
 * `{}`) once every field has been cleared, matching typography's
 * withTypographyField. Not used for `size`/`customSize` (coupled — see
 * withBackgroundSize) or `gradient` (coupled with `sourceType` — see
 * withBackgroundGradientSource/withBackgroundGradientReset). `sourceType`
 * itself IS set through this generic helper when switching to "image" or
 * clearing to "none" — only switching *to* "gradient" needs the dedicated
 * helper, since that's the one direction that must also supply data.
 */
export function withBackgroundField<K extends Exclude<keyof BackgroundSettings, "size" | "customSize" | "gradient">>(
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

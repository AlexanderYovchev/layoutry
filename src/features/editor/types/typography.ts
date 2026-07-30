/**
 * Text styling for any text-bearing node (Checkpoint 4.2) — one grouped,
 * fully-optional settings object (see EditorElementNode.typography),
 * matching the same shape spacing/mediaFit/flowLayout already established
 * rather than adding eight separate optional fields directly onto the
 * node. Unlike those, every field here is independently optional with no
 * synthesized default: there is no single sensible "default font size" or
 * "default color" across every tag (an h1 and a p render nothing alike),
 * so an unset field must stay genuinely absent — see getTypographySettings
 * and withTypographyField, which deliberately do NOT fill in defaults the
 * way getMediaFitSettings does. The visual "default" for an unset field is
 * whatever the element's own Tailwind classes already render (see
 * resolveTypographyStyle), not a value this model invents.
 */

/**
 * Every unit an Inspector numeric+unit control might offer across this
 * app's CSS properties — canonically owned here (the document-model
 * layer) rather than by the Inspector UI component that first needed a
 * "unit" concept (InspectorUnitSelect), since the document model itself
 * (this file's CssLengthValue) is what actually needs to serialize a
 * unit. InspectorUnitSelect/InspectorNumericValueControl re-export this
 * type rather than defining their own, so existing imports are unaffected.
 * "unitless" is not a real CSS unit suffix — see formatCssLength — but is
 * a selectable value in the unit dropdown for a property like line-height
 * that has a genuine unitless CSS syntax (e.g. `line-height: 1.5`).
 * "deg" was added in Checkpoint 4.3.1 for the Gradient angle control —
 * always its own single-option (non-dropdown) display, same as "%" for a
 * gradient stop's position, since no property here ever offers a choice
 * of angle units.
 */
export type CssUnit = "px" | "%" | "rem" | "em" | "vw" | "vh" | "unitless" | "deg";

export type FontWeight = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
export type FontStyleValue = "normal" | "italic" | "oblique";
export type TextAlign = "left" | "center" | "right" | "justify";

export interface CssLengthValue {
  value: number;
  unit: CssUnit;
}

export interface TypographySettings {
  fontFamily?: string;
  fontSize?: CssLengthValue;
  fontWeight?: FontWeight;
  fontStyle?: FontStyleValue;
  /** Any valid CSS color string — see isValidCssColor for what this model accepts. */
  color?: string;
  textAlign?: TextAlign;
  lineHeight?: CssLengthValue;
  letterSpacing?: CssLengthValue;
}

/** A node with no typography set renders using its own tag's default presentation (see resolveTypographyStyle) — there is no synthesized TypographySettings default here, unlike getMediaFitSettings. */
export function getTypographySettings(node: { typography?: TypographySettings }): TypographySettings {
  return node.typography ?? {};
}

/**
 * Produces the next TypographySettings after setting (or, with `value`
 * undefined, resetting) exactly one field — the single place that keeps
 * "absent means unset" true for the whole object, not just individual
 * fields: collapses to `undefined` (not `{}`) once every field has been
 * cleared, so a fully-reset node's `typography` is genuinely absent again,
 * matching every other settings object's "unset" convention. Every
 * Inspector Typography row's commit/reset handler goes through this
 * rather than hand-rolling its own spread-and-delete.
 */
export function withTypographyField<K extends keyof TypographySettings>(
  current: TypographySettings,
  field: K,
  value: TypographySettings[K],
): TypographySettings | undefined {
  const next: TypographySettings = { ...current, [field]: value };
  if (value === undefined) delete next[field];
  return Object.keys(next).length > 0 ? next : undefined;
}

/** Renders a CssLengthValue into its CSS text form — "unitless" contributes no suffix at all (e.g. line-height: 1.5), every other unit appends its literal CSS suffix. Never converts between units; see InspectorUnitSelect. */
export function formatCssLength(length: CssLengthValue): string {
  return length.unit === "unitless" ? String(length.value) : `${length.value}${length.unit}`;
}

/** Font size must be a positive, finite number — zero or negative renders nothing meaningful and is rejected outright rather than clamped to a guessed floor. */
export function isValidFontSize(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

/** Line height allows 0 (collapsed lines) but never negative. */
export function isValidLineHeight(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

/** Letter spacing allows negative values (tighter tracking) — only rejects non-finite input. */
export function isValidLetterSpacing(value: number): boolean {
  return Number.isFinite(value);
}

/**
 * Moved to editor/utils/cssColor.ts (Checkpoint 4.3) once Background
 * Color needed the identical validation — the logic was always generic
 * CSS-color syntax, never anything typography-specific. Re-exported here
 * so this file's existing import site (InspectorTypographySection) keeps
 * working unchanged.
 */
export { isValidCssColor } from "@/features/editor/utils/cssColor";

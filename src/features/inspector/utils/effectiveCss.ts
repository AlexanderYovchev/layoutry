import type { SharedValue } from "@/features/inspector/types/sharedValue";

/**
 * Effective CSS values for multi-selection Mixed detection (BC-10.3).
 *
 * The approved rule (BC-05.4 for Spacing, now for every section whose
 * values can differ by tag default or inheritance): compare what each
 * element EFFECTIVELY renders, not what was typed. The effective value of
 * a property for one element is:
 * 1. the browser-computed value of its rendered Canvas element, when it
 *    can be read (this covers tag defaults, inheritance, relative units
 *    and the cascade exactly as Preview and Export render them: the
 *    Canvas uses the same style recipes);
 * 2. otherwise its authored value, but only when that value is absolute
 *    (it can't depend on context, e.g. 16px or #ff0000, never 1em);
 * 3. otherwise unknown: never a default, 0 or "".
 *
 * Values are compared after normalization (normalizeCssValue). Browser-
 * computed values are already canonical (lengths in px, colours as
 * rgb()/rgba(), font weights as numbers), so normalization only aligns
 * an authored absolute value with that form and drops insignificant
 * formatting. Nothing relative is converted by hand.
 */

/** Computed values of the measured elements: element id → CSS property (kebab-case) → value. */
export type MeasuredStyles = ReadonlyMap<string, Readonly<Record<string, string>>>;

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function formatAlpha(alpha: number): string {
  return String(Math.round(Math.max(0, Math.min(1, alpha)) * 1000) / 1000);
}

/**
 * A colour in one canonical form, "rgba(r, g, b, a)", for the syntaxes
 * whose meaning is context-free: #rgb, #rgba, #rrggbb, #rrggbbaa, rgb(),
 * rgba() (comma or space syntax, with an optional "/ a") and
 * "transparent". Undefined for anything else (named colours, hsl, oklch,
 * color-mix, currentColor): those are compared as computed by the
 * browser, never guessed.
 */
export function normalizeCssColor(value: string): string | undefined {
  const text = value.trim().toLowerCase();
  if (text === "transparent") return "rgba(0, 0, 0, 0)";
  const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(text)?.[1];
  if (hex) {
    const full = hex.length <= 4 ? [...hex].map((digit) => digit + digit).join("") : hex;
    const [r, g, b] = [0, 2, 4].map((start) => Number.parseInt(full.slice(start, start + 2), 16));
    const a = full.length === 8 ? Number.parseInt(full.slice(6, 8), 16) / 255 : 1;
    return `rgba(${r}, ${g}, ${b}, ${formatAlpha(a)})`;
  }
  const functional = /^rgba?\(\s*([^)]*)\)$/.exec(text)?.[1];
  if (functional === undefined) return undefined;
  const parts = functional.split(/[\s,/]+/).filter((part) => part !== "");
  if (parts.length < 3 || parts.length > 4) return undefined;
  const channel = (part: string) => (part.endsWith("%") ? (Number.parseFloat(part) / 100) * 255 : Number.parseFloat(part));
  const alpha = (part: string | undefined) => (part === undefined ? 1 : part.endsWith("%") ? Number.parseFloat(part) / 100 : Number.parseFloat(part));
  const numbers = [channel(parts[0]), channel(parts[1]), channel(parts[2]), alpha(parts[3])];
  if (!numbers.every(Number.isFinite)) return undefined;
  return `rgba(${clampByte(numbers[0])}, ${clampByte(numbers[1])}, ${clampByte(numbers[2])}, ${formatAlpha(numbers[3])})`;
}

/** "16px", "16.00px" and "16.004px" → "16px" (2 decimals). Undefined for anything that isn't a plain px length. */
export function normalizeCssPx(value: string): string | undefined {
  const match = /^(-?\d*\.?\d+)px$/.exec(value.trim());
  if (!match) return undefined;
  return `${Math.round(Number.parseFloat(match[1]) * 100) / 100}px`;
}

export type CssValueKind = "length" | "color" | "keyword" | "number";

/** One canonical text per value kind. A value that can't be normalized is compared as trimmed text, exactly. */
export function normalizeCssValue(value: string, kind: CssValueKind): string {
  const text = value.trim();
  if (kind === "color") return normalizeCssColor(text) ?? text.toLowerCase();
  if (kind === "length") return normalizeCssPx(text) ?? text;
  if (kind === "number") {
    const number = Number(text);
    return Number.isFinite(number) ? String(number) : text;
  }
  return text.toLowerCase();
}

/** How to read one property's effective value off an element. */
export interface EffectiveProperty {
  /** The computed CSS properties read for this value, kebab-case (several for a per-side value). */
  cssProperties: readonly string[];
  kind: CssValueKind;
}

/**
 * One element's effective value for `property`, normalized: the measured
 * value(s) when every listed CSS property was read, else the authored
 * absolute value (`authoredAbsolute`, one per listed CSS property), else
 * undefined (unknown). Several properties (a border's four sides) are
 * joined: equal sides give that one value; unequal sides give a
 * "sides:…" token, so the element can't read as one shared value.
 */
export function effectiveValueOf(
  nodeId: string,
  property: EffectiveProperty,
  measured: MeasuredStyles | null,
  authoredAbsolute: () => readonly (string | undefined)[] | undefined,
): string | undefined {
  const row = measured?.get(nodeId);
  let values: (string | undefined)[] | undefined = row ? property.cssProperties.map((name) => row[name]) : undefined;
  if (!values || values.some((value) => value === undefined || value.trim() === "")) values = authoredAbsolute()?.slice();
  if (!values || values.length !== property.cssProperties.length || values.some((value) => value === undefined)) return undefined;
  const normalized = values.map((value) => normalizeCssValue(value as string, property.kind));
  return normalized.every((value) => value === normalized[0]) ? normalized[0] : `sides:${normalized.join("|")}`;
}

/**
 * Folds every element's effective value into a SharedValue:
 * - two different known values → "mixed" (even if others are unknown);
 * - otherwise any unknown value → "unresolved";
 * - otherwise one shared value → "same" with `toField(value)`, or
 *   "same-other" when the field can't show it (`toField` returns
 *   undefined), labelled with the value as CSS.
 */
export function resolveSharedEffective<T>(
  effectiveValues: readonly (string | undefined)[],
  toField: (normalized: string) => T | undefined,
): SharedValue<T> {
  const known = effectiveValues.filter((value): value is string => value !== undefined);
  const distinct = new Set(known);
  if (distinct.size > 1) return { kind: "mixed" };
  if (known.length < effectiveValues.length || known.length === 0) return { kind: "unresolved" };
  const [value] = known;
  const field = toField(value);
  if (field !== undefined) return { kind: "same", value: field };
  return { kind: "same-other", label: value.startsWith("sides:") ? "Varies by side" : value };
}

/** A shared px length as a number for a px field (undefined for "50%", "auto", per-side values...). */
export function pxFieldValue(normalized: string): number | undefined {
  const px = normalizeCssPx(normalized);
  return px === undefined ? undefined : Number.parseFloat(px);
}

/** "rgba(24, 24, 27, 1)" → "#18181b"; a translucent colour keeps its rgba() text; other syntaxes are shown as they are. */
export function colorFieldValue(normalized: string): string {
  const match = /^rgba\((\d+), (\d+), (\d+), ([\d.]+)\)$/.exec(normalized);
  if (!match) return normalized;
  const [r, g, b, a] = match.slice(1).map(Number);
  if (a === 1) return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
  return normalized;
}

/** An authored colour that means the same in any context (not currentColor, a CSS-wide keyword or a custom property). */
export function absoluteAuthoredColor(value: string | undefined): string | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  if (/^(currentcolor|inherit|initial|unset|revert(-layer)?)$/i.test(value.trim()) || /var\(/i.test(value)) return undefined;
  return value;
}

/**
 * A multi-selection row's state dot: "mixed" when the effective values
 * differ, else follows AUTHORED data ("set" when any element authors the
 * property), as BC-05.4's Spacing does. The shown value is effective; the
 * dot says whether anything was typed.
 */
export function effectiveRowState<T>(shared: SharedValue<T>, anyAuthored: boolean, error?: string): "invalid" | "mixed" | "set" | "unset" {
  if (error) return "invalid";
  if (shared.kind === "mixed") return "mixed";
  return anyAuthored ? "set" : "unset";
}

/** The authored text every element shares exactly (to show the author's own format, e.g. "#f00"), or undefined. */
export function commonAuthored(values: readonly (string | undefined)[]): string | undefined {
  const [first] = values;
  return first !== undefined && values.every((value) => value === first) ? first : undefined;
}

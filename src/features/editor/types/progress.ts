import type { CssLengthValue } from "@/features/editor/types/typography";

/**
 * The effective Max used whenever `progressMax` is unset or malformed
 * (Checkpoint 1.15.6.12.4) — an editor-level choice, not native HTML's own
 * obscure fallback (a bare `<progress>` with no `max` attribute defaults to
 * `1` in real Chromium, verified live this checkpoint), since this app's
 * own factory always stamps a concrete, useful starter Max anyway (see
 * createProgressNode) — this constant only matters for malformed/legacy
 * loaded data or an explicit Reset, where "1" would silently make a
 * perfectly ordinary authored Value look complete/overflowing.
 */
export const DEFAULT_PROGRESS_MAX = 100;

/**
 * The resolver-level "effective Max" for a Progress node (Checkpoint
 * 1.15.6.12.4) — the same DEFAULT_OBJECT_FIT/getMediaControls fallback
 * shape every other semantic field in this app already uses: the document
 * never stores a synthesized default, only the rendering/Inspector layer
 * supplies one. Guards against a non-finite or non-positive stored value
 * (native Max must be greater than zero — verified live) by falling back
 * to DEFAULT_PROGRESS_MAX rather than trusting malformed data; never
 * throws.
 */
export function getProgressMax(node: { progressMax?: number }): number {
  const max = node.progressMax;
  return max !== undefined && Number.isFinite(max) && max > 0 ? max : DEFAULT_PROGRESS_MAX;
}

/**
 * The resolver-level "effective Value" for a Progress node (Checkpoint
 * 1.15.6.12.4) — `undefined` is genuinely meaningful here (indeterminate,
 * see EditorElementNode.progressValue's own doc comment), so this
 * deliberately does NOT fall back to a number the way getProgressMax does.
 * A defined value is clamped to `[0, effective Max]` at render time as a
 * defensive guard against malformed/out-of-range loaded data (the document
 * itself may still hold an out-of-range value until the next commit — see
 * setElementProgressValue/setElementProgressMax, which clamp at write
 * time; this is the read-time safety net, never throws).
 */
export function getProgressValue(node: { progressValue?: number; progressMax?: number }): number | undefined {
  const value = node.progressValue;
  if (value === undefined || !Number.isFinite(value)) return undefined;
  const max = getProgressMax(node);
  return Math.min(Math.max(value, 0), max);
}

/**
 * The single source of truth for "is this Progress indeterminate"
 * (Checkpoint 1.15.6.12.4) — purely `progressValue === undefined`, exactly
 * matching native `<progress>`'s own indeterminate state (no `value`
 * attribute at all). No separate `progressIndeterminate` boolean exists
 * anywhere in the document model — see this checkpoint's own report for
 * why one was deliberately rejected.
 */
export function isProgressIndeterminate(node: { progressValue?: number }): boolean {
  return node.progressValue === undefined;
}

// --- BC-17.2: Native/Custom Progress foundation (O4, N1.1, N1.2, P-3) -----
// Data only. Nothing renders the custom variant, segments or labels until
// BC-17.12/17.13; an absent progressVariant is the native element, so every
// existing Progress keeps its appearance and behaviour.

export const PROGRESS_VARIANTS = ["native", "custom"] as const;
export type ProgressVariant = (typeof PROGRESS_VARIANTS)[number];

/** Absent = native (no existing document stores a variant). */
export function getProgressVariant(node: { progressVariant?: ProgressVariant }): ProgressVariant {
  return node.progressVariant ?? "native";
}

export interface ProgressSegments {
  /** Integer 1–100. */
  count: number;
  gap: CssLengthValue;
}
export const MIN_PROGRESS_SEGMENTS = 1;
export const MAX_PROGRESS_SEGMENTS = 100;

/** Display formatting of label numbers only; never changes value, max or fill. */
export interface ProgressNumberFormat {
  /** Integer 0–6. */
  fractionDigits: number;
  trailingZeros: "keep" | "trim";
  grouping: boolean;
}
export const MAX_PROGRESS_FRACTION_DIGITS = 6;

export type ProgressLabelLocale = { kind: "neutral" } | { kind: "tag"; tag: string };

export const PROGRESS_LABEL_KINDS = ["none", "percent", "valueMax", "template"] as const;
export type ProgressLabelKind = (typeof PROGRESS_LABEL_KINDS)[number];

export interface ProgressLabel {
  kind: ProgressLabelKind;
  /** Only (and required) for kind "template". */
  template?: string;
  percentFormat: ProgressNumberFormat;
  valueFormat: ProgressNumberFormat;
  locale: ProgressLabelLocale;
  /** Shown while indeterminate; absent = no label. */
  indeterminateText?: string;
}

export const MAX_PROGRESS_TEMPLATE_LENGTH = 120;
export const MAX_PROGRESS_INDETERMINATE_TEXT_LENGTH = 60;
export const MAX_LOCALE_TAG_LENGTH = 35;
export const PROGRESS_TEMPLATE_TOKENS = ["value", "max", "percent"] as const;

/**
 * Well-formed BCP 47 language tag syntax (RFC 5646, simplified): a 2–3 or
 * 4–8 letter language, then optional script, region, variants,
 * extensions and private use. Canonicalization (Intl.getCanonicalLocales)
 * happens when a tag is authored (BC-17.13); the schema only checks form.
 */
const LOCALE_TAG_PATTERN =
  /^(?:[A-Za-z]{2,3}(?:-[A-Za-z]{3}){0,3}|[A-Za-z]{4,8})(?:-[A-Za-z]{4})?(?:-(?:[A-Za-z]{2}|\d{3}))?(?:-(?:[A-Za-z\d]{5,8}|\d[A-Za-z\d]{3}))*(?:-[\dA-WY-Za-wy-z](?:-[A-Za-z\d]{2,8})+)*(?:-x(?:-[A-Za-z\d]{1,8})+)?$/;

export function isWellFormedLocaleTag(tag: string): boolean {
  return tag.length >= 2 && tag.length <= MAX_LOCALE_TAG_LENGTH && LOCALE_TAG_PATTERN.test(tag);
}

const PERCENT_SIGNS: ReadonlySet<string> = new Set(["%", "％", "٪"]);

/**
 * Validates a label template (P-3, Report 1 §9.7.4): only the tokens
 * {value} {max} {percent}; "{{" and "}}" are literal braces; any other
 * brace is an error; a percent sign directly before or after {percent} is
 * an error ({percent} already includes the locale's sign). Returns the
 * first problem as a message, or null.
 */
export function findProgressTemplateError(template: string): string | null {
  if (template.length > MAX_PROGRESS_TEMPLATE_LENGTH) return `a label template is at most ${MAX_PROGRESS_TEMPLATE_LENGTH} characters`;
  let index = 0;
  while (index < template.length) {
    const char = template[index];
    if (char === "{" && template[index + 1] === "{") {
      index += 2;
      continue;
    }
    if (char === "}" && template[index + 1] === "}") {
      index += 2;
      continue;
    }
    if (char === "}") return 'a "}" must be written "}}"';
    if (char !== "{") {
      index += 1;
      continue;
    }
    const end = template.indexOf("}", index);
    if (end === -1) return 'a "{" must close a token or be written "{{"';
    const token = template.slice(index + 1, end);
    if (!(PROGRESS_TEMPLATE_TOKENS as readonly string[]).includes(token)) return `unknown token "{${token}}" (use {value}, {max} or {percent})`;
    if (token === "percent" && (PERCENT_SIGNS.has(template[index - 1] ?? "") || PERCENT_SIGNS.has(template[end + 1] ?? "")))
      return "{percent} already includes the percent sign";
    index = end + 1;
  }
  return null;
}

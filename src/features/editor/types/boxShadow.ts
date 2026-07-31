/**
 * Box shadow styling for any shadow-capable node (Checkpoint 4.6) — unlike
 * every prior CSS section (Typography/Background/Border/Border Radius),
 * this property is modeled as a *list* from day one (see BoxShadowSettings),
 * since real CSS `box-shadow` natively supports stacking multiple
 * comma-separated layers and the brief explicitly asks for that from the
 * start rather than a later migration.
 *
 * Each ShadowLayer carries a stable `id` (see generateShadowLayerId)
 * exactly like gradient.ts's GradientColorStop — reordering, adding, and
 * removing layers all reorder/resize the array, and the Inspector's
 * selected-layer state (kept outside the document model entirely — see
 * InspectorBoxShadowSection) must survive all of that by identity, never
 * by index.
 *
 * Unlike GradientColorStop (whose `color`/`position` are always required,
 * since a stop with no color has no reasonable pure-CSS reading), every
 * geometry/color field here is independently optional with no synthesized
 * default — the same "absent is genuinely unset, deferring to the
 * browser's own CSS initial value" philosophy every other settings object
 * in this codebase already uses (Typography/Border/BorderRadius). This is
 * a deliberate departure from the brief's own illustrative `ShadowLayer`
 * interface (which shows every field as required) — chosen because the
 * brief's own #12 explicitly asks for "Reset Color"/"Reset Geometry"
 * actions that "return to unset, not artificial defaults," which only has
 * a real meaning if those fields can be genuinely absent. An absent
 * offset/blur/spread renders as CSS's own initial `0`; an absent color
 * renders as CSS's own initial `currentcolor` — see formatShadowLayerCss.
 * `id`, `enabled`, and `inset` are the only fields with no CSS-initial-
 * value equivalent to fall back to (a disabled layer has no partial
 * rendering, and `inset` is already a plain boolean with no "unset" tri-
 * state), so those three alone are always concretely set.
 */

import type { CssLengthValue, CssUnit } from "@/features/editor/types/typography";
import { isValidCssColor } from "@/features/editor/utils/cssColor";

/** px/rem/em only — real CSS box-shadow offsets/blur/spread are `<length>`, never `<percentage>`, unlike Border Radius. */
export const SHADOW_LENGTH_UNITS: readonly CssUnit[] = ["px", "rem", "em"];

export interface ShadowLayer {
  id: string;
  /** Whether this layer currently renders (Checkpoint 4.6's "Enable/Disable layer") — a purely Inspector-authoring concept with no CSS equivalent, so a disabled layer is skipped entirely by resolveBoxShadowStyle rather than rendering some partial/zeroed form. */
  enabled: boolean;
  /** True renders `inset` (drawn inside the box's edge); false (the default for a new layer) renders a normal outer drop shadow. */
  inset: boolean;
  offsetX?: CssLengthValue;
  offsetY?: CssLengthValue;
  /** CSS blur-radius — must be non-negative; see isValidShadowBlurValue. */
  blur?: CssLengthValue;
  /** CSS spread-radius — may be negative (shrinks the shadow), unlike blur. */
  spread?: CssLengthValue;
  /** Any valid CSS color string — see isValidCssColor. Absent means the browser's own currentcolor initial value applies, matching BorderSideSettings.color's identical convention. */
  color?: string;
}

/** A node's own stack of shadow layers, in render order (first listed paints on top, matching real CSS box-shadow layering) — always a plain array, never wrapped in an extra object, since a list is already the model's own natural "unset" representation (see getBoxShadowLayers/normalizeBoxShadowSettings). */
export type BoxShadowSettings = ShadowLayer[];

/** Keeps the layer list and its resolver cheap — the same rationale gradient.ts's MAX_GRADIENT_STOPS documents. addShadowLayer no-ops at this limit. */
export const MAX_SHADOW_LAYERS = 8;

/** A short, locally-unique id — shadow layers are only ever looked up within their own parent node's boxShadow array (never globally), so a random suffix without further scoping is sufficient, exactly like gradient.ts's generateGradientStopId. */
export function generateShadowLayerId(): string {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `shadow-${suffix}`;
}

function px(value: number): CssLengthValue {
  return { value, unit: "px" };
}

/** A node with no shadow set renders with no box-shadow CSS at all — the tag's own Tailwind chrome class (Button's `shadow-sm`), or lack of any, governs until an explicit BoxShadowSettings exists; see resolveBoxShadowStyle and ButtonElement's `usesLegacyShadowChrome` gate. */
export function getBoxShadowLayers(node: { boxShadow?: BoxShadowSettings }): ShadowLayer[] {
  return node.boxShadow ?? [];
}

/** Collapses an empty layer list back to `undefined` — the list-shaped counterpart of every other settings object's "unset once empty" convention (see withTypographyField). Every mutating helper below that can end in zero layers goes through this before being handed to setElementBoxShadow. */
export function normalizeBoxShadowSettings(layers: ShadowLayer[]): BoxShadowSettings | undefined {
  return layers.length > 0 ? layers : undefined;
}

/** The default new layer (Checkpoint 4.6's "Add Shadow" action) — a clearly visible, conventional drop shadow, the same "one coherent, immediately visible default" philosophy gradient.ts's createDefaultStops uses. */
export function createDefaultShadowLayer(): ShadowLayer {
  return {
    id: generateShadowLayerId(),
    enabled: true,
    inset: false,
    offsetX: px(0),
    offsetY: px(4),
    blur: px(8),
    spread: px(0),
    color: "rgba(0, 0, 0, 0.25)",
  };
}

/** Appends a layer — a no-op (same reference) once MAX_SHADOW_LAYERS is reached, so a caller that doesn't check the limit itself still can't exceed it. */
export function addShadowLayer(layers: ShadowLayer[], layer: ShadowLayer): ShadowLayer[] {
  if (layers.length >= MAX_SHADOW_LAYERS) return layers;
  return [...layers, layer];
}

/** Removes a layer by id — a no-op (same reference) if the id doesn't exist. Also serves as "Reset Selected Layer" (Checkpoint 4.6's #12): a layer has no "unset" tri-state of its own to reset to, so returning it to unset means it no longer exists in the list. */
export function removeShadowLayer(layers: ShadowLayer[], id: string): ShadowLayer[] {
  const next = layers.filter((layer) => layer.id !== id);
  return next.length === layers.length ? layers : next;
}

/** Inserts a copy of the given layer (fresh id) directly after it — a no-op (same reference) if the id doesn't exist, or if doing so would exceed MAX_SHADOW_LAYERS. */
export function duplicateShadowLayer(layers: ShadowLayer[], id: string): ShadowLayer[] {
  if (layers.length >= MAX_SHADOW_LAYERS) return layers;
  const index = layers.findIndex((layer) => layer.id === id);
  if (index === -1) return layers;
  const clone: ShadowLayer = { ...layers[index], id: generateShadowLayerId() };
  return [...layers.slice(0, index + 1), clone, ...layers.slice(index + 1)];
}

/** Moves a layer to `toIndex` (clamped into range) — a no-op (same reference) if the id doesn't exist or the target index resolves to the layer's current position. Used by both live pointer-drag reordering and the discrete Move Up/Down actions — see InspectorBoxShadowSection. */
export function reorderShadowLayer(layers: ShadowLayer[], id: string, toIndex: number): ShadowLayer[] {
  const fromIndex = layers.findIndex((layer) => layer.id === id);
  if (fromIndex === -1) return layers;
  const clampedTo = Math.min(Math.max(toIndex, 0), layers.length - 1);
  if (clampedTo === fromIndex) return layers;
  const next = [...layers];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(clampedTo, 0, moved);
  return next;
}

/**
 * Updates one layer's fields by id — a no-op (same reference) if the id
 * doesn't exist. `patch` may set a field to a concrete value or clear it
 * with `undefined` (unlike gradient.ts's updateGradientStop, which never
 * needed clearing since GradientColorStop's fields are always required);
 * this single helper covers every per-field edit (color, each geometry
 * field, enabled, inset) as well as the combined "Reset Geometry" action
 * (a patch clearing offsetX/offsetY/blur/spread together in one commit)
 * and "Reset Color" (a patch clearing just `color`).
 */
export function updateShadowLayer(
  layers: ShadowLayer[],
  id: string,
  patch: Partial<Omit<ShadowLayer, "id">>,
): ShadowLayer[] {
  let changed = false;
  const result = layers.map((layer) => {
    if (layer.id !== id) return layer;
    changed = true;
    const next: ShadowLayer = { ...layer, ...patch };
    for (const key of Object.keys(patch) as (keyof typeof patch)[]) {
      if (patch[key] === undefined) delete next[key];
    }
    return next;
  });
  return changed ? result : layers;
}

/** Offsets may be any finite length, including negative (shifts the shadow up/left) — only non-finite input is rejected. */
export function isValidShadowOffsetValue(value: number): boolean {
  return Number.isFinite(value);
}

/** Blur radius must be non-negative — a negative blur has no real CSS rendering and is rejected outright rather than clamped to a guessed floor, matching isValidBorderWidthValue's precedent. */
export function isValidShadowBlurValue(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

/** Spread radius may be negative (shrinks the shadow below the box's own size) — only non-finite input is rejected. */
export function isValidShadowSpreadValue(value: number): boolean {
  return Number.isFinite(value);
}

function isValidOptionalLength(value: unknown, isValidValue: (n: number) => boolean): boolean {
  if (value === undefined) return true;
  if (typeof value !== "object" || value === null) return false;
  const length = value as Partial<CssLengthValue>;
  return typeof length.value === "number" && isValidValue(length.value) && typeof length.unit === "string";
}

/**
 * Defensive validation for a value that might be malformed loaded-document
 * data (this app has no persistence/import feature yet, but the resolver
 * must still never throw on bad data — Checkpoint 4.6's #9). Never
 * repairs; a layer that fails this check is skipped entirely by
 * resolveBoxShadowStyle rather than having its valid fields partially
 * rendered — the other, well-formed layers in the same list still render.
 */
export function isValidShadowLayer(value: unknown): value is ShadowLayer {
  if (typeof value !== "object" || value === null) return false;
  const layer = value as Record<string, unknown>;

  if (typeof layer.id !== "string" || layer.id === "") return false;
  if (typeof layer.enabled !== "boolean") return false;
  if (typeof layer.inset !== "boolean") return false;
  if (!isValidOptionalLength(layer.offsetX, isValidShadowOffsetValue)) return false;
  if (!isValidOptionalLength(layer.offsetY, isValidShadowOffsetValue)) return false;
  if (!isValidOptionalLength(layer.blur, isValidShadowBlurValue)) return false;
  if (!isValidOptionalLength(layer.spread, isValidShadowSpreadValue)) return false;
  if ("color" in layer && layer.color !== undefined && !isValidCssColor(layer.color as string)) return false;

  return true;
}

const DEFAULT_LENGTH: CssLengthValue = px(0);
const DEFAULT_SHADOW_COLOR = "currentcolor";

/** Renders one CssLengthValue field, or CSS's own initial `0` if genuinely unset — never converts units, matching formatCssLength. */
function formatLengthOrZero(value: CssLengthValue | undefined): string {
  return value ? `${value.value}${value.unit === "unitless" ? "" : value.unit}` : `${DEFAULT_LENGTH.value}${DEFAULT_LENGTH.unit}`;
}

/**
 * The single entry point both Canvas rendering (resolveBoxShadowStyle) and
 * the layer list's own per-row preview swatch call — never format a layer
 * any other way, so the preview and Canvas can never drift apart, exactly
 * like gradient.ts's formatGradientCss. Does not check `enabled` itself
 * (callers filter disabled layers out before mapping, since a preview
 * swatch for a disabled row still needs to show what it *would* render).
 */
export function formatShadowLayerCss(layer: ShadowLayer): string {
  const parts = `${formatLengthOrZero(layer.offsetX)} ${formatLengthOrZero(layer.offsetY)} ${formatLengthOrZero(layer.blur)} ${formatLengthOrZero(layer.spread)} ${layer.color ?? DEFAULT_SHADOW_COLOR}`;
  return layer.inset ? `inset ${parts}` : parts;
}

/**
 * Quick-apply shadow presets (Checkpoint 4.6's #7) — each replaces the
 * *entire* layer stack with one freshly-built layer (fresh id every time),
 * the same "no preset identity persisted" rule border.ts/borderRadius.ts's
 * own presets already follow: applying a preset is a one-time starting
 * point, and every field (including color) remains freely editable
 * afterward with no memory of which preset produced it.
 */
export type ShadowPreset = "small" | "medium" | "large" | "floatingCard" | "soft" | "inner";

const SHADOW_PRESET_VALUES: Record<ShadowPreset, Omit<ShadowLayer, "id">> = {
  small: { enabled: true, inset: false, offsetX: px(0), offsetY: px(1), blur: px(2), spread: px(0), color: "rgba(0, 0, 0, 0.18)" },
  medium: { enabled: true, inset: false, offsetX: px(0), offsetY: px(4), blur: px(8), spread: px(0), color: "rgba(0, 0, 0, 0.2)" },
  large: { enabled: true, inset: false, offsetX: px(0), offsetY: px(12), blur: px(24), spread: px(0), color: "rgba(0, 0, 0, 0.22)" },
  // A negative spread shrinks the shadow in from the box's own edge before
  // its large blur softens it further — the combination that reads as a
  // card "floating" above the surface rather than merely sitting on it.
  floatingCard: { enabled: true, inset: false, offsetX: px(0), offsetY: px(20), blur: px(40), spread: px(-8), color: "rgba(0, 0, 0, 0.25)" },
  soft: { enabled: true, inset: false, offsetX: px(0), offsetY: px(2), blur: px(16), spread: px(0), color: "rgba(0, 0, 0, 0.12)" },
  inner: { enabled: true, inset: true, offsetX: px(0), offsetY: px(2), blur: px(4), spread: px(0), color: "rgba(0, 0, 0, 0.3)" },
};

export const SHADOW_PRESETS: readonly { preset: ShadowPreset; label: string }[] = [
  { preset: "small", label: "Small" },
  { preset: "medium", label: "Medium" },
  { preset: "large", label: "Large" },
  { preset: "floatingCard", label: "Floating Card" },
  { preset: "soft", label: "Soft" },
  { preset: "inner", label: "Inner Shadow" },
];

/** Always returns a single-layer list (fresh id) — replacing, not merging with, whatever layers already existed. */
export function applyShadowPreset(preset: ShadowPreset): BoxShadowSettings {
  return [{ id: generateShadowLayerId(), ...SHADOW_PRESET_VALUES[preset] }];
}

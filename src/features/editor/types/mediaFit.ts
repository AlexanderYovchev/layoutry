/**
 * How intrinsic media (img; video/iframe once those exist — see
 * getElementCapabilities().supportsMediaFit) fills and aligns its own
 * rendered box (Checkpoint 3.5.1, restructured in Checkpoint 5.6).
 *
 * Checkpoint 5.6 audit found the original Checkpoint 3.5.1 model
 * (`{ fit: "contain"|"cover"|"fill"; position: "center"|"top"|"bottom"|
 * "left"|"right"; preserveAspectRatio: boolean }`, always stored whole)
 * too limited for a production Object Position UI: no `none`/`scale-down`
 * fit values, no percentage/custom position (a 5-keyword position enum
 * can't express "37% 68%" or an out-of-range "-20% 120%"), and a
 * `preserveAspectRatio` escape hatch that only ever duplicated choosing
 * `fit: "fill"` directly. This is a genuine model evolution, not a
 * parallel system: same field name on the node (`mediaFit`), same
 * command (setMediaFitSettings), same resolver (resolveMediaFitStyle),
 * same Inspector section (InspectorMediaSection) — only the shape of the
 * settings object and the capability that gates it
 * (getElementCapabilities().supportsMediaFit, split out from
 * supportsIntrinsicAspectRatio — see that flag's own doc comment) have
 * changed. No persistence/migration layer exists yet in this app, so
 * there is no old-shape data on disk to migrate.
 *
 * Every field is independently optional, following the same
 * "unset has no synthesized default" rule Typography/Background/Border
 * already established (see those types' own doc comments) — a node with
 * no `mediaFit` at all, or a `mediaFit` missing one of these fields,
 * genuinely has no explicit choice for that field. resolveMediaFitStyle
 * supplies its own rendering fallback per field (DEFAULT_OBJECT_FIT /
 * DEFAULT_OBJECT_POSITION_AXIS below) so the Canvas always renders
 * something sensible; the Inspector mirrors that same fallback only to
 * *display* an effective value (e.g. pre-highlighting "Center"), never
 * writing it into the document merely because a control needs something
 * to show — see InspectorMediaSection.
 */
export type ObjectFitValue = "fill" | "contain" | "cover" | "none" | "scale-down";

/**
 * Percentage-only for now (Checkpoint 5.6) — the pre-existing model never
 * supported lengths either (position was a keyword enum), so there is no
 * existing px support to preserve. CSS itself permits values outside
 * 0–100 (cropping/overflowing the box on purpose), so this is a plain
 * finite number with no range restriction — see isValidObjectPositionAxis.
 */
export type ObjectPositionAxis = { value: number; unit: "%" };

export interface MediaFitSettings {
  objectFit?: ObjectFitValue;
  objectPositionX?: ObjectPositionAxis;
  objectPositionY?: ObjectPositionAxis;
}

/** A node with no mediaFit set renders with no explicit media-fit CSS in the document model — see resolveMediaFitStyle for the separate rendering-time fallback. */
export function getMediaFitSettings(node: { mediaFit?: MediaFitSettings }): MediaFitSettings {
  return node.mediaFit ?? {};
}

/**
 * Layoutry's own safe rendering default — deliberately NOT the real CSS
 * default (`object-fit: fill`, which stretches/distorts unconstrained
 * media). This matches the pre-existing Checkpoint 3.5.1 behavior (every
 * unset image already rendered as `contain`), preserved here so no
 * existing image's on-canvas appearance changes.
 */
export const DEFAULT_OBJECT_FIT: ObjectFitValue = "contain";

/** The real CSS default for both object-position axes (`object-position: 50% 50%`, i.e. Center) — unlike DEFAULT_OBJECT_FIT, this one *does* match the CSS spec default, so it's used as-is. */
export const DEFAULT_OBJECT_POSITION_AXIS: ObjectPositionAxis = { value: 50, unit: "%" };

export interface ObjectFitPresetMetadata {
  value: ObjectFitValue;
  label: string;
  description: string;
}

/** Structured Fit metadata — labels/descriptions live here once, not scattered through InspectorMediaSection's JSX (same pattern ASPECT_RATIO_PRESETS established in Checkpoint 5.5). */
export const OBJECT_FIT_PRESETS: readonly ObjectFitPresetMetadata[] = [
  { value: "fill", label: "Fill", description: "Stretch the media to fill the box. Its natural proportions may change." },
  { value: "contain", label: "Contain", description: "Fit the entire media inside the box while preserving its proportions." },
  { value: "cover", label: "Cover", description: "Fill the entire box while preserving proportions. Some content may be cropped." },
  { value: "none", label: "None", description: "Keep the media at its natural size." },
  { value: "scale-down", label: "Scale Down", description: "Use whichever is smaller: None or Contain." },
];

export type ObjectPositionPresetKey =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center-left"
  | "center"
  | "center-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export interface ObjectPositionPresetMetadata {
  key: ObjectPositionPresetKey;
  label: string;
  x: number;
  y: number;
}

/** The 3x3 grid's structured metadata — deliberately a *separate* model from Background's own BackgroundPosition (a fixed 9-keyword enum with no custom/percentage escape hatch): Object Position needs arbitrary/out-of-range percentages, which a keyword union can't represent. */
export const OBJECT_POSITION_PRESETS: readonly ObjectPositionPresetMetadata[] = [
  { key: "top-left", label: "Top left", x: 0, y: 0 },
  { key: "top-center", label: "Top center", x: 50, y: 0 },
  { key: "top-right", label: "Top right", x: 100, y: 0 },
  { key: "center-left", label: "Center left", x: 0, y: 50 },
  { key: "center", label: "Center", x: 50, y: 50 },
  { key: "center-right", label: "Center right", x: 100, y: 50 },
  { key: "bottom-left", label: "Bottom left", x: 0, y: 100 },
  { key: "bottom-center", label: "Bottom center", x: 50, y: 100 },
  { key: "bottom-right", label: "Bottom right", x: 100, y: 100 },
];

export function isValidObjectFitValue(value: unknown): value is ObjectFitValue {
  return value === "fill" || value === "contain" || value === "cover" || value === "none" || value === "scale-down";
}

/** Rejects NaN/Infinity, wrong unit, malformed objects, arrays, and raw strings — but deliberately never rejects a finite value merely for being negative or over 100 (CSS permits cropping/overflowing positions on purpose). */
export function isValidObjectPositionAxis(value: unknown): value is ObjectPositionAxis {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return candidate.unit === "%" && typeof candidate.value === "number" && Number.isFinite(candidate.value);
}

/**
 * Exact match only against the 3x3 grid's own metadata — never rewrites
 * or "snaps" a close-but-not-exact value (e.g. 49%/50% stays
 * unrecognized), and never mutates the settings it's checking. Takes the
 * already-*effective* (defaulted) x/y rather than the raw optional
 * fields, so an untouched node (no explicit position at all) still
 * detects as "center" — matching DEFAULT_OBJECT_POSITION_AXIS.
 */
export function detectObjectPositionPreset(x: number, y: number): ObjectPositionPresetKey | undefined {
  return OBJECT_POSITION_PRESETS.find((preset) => preset.x === x && preset.y === y)?.key;
}

/**
 * Sets or clears exactly one field, immutably — mirrors
 * withBackgroundField exactly (Checkpoint 4.3): `value: undefined`
 * deletes the key rather than storing an explicit `undefined`, and the
 * result collapses to `undefined` once no fields remain (so a fully-reset
 * mediaFit clears the node's field entirely rather than leaving `{}`
 * behind). objectPositionX/objectPositionY are independent through this
 * helper — resetting one never disturbs the other.
 */
export function withMediaFitField<K extends keyof MediaFitSettings>(
  current: MediaFitSettings,
  field: K,
  value: MediaFitSettings[K],
): MediaFitSettings | undefined {
  const next: MediaFitSettings = { ...current, [field]: value };
  if (value === undefined) delete next[field];
  return Object.keys(next).length > 0 ? next : undefined;
}

/**
 * Sets objectPositionX and objectPositionY together in one write — used
 * by the 3x3 preset grid, where a single click chooses both axes at once
 * and must produce exactly one history entry (not two sequential
 * single-field commits). Leaves objectFit untouched.
 */
export function withMediaFitPosition(
  current: MediaFitSettings,
  x: ObjectPositionAxis,
  y: ObjectPositionAxis,
): MediaFitSettings | undefined {
  const next: MediaFitSettings = { ...current, objectPositionX: x, objectPositionY: y };
  return Object.keys(next).length > 0 ? next : undefined;
}

/** Clears both position axes together in one write — Object Position's own reset semantics ("remove explicit X/Y", one history entry), leaving objectFit untouched. */
export function clearMediaFitPosition(current: MediaFitSettings): MediaFitSettings | undefined {
  const next: MediaFitSettings = { ...current };
  delete next.objectPositionX;
  delete next.objectPositionY;
  return Object.keys(next).length > 0 ? next : undefined;
}

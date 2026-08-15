/**
 * CSS `aspect-ratio` — Aspect Ratio Foundation (Checkpoint 5.5). A new,
 * top-level, fully-optional field directly on EditorElementNode
 * (`aspectRatio`), not folded into an existing grouped settings object —
 * repository inspection found no existing "Dimensions"/"Sizing" settings
 * object to extend (width/height live in the unrelated `dimensions`/
 * `freeLayout` geometry fields — see their own doc comments in
 * document.ts — which are Flow/Free-specific and mutually exclusive by
 * construction, whereas `aspectRatio` must apply identically to both).
 * `PositionSettings` was deliberately *not* reused either — aspect ratio
 * is a sizing constraint, not a positioning one, and grouping it there
 * would only be "Milestone 5 happens to be about layout," not a real
 * architectural relationship.
 *
 * IMPORTANT NAMING DISTINCTION — do not confuse this field with the
 * pre-existing `EditorElementNode.aspectRatioLocked` (Checkpoint 3.4.4):
 * `aspectRatioLocked` is a *resize-interaction* flag (does dragging a
 * Free child's corner handle preserve its *current* width:height ratio
 * while resizing — see computeFreeChildResizeResult.ts) and has nothing
 * to do with CSS. `aspectRatio` (this file) is the real CSS `aspect-ratio`
 * *box-sizing constraint* a user explicitly chooses (Auto/Square/.../
 * Custom), resolved by resolveAspectRatioStyle.ts. The two are related in
 * spirit (both are "aspect ratio" concepts) but are otherwise completely
 * independent features with independent document fields, independent
 * Inspector controls, and independent resolvers — this checkpoint's own
 * brief explicitly warns against conflating "CSS aspect-ratio" with
 * "lock proportions while resizing," and does not touch
 * `aspectRatioLocked` or the Free resize-lock mechanism at all.
 *
 * Like Display/Position, `aspectRatio` has no synthesized default —
 * absent means "let the browser size normally," same as an explicitly
 * chosen `{ mode: "auto" }` (see "Auto vs absent" below) — see
 * resolveAspectRatioStyle, which only emits CSS when the field is
 * present and structurally valid.
 */

export type AspectRatioValue = { mode: "auto" } | { mode: "ratio"; width: number; height: number };

/**
 * Auto vs. absent (Checkpoint 5.5's own explicit requirement): both
 * currently resolve to identical CSS (no `aspect-ratio` constraint
 * beyond the browser's own normal sizing), but they remain semantically
 * distinct documents, matching the Position/Z-index precedent of "an
 * explicit choice is not the same fact as never having chosen" —
 * selecting "Auto" in the Inspector stores `{ mode: "auto" }` (isSet:
 * true, the Auto option visibly highlighted, a working Reset button);
 * Reset clears the field back to genuinely `undefined` (isSet: false,
 * nothing highlighted). This gives Reset real, honest meaning ("this
 * property has never been touched") distinct from "I looked at this and
 * chose the browser default," even though today both render identically
 * — the same reasoning Position's own `position` field and Z-index's
 * `zIndex: "auto"` already established.
 */
export type AspectRatioPresetKey = "auto" | "square" | "landscape" | "widescreen" | "portrait" | "custom";

interface AspectRatioPresetMetadata {
  key: AspectRatioPresetKey;
  label: string;
  description: string;
  /** The canonical value clicking this preset commits — `null` for "custom", which has no single canonical value (see InspectorAspectRatioSection's own handling). */
  value: AspectRatioValue | null;
}

/**
 * Structured per-preset metadata (this checkpoint's own explicit
 * requirement — "Do not scatter these values through JSX conditionals")
 * — the single place presets are defined, consumed by the Inspector for
 * its segmented options, tooltips, and preset-detection below. Shaped to
 * grow later (icons, localization, additional presets) without touching
 * call sites.
 */
export const ASPECT_RATIO_PRESETS: readonly AspectRatioPresetMetadata[] = [
  { key: "auto", label: "Auto", description: "Sizes normally — width and height stay independent.", value: { mode: "auto" } },
  { key: "square", label: "Square", description: "1:1 — equal width and height.", value: { mode: "ratio", width: 1, height: 1 } },
  { key: "landscape", label: "Landscape", description: "4:3 — a classic landscape ratio.", value: { mode: "ratio", width: 4, height: 3 } },
  { key: "widescreen", label: "Widescreen", description: "16:9 — a common widescreen video ratio.", value: { mode: "ratio", width: 16, height: 9 } },
  { key: "portrait", label: "Portrait", description: "3:4 — a classic portrait ratio.", value: { mode: "ratio", width: 3, height: 4 } },
  { key: "custom", label: "Custom", description: "Enter your own width:height ratio.", value: null },
];

/**
 * Defensive structural validation for a value that might be malformed
 * loaded-document data — matches every other checkpoint's own
 * per-field-shape validator (e.g. isValidOffsetValue), never a single
 * whole-object gate that could suppress an otherwise-valid unrelated
 * field elsewhere on the node. A ratio's width/height must both be
 * finite and strictly greater than zero — rejects 0:0, 0:1, 1:0,
 * negative values, NaN, Infinity, numeric strings ("16"), arrays, and
 * any other malformed shape.
 */
export function isValidAspectRatioValue(value: unknown): value is AspectRatioValue {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const candidate = value as { mode?: unknown; width?: unknown; height?: unknown };

  if (candidate.mode === "auto") return true;

  if (candidate.mode === "ratio") {
    return (
      typeof candidate.width === "number" &&
      Number.isFinite(candidate.width) &&
      candidate.width > 0 &&
      typeof candidate.height === "number" &&
      Number.isFinite(candidate.height) &&
      candidate.height > 0
    );
  }

  return false;
}

/**
 * Ratio-equivalence comparison via cross-multiplication
 * (a.width/a.height === b.width/b.height  <=>  a.width*b.height ===
 * a.height*b.width) rather than comparing decimal divisions directly —
 * this checkpoint's own explicit warning ("be careful with floating-
 * point comparisons"). A small epsilon absorbs float rounding from the
 * multiplication itself (exact for the small integer presets; only
 * matters for a user's own decimal custom ratio happening to coincide
 * almost exactly with a preset).
 */
const RATIO_EPSILON = 1e-9;

function ratiosEqual(a: { width: number; height: number }, b: { width: number; height: number }): boolean {
  return Math.abs(a.width * b.height - a.height * b.width) < RATIO_EPSILON;
}

/**
 * Recognizes an exact-*or-mathematically-equivalent* preset from stored
 * ratio data (8:6 recognizes as Landscape, the same as 4:3) without ever
 * mutating the stored value — the brief's own preferred UX: "recognize
 * the preset visually... without rewriting the stored value until the
 * user actually chooses a preset." Anything not equivalent to a named
 * preset (including a genuinely arbitrary ratio like 3:2 or a decimal
 * ratio like 2.39:1) is "custom". Requires a defined value — the
 * Inspector's own "field entirely absent" (Reset) state is a separate,
 * one-level-up concern (see InspectorAspectRatioSection), not folded
 * into this helper's own return type.
 */
export function detectAspectRatioPreset(value: AspectRatioValue): AspectRatioPresetKey {
  if (value.mode === "auto") return "auto";

  for (const preset of ASPECT_RATIO_PRESETS) {
    if (preset.value?.mode === "ratio" && ratiosEqual(value, preset.value)) return preset.key;
  }

  return "custom";
}

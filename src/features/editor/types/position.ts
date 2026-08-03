/**
 * CSS `position` — Position Foundation (Checkpoint 5.1). Same grouped,
 * fully-optional settings-object shape typography/border/boxShadow/
 * filters/display already established (see EditorElementNode.position),
 * rather than a bare `position?: PositionValue` field directly on the
 * node — Checkpoint 5.1's own Future Architecture section named upcoming
 * checkpoints (5.2 Insets, 5.3 Z-index) that would plug straight into
 * this same PositionSettings object without migrating it, exactly like
 * DisplaySettings already absorbed seven independent fields into one
 * object. `position` itself has no synthesized default — see
 * getPositionSettings/withPositionField, and resolvePositionStyle, which
 * only emits CSS when a field is actually present and structurally
 * valid.
 *
 * Insets (Checkpoint 5.2) extended this same object with `top`/`right`/
 * `bottom`/`left` — see OffsetValue/OFFSET_SIDES below. No migration was
 * needed: withPositionField was already generic over `keyof
 * PositionSettings`, exactly anticipating this. Z-index (Checkpoint 5.3)
 * extended it again with `zIndex` — see ZIndexValue below — the same way,
 * again with no migration.
 *
 * Ownership note: this is a *general* user-facing `position` control, and
 * it is not the only place in the app that ever writes the CSS
 * `position` property. The pre-existing Free layout mechanism
 * (Checkpoint 3.4.4 — see FreeLayoutGeometry/getLayoutMode) already
 * hard-codes `position: absolute` on every Free-mode child (see
 * freeChildStyle in elementDimensionsStyle.ts) and `position: relative`
 * on a container that hosts its own Free children but isn't itself one
 * (see ContainerElement's own hostsOwnFreeChildren). Those are load-
 * bearing structural mechanics, not a stylistic choice a user makes —
 * without them, Free's own left/top geometry has no containing block to
 * resolve against. This is a real, pre-existing ownership conflict over
 * the same CSS property, the same shape as the Display/Flex conflict
 * documented in types/display.ts, and it's resolved the same way: rather
 * than letting a general control silently fight a structural mechanism
 * over one CSS property, the Inspector (InspectorNodeSummary) hides this
 * checkpoint's Position section entirely for a Free child or a Free-
 * hosting container, and every element component spreads
 * resolvePositionStyle(node) *before* elementPositionStyle/the
 * hostsOwnFreeChildren override in its own style object, so Free's own
 * mechanics always win over this field even against stale document data
 * (e.g. a node that had an explicit Position set while still a Flow
 * child, then had its parent switched to Free layout afterward). See
 * resolvePositionStyle.ts for the resolver side of this.
 */

import { formatCssLength, type CssLengthValue, type CssUnit } from "@/features/editor/types/typography";

export type PositionValue = "static" | "relative" | "absolute" | "fixed" | "sticky";
export const POSITION_VALUES: readonly PositionValue[] = ["static", "relative", "absolute", "fixed", "sticky"];

/** Offsets are only meaningful once an element has left `static` flow — CSS itself ignores top/right/bottom/left on a static element, and the Inspector's own Offsets subsection stays hidden for exactly this reason (Checkpoint 5.2's own "don't show beginners a control with no effect" requirement). Absent `position` (never explicitly set) behaves as `static` too, so offsets stay hidden then as well. */
export function offsetsApply(position: PositionValue | undefined): boolean {
  return position !== undefined && position !== "static";
}

export type OffsetSide = "top" | "right" | "bottom" | "left";
export const OFFSET_SIDES: readonly OffsetSide[] = ["top", "right", "bottom", "left"];

/**
 * px/%/rem/em — the same four-unit "Length model" Border Radius already
 * established (see BORDER_RADIUS_UNITS), reused here rather than
 * typography's full CssUnit set: vw/vh/unitless/deg have no meaningful
 * role as a top/right/bottom/left offset in this checkpoint. Declared
 * independently of BORDER_RADIUS_UNITS (not imported from it) since the
 * two are only coincidentally identical today — border-radius and inset
 * offsets are unrelated CSS concepts that happen to share a unit set,
 * not the same concept.
 */
export const OFFSET_UNITS: readonly CssUnit[] = ["px", "%", "rem", "em"];

/**
 * One offset's value — either the `auto` keyword (a real, explicit CSS
 * value, e.g. `left: 0; right: auto` to anchor from one side only — see
 * BackgroundSizeAxisValue's identical "auto is an explicit, deliberate
 * choice distinct from the field being entirely absent" reasoning) or an
 * explicit CssLengthValue. Reuses the app's one canonical Length model
 * (typography.ts's CssLengthValue/formatCssLength) directly rather than
 * a second, structurally-identical type — unlike BackgroundSizeAxisValue,
 * which predates this reasoning being written down explicitly and
 * duplicates the `{ value, unit }` shape inline.
 */
export type OffsetValue = CssLengthValue | "auto";

/**
 * CSS `z-index` (Checkpoint 5.3) — either the `auto` keyword (the
 * browser's own default stacking behavior) or a whole number. A plain
 * `number`, not a CssLengthValue: unlike every offset, z-index has no
 * unit — it's a bare stacking-order integer, positive, zero, or
 * negative — so wrapping it in a `{ value, unit }` pair would invent a
 * unit concept CSS itself doesn't have. "auto" is a real, explicit,
 * deliberate choice here too, distinct from the field being entirely
 * absent — same reasoning as OffsetValue's own "auto" and Position's own
 * "Static": selecting Auto from the Inspector's mode toggle commits the
 * literal string, it doesn't merely clear the field (a separate Reset
 * action does that) — see InspectorPositionSection's StackingSubsection.
 */
export type ZIndexValue = number | "auto";

export interface PositionSettings {
  position?: PositionValue;
  top?: OffsetValue;
  right?: OffsetValue;
  bottom?: OffsetValue;
  left?: OffsetValue;
  zIndex?: ZIndexValue;
}

/** A node with no position settings renders with none of this checkpoint's CSS at all — the tag's own default rendering (`static`) governs, exactly like filters/border/display. */
export function getPositionSettings(node: { position?: PositionSettings }): PositionSettings {
  return node.position ?? {};
}

/**
 * Produces the next PositionSettings after setting (or, with `value`
 * undefined, resetting) exactly one field — collapses to `undefined`
 * (not `{}`) once every field has been cleared, matching every other
 * settings object's "unset" convention (see withDisplayField). Generic
 * over `keyof PositionSettings`, not hardcoded to the single `position`
 * field that exists today, so 5.2/5.3's own new fields (inset, zIndex)
 * reuse this unchanged.
 */
export function withPositionField<K extends keyof PositionSettings>(
  current: PositionSettings,
  field: K,
  value: PositionSettings[K],
): PositionSettings | undefined {
  const next: PositionSettings = { ...current, [field]: value };
  if (value === undefined) delete next[field];
  return Object.keys(next).length > 0 ? next : undefined;
}

export function isValidPositionValue(value: string): value is PositionValue {
  return (POSITION_VALUES as readonly string[]).includes(value);
}

/** A stable key for one offset value — identically-absent (undefined) and "auto" each get their own distinct key, and two equal lengths (same value + unit) collapse to the same key. Used only by offsetSidesEqual below. */
function offsetKey(value: OffsetValue | undefined): string {
  if (value === undefined) return "";
  if (value === "auto") return "auto";
  return `${value.value}${value.unit}`;
}

/**
 * True when every side holds an identical (or identically absent) offset
 * — the same "does this already look uniform" heuristic
 * borderRadiusCornersEqual/border.ts's borderSidesEqual use. Used once,
 * per freshly-selected node, to decide whether the Offsets subsection's
 * Linked/Unlinked toggle should default to Linked.
 */
export function offsetSidesEqual(settings: PositionSettings): boolean {
  const [top, right, bottom, left] = OFFSET_SIDES.map((side) => settings[side]);
  const key = offsetKey(top);
  return offsetKey(right) === key && offsetKey(bottom) === key && offsetKey(left) === key;
}

/**
 * Writes the same offset to all four sides (or, with `value` undefined,
 * clears all four) in a single commit — the Offsets subsection's Linked
 * mode, and its own "reset all offsets" action. Unlike
 * withBorderRadiusAllCorners, this must preserve every other field on
 * the same shared PositionSettings object (`position` itself, most
 * importantly) — BorderRadiusSettings has no such unrelated field to
 * preserve, since it exists solely to hold four corners.
 */
export function withAllOffsets(current: PositionSettings, value: OffsetValue | undefined): PositionSettings | undefined {
  const next: PositionSettings = { ...current };
  for (const side of OFFSET_SIDES) {
    if (value === undefined) delete next[side];
    else next[side] = value;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

/** Renders an OffsetValue into its CSS text form — "auto" passes through verbatim, a length uses the shared formatCssLength (see OffsetValue's own doc comment on reusing typography's canonical Length model). */
export function formatOffsetValue(value: OffsetValue): string {
  return value === "auto" ? "auto" : formatCssLength(value);
}

/** Defensive shape check for a value that might be malformed loaded-document data — never throws, never repairs; see resolvePositionStyle. Mirrors isValidBorderRadiusCornerValue's exact shape check, widened to also accept the literal "auto" keyword. */
export function isValidOffsetValue(value: unknown): value is OffsetValue {
  if (value === "auto") return true;
  if (typeof value !== "object" || value === null) return false;
  const length = value as Partial<CssLengthValue>;
  return typeof length.value === "number" && Number.isFinite(length.value) && typeof length.unit === "string";
}

/**
 * Valid: "auto", or any safe integer (Number.isSafeInteger already
 * rejects decimals, NaN, and Infinity in one call — a float, NaN, and
 * ±Infinity all fail it). Invalid: numeric strings ("5"), null, arrays,
 * objects, or any other keyword — z-index has exactly one keyword
 * ("auto") and no unit, unlike every OffsetValue.
 */
export function isValidZIndexValue(value: unknown): value is ZIndexValue {
  return value === "auto" || Number.isSafeInteger(value);
}

/**
 * Defensive per-field check for a value that might be malformed loaded-
 * document data — this app has no persistence/import feature yet, but
 * the resolver must still never throw on bad data (see
 * isValidDisplayFieldValue's identical reasoning). Deliberately per-
 * *field*, not a single whole-object gate, so one malformed offset (or
 * zIndex) can't suppress `position` or another, still-valid field.
 * Branches by field rather than gating on `typeof value === "string"` up
 * front the way Checkpoint 5.1's own version of this function did —
 * `top`/`right`/`bottom`/`left` are objects (or the literal "auto"), and
 * `zIndex` is a number (or "auto"), not strings, once Checkpoints
 * 5.2/5.3 added them.
 */
export function isValidPositionFieldValue<K extends keyof PositionSettings>(field: K, value: unknown): boolean {
  switch (field) {
    case "position":
      return typeof value === "string" && isValidPositionValue(value);
    case "top":
    case "right":
    case "bottom":
    case "left":
      return isValidOffsetValue(value);
    case "zIndex":
      return isValidZIndexValue(value);
    default:
      return false;
  }
}

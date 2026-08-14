/**
 * Display, visibility, overflow, and interaction CSS for any display-
 * capable node (Checkpoint 4.8) — same grouped, fully-optional settings-
 * object shape typography/border/boxShadow/filters already established
 * (see EditorElementNode.display), rather than adding seven separate
 * optional fields directly onto the node. Like filters, every field here
 * is a fully independent CSS property with no synthesized default — see
 * getDisplaySettings/withDisplayField, and resolveDisplayStyle, which
 * only emits CSS for fields actually present and structurally valid.
 *
 * Overflow was upgraded in Checkpoint 5.4 from two always-independent
 * axes to a shorthand/longhand pair: the unified `overflow` field (Linked
 * mode) and the original overflowX/overflowY fields (Unlinked mode) are
 * mutually exclusive storage for the same CSS concept — see
 * overflowAxesEqual/withAllOverflow/withOverflowAxis below, and
 * resolveDisplayStyle's own documented precedence. No existing 4.8
 * document needs migrating: overflowX/overflowY keep working exactly as
 * before, and `overflow` is a new, purely additive field.
 *
 * `display` deliberately narrows the brief's own illustrative
 * block/inline/inline-block/flex/grid/none set down to
 * block/inline/inline-block/none — "flex" and "grid" are already fully
 * owned by the pre-existing Layout section's own Display control (see
 * InspectorLayoutSection.tsx, flowLayout.ts, resolveFlowLayoutStyle),
 * which writes the exact same CSS `display` property and additionally
 * unlocks a whole sub-section of container-arrangement controls
 * (direction/wrap/justify/columns/etc.) that this checkpoint's own
 * Non-goals explicitly forbid touching. Offering "Flex"/"Grid" a second
 * time from a different Inspector section, backed by a second,
 * unrelated data model, would let two controls silently fight over one
 * CSS property — this is a real, pre-existing ownership conflict, not
 * an oversight, and narrowing this checkpoint's own option set is the
 * resolution the user chose. "None" (hide entirely) and the plain
 * inline/block variants remain exclusive to this section, since Flow
 * Layout has no equivalent for them.
 */

export type DisplayValue = "block" | "inline" | "inline-block" | "none";
export const DISPLAY_VALUES: readonly DisplayValue[] = ["block", "inline", "inline-block", "none"];

export type VisibilityValue = "visible" | "hidden";
export const VISIBILITY_VALUES: readonly VisibilityValue[] = ["visible", "hidden"];

/** Shared by the unified Overflow shorthand and both Overflow X/Overflow Y axes — the same five keywords apply to any of the three (Checkpoint 5.4 added "clip" to the original four). */
export type OverflowValue = "visible" | "hidden" | "clip" | "auto" | "scroll";
export const OVERFLOW_VALUES: readonly OverflowValue[] = ["visible", "hidden", "clip", "auto", "scroll"];

export type PointerEventsValue = "auto" | "none";
export const POINTER_EVENTS_VALUES: readonly PointerEventsValue[] = ["auto", "none"];

/** The brief's own suggested common set — extensible: adding a future keyword is one entry here plus one in resolveDisplayStyle's pass-through (no format function needed, unlike shadow/filter values, since a cursor keyword renders as its own literal CSS value). */
export type CursorValue = "default" | "pointer" | "text" | "move" | "grab" | "not-allowed" | "crosshair";
export const CURSOR_VALUES: readonly CursorValue[] = [
  "default",
  "pointer",
  "text",
  "move",
  "grab",
  "not-allowed",
  "crosshair",
];

export type UserSelectValue = "auto" | "none" | "text" | "all";
export const USER_SELECT_VALUES: readonly UserSelectValue[] = ["auto", "none", "text", "all"];

export interface DisplaySettings {
  display?: DisplayValue;
  visibility?: VisibilityValue;
  /**
   * The unified CSS `overflow` shorthand (Checkpoint 5.4) — the Overflow
   * subsection's Linked mode. Mutually exclusive with overflowX/overflowY
   * by construction (see withAllOverflow/withOverflowAxis): a node's
   * overflow data lives in exactly one of these two shapes at a time,
   * never both at once. See resolveDisplayStyle for the resolver's own
   * precedence when malformed/hand-edited data violates that invariant.
   */
  overflow?: OverflowValue;
  overflowX?: OverflowValue;
  overflowY?: OverflowValue;
  pointerEvents?: PointerEventsValue;
  cursor?: CursorValue;
  userSelect?: UserSelectValue;
}

/** A node with no display settings renders with none of this checkpoint's CSS at all — the tag's own default rendering governs, exactly like filters/border. */
export function getDisplaySettings(node: { display?: DisplaySettings }): DisplaySettings {
  return node.display ?? {};
}

/**
 * Produces the next DisplaySettings after setting (or, with `value`
 * undefined, resetting) exactly one field — collapses to `undefined`
 * (not `{}`) once every field has been cleared, matching every other
 * settings object's "unset" convention (see withFilterField).
 */
export function withDisplayField<K extends keyof DisplaySettings>(
  current: DisplaySettings,
  field: K,
  value: DisplaySettings[K],
): DisplaySettings | undefined {
  const next: DisplaySettings = { ...current, [field]: value };
  if (value === undefined) delete next[field];
  return Object.keys(next).length > 0 ? next : undefined;
}

export function isValidDisplayValue(value: string): value is DisplayValue {
  return (DISPLAY_VALUES as readonly string[]).includes(value);
}

export function isValidVisibilityValue(value: string): value is VisibilityValue {
  return (VISIBILITY_VALUES as readonly string[]).includes(value);
}

export function isValidOverflowValue(value: string): value is OverflowValue {
  return (OVERFLOW_VALUES as readonly string[]).includes(value);
}

export function isValidPointerEventsValue(value: string): value is PointerEventsValue {
  return (POINTER_EVENTS_VALUES as readonly string[]).includes(value);
}

export function isValidCursorValue(value: string): value is CursorValue {
  return (CURSOR_VALUES as readonly string[]).includes(value);
}

export function isValidUserSelectValue(value: string): value is UserSelectValue {
  return (USER_SELECT_VALUES as readonly string[]).includes(value);
}

/**
 * Defensive per-field check for a value that might be malformed loaded-
 * document data (this app has no persistence/import feature yet, but the
 * resolver must still never throw on bad data — Checkpoint 4.8's #12).
 * Deliberately per-*field*, not a single whole-object gate, matching
 * isValidFilterFieldValue's own reasoning: this settings object's seven
 * fields are fully independent CSS properties, so one malformed field
 * must not suppress every other, still-valid field. See
 * resolveDisplayStyle, which calls this once per field.
 */
export function isValidDisplayFieldValue<K extends keyof DisplaySettings>(field: K, value: unknown): boolean {
  if (typeof value !== "string") return false;
  switch (field) {
    case "display":
      return isValidDisplayValue(value);
    case "visibility":
      return isValidVisibilityValue(value);
    case "overflow":
    case "overflowX":
    case "overflowY":
      return isValidOverflowValue(value);
    case "pointerEvents":
      return isValidPointerEventsValue(value);
    case "cursor":
      return isValidCursorValue(value);
    case "userSelect":
      return isValidUserSelectValue(value);
    default:
      return false;
  }
}

/**
 * True when Overflow X and Overflow Y already resolve to one effective
 * value — including "the unified `overflow` shorthand is already the
 * field in use" and "both axes are genuinely unset" — used once per
 * freshly-selected node to decide whether the Overflow subsection's
 * Linked/Unlinked toggle should default to Linked (Checkpoint 5.4), the
 * same "does this already look uniform" heuristic offsetSidesEqual
 * (position.ts) established for Offsets' own Linked/Unlinked default. A
 * pre-5.4 document only ever has overflowX/overflowY (no shorthand
 * field existed yet) — this still initializes it sensibly: identical
 * axes default to Linked, differing axes default to Unlinked.
 */
export function overflowAxesEqual(display: DisplaySettings): boolean {
  if (display.overflow !== undefined) return true;
  return display.overflowX === display.overflowY;
}

/**
 * Writes (or, with `value` undefined, clears) the unified Overflow
 * shorthand — the Overflow subsection's Linked-mode commit, and its own
 * "reset all overflow"/"reset both axes" action. Always clears
 * overflowX/overflowY too, whether setting or resetting: the shorthand
 * and the per-axis longhands are mutually exclusive storage for the same
 * underlying CSS concept (see resolveDisplayStyle's own precedence), so
 * committing a unified value must never leave a stale, contradictory
 * per-axis value sitting alongside it. Preserves every other field on
 * the same shared DisplaySettings object.
 */
export function withAllOverflow(current: DisplaySettings, value: OverflowValue | undefined): DisplaySettings | undefined {
  const next: DisplaySettings = { ...current };
  delete next.overflowX;
  delete next.overflowY;
  if (value === undefined) delete next.overflow;
  else next.overflow = value;
  return Object.keys(next).length > 0 ? next : undefined;
}

/**
 * Writes (or, with `value` undefined, clears) exactly one overflow axis —
 * the Overflow subsection's Unlinked-mode commit. Always clears the
 * unified `overflow` shorthand first: per resolveDisplayStyle's
 * precedence, a present shorthand always wins over the per-axis
 * longhands, so editing one axis while a shorthand value is still stored
 * would otherwise be silently ignored by the Canvas the moment this
 * commit lands. When the shorthand was the *only* overflow data present
 * (the node was still in Linked-shaped storage when the user started
 * editing one axis), its value is copied onto the *other*, untouched
 * axis first — so switching to per-axis storage by editing just one axis
 * never silently resets the other axis back to the browser's own
 * "visible" default. This is the one point real document data changes
 * shape between the two storage forms; the Link toggle itself never
 * writes (see InspectorDisplaySection's OverflowSubsection), so this
 * single commit is also where the brief's "use the current unified value
 * as the starting point" rule actually takes effect.
 */
export function withOverflowAxis(
  current: DisplaySettings,
  axis: "overflowX" | "overflowY",
  value: OverflowValue | undefined,
): DisplaySettings | undefined {
  const other = axis === "overflowX" ? "overflowY" : "overflowX";
  const next: DisplaySettings = { ...current };
  if (next.overflow !== undefined && next[other] === undefined) {
    next[other] = next.overflow;
  }
  delete next.overflow;
  if (value === undefined) delete next[axis];
  else next[axis] = value;
  return Object.keys(next).length > 0 ? next : undefined;
}

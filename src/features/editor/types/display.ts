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

/** Shared by both Overflow X and Overflow Y — the same four keywords apply to either axis. */
export type OverflowValue = "visible" | "hidden" | "auto" | "scroll";
export const OVERFLOW_VALUES: readonly OverflowValue[] = ["visible", "hidden", "auto", "scroll"];

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

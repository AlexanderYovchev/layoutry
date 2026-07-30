/**
 * Presentation-only property states for the Inspector (Checkpoint 4.1).
 * Every state here is derived by a control from data it already reads off
 * the selected element/document model (e.g. "is this edge value still the
 * model's own zero default, or an explicit override") — this is never a
 * second source of truth, and nothing here is persisted.
 */
export type PropertyState =
  | "unset"
  | "set"
  | "inherited"
  | "mixed"
  | "invalid"
  | "not-applicable"
  | "overridden";

/** Short, plain-language description per state — used for the row's accessible status text and the state dot's title. */
export const PROPERTY_STATE_DESCRIPTIONS: Record<PropertyState, string> = {
  unset: "Not set — using the default",
  set: "Explicitly set",
  inherited: "Inherited from a parent",
  mixed: "Mixed values across the selection",
  invalid: "Invalid value",
  "not-applicable": "Does not apply to this element",
  overridden: "Overridden by another property",
};

/** States where the property's own control should read as visually inactive even if not individually disabled. */
export function isInactivePropertyState(state: PropertyState | undefined): boolean {
  return state === "not-applicable" || state === "overridden";
}

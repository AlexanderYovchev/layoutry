/**
 * CSS `position` — Position Foundation (Checkpoint 5.1). Same grouped,
 * fully-optional settings-object shape typography/border/boxShadow/
 * filters/display already established (see EditorElementNode.position),
 * rather than a bare `position?: PositionValue` field directly on the
 * node — this checkpoint's own Future Architecture section names three
 * upcoming checkpoints (5.2 Insets, 5.3 Z-index) that plug straight into
 * this same PositionSettings object (an `inset`/`top`/`left`/... field,
 * a `zIndex` field) without migrating this one, exactly like
 * DisplaySettings already absorbed seven independent fields into one
 * object. `position` itself has no synthesized default — see
 * getPositionSettings/withPositionField, and resolvePositionStyle, which
 * only emits CSS when the field is actually present and structurally
 * valid.
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

export type PositionValue = "static" | "relative" | "absolute" | "fixed" | "sticky";
export const POSITION_VALUES: readonly PositionValue[] = ["static", "relative", "absolute", "fixed", "sticky"];

export interface PositionSettings {
  position?: PositionValue;
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

/**
 * Defensive per-field check for a value that might be malformed loaded-
 * document data — this app has no persistence/import feature yet, but
 * the resolver must still never throw on bad data (see
 * isValidDisplayFieldValue's identical reasoning). Deliberately per-
 * *field*, not a single whole-object gate, so a future malformed inset/
 * zIndex field can't suppress an otherwise-valid `position` value.
 */
export function isValidPositionFieldValue<K extends keyof PositionSettings>(field: K, value: unknown): boolean {
  if (typeof value !== "string") return false;
  switch (field) {
    case "position":
      return isValidPositionValue(value);
    default:
      return false;
  }
}

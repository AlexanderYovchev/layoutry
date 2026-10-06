/**
 * CSS Transition Foundation (Checkpoint 1.15.6.14.1) — the first Animation
 * implementation checkpoint, scoped to ordinary CSS `transition-*`
 * longhands only (no keyframes, no Transform, no pseudo-state styling —
 * see this checkpoint's own report for the full architecture audit this
 * follows). A single, fully-optional, atomic settings object directly on
 * EditorElementNode (`transition`), the same grouped-struct shape
 * typography/background/border/filters/display/position/aspectRatio
 * already establish — NOT a raw CSS string (this app's structured-CSS
 * convention, reaffirmed by this checkpoint's own audit) and NOT an array
 * of transitions (deferred — see Part O of this checkpoint's brief: a
 * single transition definition is the smallest correct v1).
 *
 * Unlike Filters/Display/Typography (where every field is independently
 * optional and the object collapses to `undefined` only once every field
 * has been cleared), TransitionSettings' four fields are only ever
 * meaningful TOGETHER — a transition with a property but no duration is
 * not a smaller, partially-configured transition, it's simply not a
 * useful one. So `EditorElementNode.transition` is binary: either
 * genuinely absent (no authored transition at all — the only state every
 * pre-existing node has) or a complete object with all four fields
 * present. There is no `withTransitionField`-style "collapse to undefined
 * once empty" case the way `withFilterField` has.
 */

export type TransitionProperty = "opacity" | "background-color" | "border-color" | "box-shadow";

export const TRANSITION_PROPERTIES: readonly TransitionProperty[] = ["opacity", "background-color", "border-color", "box-shadow"];

/**
 * Human-readable labels, in the same order as TRANSITION_PROPERTIES —
 * deliberately excludes `all`/`transform`/`width`/`height`/`filter` (see
 * this checkpoint's own architecture audit, Part H): `all` is the least
 * performance-safe option CSS offers, and `transform` has no backing
 * document field yet (a prerequisite the audit explicitly deferred, not
 * silently assumed here).
 */
export const TRANSITION_PROPERTY_LABELS: Record<TransitionProperty, string> = {
  opacity: "Opacity",
  "background-color": "Background Color",
  "border-color": "Border Color",
  "box-shadow": "Box Shadow",
};

export type TransitionTimingFunction = "linear" | "ease" | "ease-in" | "ease-out" | "ease-in-out";

export const TRANSITION_TIMING_FUNCTIONS: readonly TransitionTimingFunction[] = ["linear", "ease", "ease-in", "ease-out", "ease-in-out"];

export const TRANSITION_TIMING_FUNCTION_LABELS: Record<TransitionTimingFunction, string> = {
  linear: "Linear",
  ease: "Ease",
  "ease-in": "Ease In",
  "ease-out": "Ease Out",
  "ease-in-out": "Ease In Out",
};

export interface TransitionSettings {
  property: TransitionProperty;
  /** Milliseconds — this app has no existing time-value representation to reuse, and a 0-5000ms authoring range has no meaningful "unit choice" the way a length (px/rem/em) does, so a plain number was chosen over a `{ value, unit }` wrapper (see this checkpoint's own report, Part I). */
  durationMs: number;
  timingFunction: TransitionTimingFunction;
  delayMs: number;
}

/** The starter values a freshly-ADDED transition gets (Checkpoint 1.15.6.14.1's own Part E) — never stamped onto a node by any factory; only written the first time a user actually chooses a Property in the Inspector. */
export const DEFAULT_TRANSITION_SETTINGS: TransitionSettings = {
  property: "opacity",
  durationMs: 200,
  timingFunction: "ease",
  delayMs: 0,
};

/** A node with no authored transition has no synthesized default here — matching Display/Position/AspectRatio's own convention (see EditorElementNode.transition's own doc comment). Reading a possibly-absent transition for EDITING (where a concrete object is needed to merge a field into) goes through `getTransitionSettings(node) ?? DEFAULT_TRANSITION_SETTINGS` at the call site instead, the same pattern Background's gradient-defaulting already uses. */
export function getTransitionSettings(node: { transition?: TransitionSettings }): TransitionSettings | undefined {
  return node.transition;
}

/** Merges one field into a COMPLETE settings object, returning another complete object — there is no "collapse to undefined" case (see this file's own top comment); clearing the whole transition is a separate, explicit `undefined` write, never reached by field-merging. */
export function withTransitionField<K extends keyof TransitionSettings>(
  current: TransitionSettings,
  field: K,
  value: TransitionSettings[K],
): TransitionSettings {
  return { ...current, [field]: value };
}

/** Rejects NaN/Infinity/-Infinity and negative values — CSS has no meaningful negative transition-duration, matching this checkpoint's own explicit normalization requirement (Part F). */
export function isValidTransitionDurationMs(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

/** Same rule as duration — a negative transition-delay is rejected outright, never clamped, matching isValidTransitionDurationMs. */
export function isValidTransitionDelayMs(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

/** Structural equality for the no-op guards `setElementTransition`/`setElementsTransition`/`setElementsTransitionField` all need (Checkpoint 1.15.6.14.1's own explicit "setting a field to its current value must not push history" requirement) — a plain `===` would always be false for a freshly-spread object literal, the same reason every bulk CSS command in bulkCommands.ts already needs its own `looseFieldEqual`/`cssLengthEqual`-style helper rather than relying on reference identity. */
export function transitionSettingsEqual(a: TransitionSettings | undefined, b: TransitionSettings | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.property === b.property && a.durationMs === b.durationMs && a.timingFunction === b.timingFunction && a.delayMs === b.delayMs;
}

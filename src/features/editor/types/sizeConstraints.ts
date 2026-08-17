/**
 * CSS min-width/min-height/max-width/max-height — Resize & Sizing
 * Controls (Checkpoint 5.7). A new, top-level, fully-optional field
 * directly on EditorElementNode (`sizeConstraints`), following the same
 * "no existing owner, add one deliberately" reasoning aspectRatio.ts
 * documented in Checkpoint 5.5.
 *
 * IMPORTANT NAMING DISTINCTION — do not confuse this with the pre-existing
 * `ElementResizeConstraints` (types/layout.ts, `{ minWidth, minHeight }`):
 * that type is an *interaction floor* — "how small may a pointer-driven
 * resize drag shrink this element?" (64x64 for a leaf, a bigger floor for
 * a container — see getResizeConstraintsForTag) — purely an editor
 * concern, never serialized as CSS and never read by any resolver.
 * `SizeConstraints` (this file) is the real CSS min/max the exported
 * document renders with. Setting a CSS min-width here never touches
 * ElementResizeConstraints, and a pointer resize drag never reads or
 * writes `sizeConstraints` — the two systems are completely independent,
 * on purpose (see the Checkpoint 5.7 changelog for the full audit this
 * distinction is based on).
 *
 * Plain unitless-px numbers, not a structured CSS-length object —
 * deliberately matching ElementDimensions.preferredWidth/preferredHeight
 * (also plain px numbers), which repository inspection confirmed is
 * itself px-only with no unit concept anywhere in the resize engine.
 * Introducing a multi-unit length type just for Min/Max while Width/
 * Height stay unitless px would produce a confusing two-tier unit system
 * within the same Inspector section for no real benefit — see this
 * checkpoint's own report for the full reasoning. A future checkpoint
 * that gives the whole sizing model real CSS units should widen Width/
 * Height and Min/Max together, not just one of the two.
 */
export interface SizeConstraints {
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
}

/** A node with no sizeConstraints set renders with no explicit min/max CSS at all. */
export function getSizeConstraints(node: { sizeConstraints?: SizeConstraints }): SizeConstraints {
  return node.sizeConstraints ?? {};
}

/**
 * A CSS min/max length must be a finite, non-negative number. Zero is
 * valid and meaningful (`min-width: 0` is a common, deliberate flexbox
 * fix overriding the implicit `min-width: auto`) — only negative,
 * NaN/Infinity, and non-number values are rejected.
 */
export function isValidSizeConstraintValue(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/**
 * Sets or clears exactly one constraint field, immutably — mirrors
 * withMediaFitField/withBackgroundField exactly (Checkpoint 4.3/5.6):
 * `value: undefined` deletes the key rather than storing an explicit
 * `undefined`, and the result collapses to `undefined` once no
 * constraints remain. Every field is independent through this helper —
 * no relationship between minWidth/maxWidth (or minHeight/maxHeight) is
 * ever enforced here; CSS itself resolves a conflicting pair, and the
 * Inspector must never silently rewrite one field because of another
 * (see this checkpoint's own report).
 */
export function withSizeConstraintField<K extends keyof SizeConstraints>(
  current: SizeConstraints,
  field: K,
  value: SizeConstraints[K],
): SizeConstraints | undefined {
  const next: SizeConstraints = { ...current, [field]: value };
  if (value === undefined) delete next[field];
  return Object.keys(next).length > 0 ? next : undefined;
}

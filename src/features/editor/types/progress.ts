/**
 * The effective Max used whenever `progressMax` is unset or malformed
 * (Checkpoint 1.15.6.12.4) — an editor-level choice, not native HTML's own
 * obscure fallback (a bare `<progress>` with no `max` attribute defaults to
 * `1` in real Chromium, verified live this checkpoint), since this app's
 * own factory always stamps a concrete, useful starter Max anyway (see
 * createProgressNode) — this constant only matters for malformed/legacy
 * loaded data or an explicit Reset, where "1" would silently make a
 * perfectly ordinary authored Value look complete/overflowing.
 */
export const DEFAULT_PROGRESS_MAX = 100;

/**
 * The resolver-level "effective Max" for a Progress node (Checkpoint
 * 1.15.6.12.4) — the same DEFAULT_OBJECT_FIT/getMediaControls fallback
 * shape every other semantic field in this app already uses: the document
 * never stores a synthesized default, only the rendering/Inspector layer
 * supplies one. Guards against a non-finite or non-positive stored value
 * (native Max must be greater than zero — verified live) by falling back
 * to DEFAULT_PROGRESS_MAX rather than trusting malformed data; never
 * throws.
 */
export function getProgressMax(node: { progressMax?: number }): number {
  const max = node.progressMax;
  return max !== undefined && Number.isFinite(max) && max > 0 ? max : DEFAULT_PROGRESS_MAX;
}

/**
 * The resolver-level "effective Value" for a Progress node (Checkpoint
 * 1.15.6.12.4) — `undefined` is genuinely meaningful here (indeterminate,
 * see EditorElementNode.progressValue's own doc comment), so this
 * deliberately does NOT fall back to a number the way getProgressMax does.
 * A defined value is clamped to `[0, effective Max]` at render time as a
 * defensive guard against malformed/out-of-range loaded data (the document
 * itself may still hold an out-of-range value until the next commit — see
 * setElementProgressValue/setElementProgressMax, which clamp at write
 * time; this is the read-time safety net, never throws).
 */
export function getProgressValue(node: { progressValue?: number; progressMax?: number }): number | undefined {
  const value = node.progressValue;
  if (value === undefined || !Number.isFinite(value)) return undefined;
  const max = getProgressMax(node);
  return Math.min(Math.max(value, 0), max);
}

/**
 * The single source of truth for "is this Progress indeterminate"
 * (Checkpoint 1.15.6.12.4) — purely `progressValue === undefined`, exactly
 * matching native `<progress>`'s own indeterminate state (no `value`
 * attribute at all). No separate `progressIndeterminate` boolean exists
 * anywhere in the document model — see this checkpoint's own report for
 * why one was deliberately rejected.
 */
export function isProgressIndeterminate(node: { progressValue?: number }): boolean {
  return node.progressValue === undefined;
}

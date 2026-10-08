/**
 * CSS Transform Foundation (Checkpoint 1.15.6.14.3) — the first authored
 * visual CSS Transform, approved via the two prior audits (1.15.6.14.2's
 * architecture audit and 1.15.6.14.2.1's transform-aware-geometry
 * feasibility audit, "Policy D"). Unlike TransitionSettings (whose four
 * fields are only ever meaningful together), each field here is
 * independently optional and identity-normalizes back to field-absence —
 * the same per-field-optional/collapse-to-undefined shape FilterSettings
 * already establishes, chosen because translateX/translateY/rotateDeg/
 * scale are independently meaningful (a user plausibly wants only Rotate,
 * leaving Translate/Scale at their identity).
 *
 * Deliberately a traditional composed `transform` CSS string (see
 * resolveTransformStyle), not individual `translate:`/`rotate:`/`scale:`
 * CSS properties — see the 1.15.6.14.2 audit's own Part Q for the full
 * reasoning (a single property composes trivially with the existing
 * single-property TransitionSettings/future-keyframe model). A fixed
 * canonical function order (translate → rotate → scale) is used whenever
 * more than one function is present — see resolveTransformStyle.
 */

export interface TransformSettings {
  /** px. Identity 0 — absent means no horizontal shift. */
  translateX?: number;
  /** px. Identity 0 — absent means no vertical shift. */
  translateY?: number;
  /** Degrees. Identity 0 — absent means no rotation. Never normalized modulo 360 — an authored 360 is distinct, meaningful CSS, not silently reduced to 0 (Checkpoint 1.15.6.14.2.1's own Part C). */
  rotateDeg?: number;
  /** Unitless uniform scale factor (no independent scaleX/scaleY — see this checkpoint's own report, Part S). Identity 1 — absent means no scaling. Zero and negative values are valid, deliberately not rejected or silently normalized (CSS supports both; negative flips) — see this checkpoint's own report for the required explicit QA on zero/negative scale. */
  scale?: number;
}

/** A node with no authored Transform has no synthesized default — same "store unconditionally, no synthesized default" convention Display/Position/AspectRatio/Transition already use. */
export function getTransformSettings(node: { transform?: TransformSettings }): TransformSettings | undefined {
  return node.transform;
}

/**
 * Strips every identity-valued field (translateX/Y: 0, rotateDeg: 0,
 * scale: 1) and collapses to `undefined` once nothing meaningful remains
 * — the same per-field "collapse to undefined once empty" convention
 * withFilterField/withDisplayField already establish. Centralized here so
 * every write path (withTransformField, the bulk commands, the whole-value
 * single-node command) normalizes identically.
 */
export function normalizeTransformSettings(settings: TransformSettings | undefined): TransformSettings | undefined {
  if (!settings) return undefined;
  const next: TransformSettings = {};
  if (settings.translateX !== undefined && settings.translateX !== 0) next.translateX = settings.translateX;
  if (settings.translateY !== undefined && settings.translateY !== 0) next.translateY = settings.translateY;
  if (settings.rotateDeg !== undefined && settings.rotateDeg !== 0) next.rotateDeg = settings.rotateDeg;
  if (settings.scale !== undefined && settings.scale !== 1) next.scale = settings.scale;
  return Object.keys(next).length === 0 ? undefined : next;
}

/** Merges one field into a (possibly absent) settings object, then identity-normalizes the result — see normalizeTransformSettings. Setting a field back to its own identity value removes just that field, not the whole object, unless it was the last meaningful one. */
export function withTransformField<K extends keyof TransformSettings>(
  current: TransformSettings | undefined,
  field: K,
  value: TransformSettings[K],
): TransformSettings | undefined {
  return normalizeTransformSettings({ ...current, [field]: value });
}

/** Rejects NaN/Infinity/-Infinity only — any finite translation is valid authored CSS, including negative. */
export function isValidTransformTranslate(value: number): boolean {
  return Number.isFinite(value);
}

/** Rejects NaN/Infinity/-Infinity only — never normalized modulo 360 (see this file's own top comment). */
export function isValidTransformRotateDeg(value: number): boolean {
  return Number.isFinite(value);
}

/** Rejects NaN/Infinity/-Infinity only — zero and negative scale are valid CSS and deliberately not rejected here (Checkpoint 1.15.6.14.2.1's own Part C explicit instruction); see this checkpoint's own report for the required live QA on both. */
export function isValidTransformScale(value: number): boolean {
  return Number.isFinite(value);
}

/** Structural, identity-normalization-aware equality for the no-op guards every Transform command needs (matching transitionSettingsEqual's own role) — `{ translateX: 0 }` and `undefined` compare equal. */
export function transformSettingsEqual(a: TransformSettings | undefined, b: TransformSettings | undefined): boolean {
  if (a === b) return true;
  const an = normalizeTransformSettings(a);
  const bn = normalizeTransformSettings(b);
  if (!an && !bn) return true;
  if (!an || !bn) return false;
  return an.translateX === bn.translateX && an.translateY === bn.translateY && an.rotateDeg === bn.rotateDeg && an.scale === bn.scale;
}

/**
 * True when `transform` carries a non-identity rotate or scale — the exact
 * condition the ancestor-restriction geometry-safety rule (Checkpoint
 * 1.15.6.14.2.1's own Part V/Policy D) keys on: a translate-only ancestor
 * never blocks descendant move/resize (pure translate never changes the
 * pointer-delta-to-local-delta ratio — see that audit's own Part J), but a
 * non-identity rotate or scale does. Because every stored field is already
 * identity-normalized away (see normalizeTransformSettings), simply
 * checking field PRESENCE is sufficient — a present rotateDeg/scale is
 * always non-identity by construction.
 */
export function hasNonIdentityRotateOrScale(transform: TransformSettings | undefined): boolean {
  if (!transform) return false;
  return transform.rotateDeg !== undefined || transform.scale !== undefined;
}

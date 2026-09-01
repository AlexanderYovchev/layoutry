/**
 * Video's one effective-value derivation (Checkpoint 1.15) — `controls`
 * is the sole boolean field on this tag whose "unset" meaning is NOT
 * "attribute absent" (see EditorElementNode.controls's own doc comment):
 * a freshly created Video with no controls at all would be unusable on
 * the Canvas, so an unset node still renders WITH controls. This mirrors
 * mediaFit's own DEFAULT_OBJECT_FIT resolver-level-fallback pattern — the
 * document never stores a synthesized default, only the rendering layer
 * (VideoElement, and the Inspector's own "effective value" display,
 * matching InspectorMediaSection's identical shape) supplies one.
 */
export function getVideoControls(node: { controls?: boolean }): boolean {
  return node.controls ?? true;
}

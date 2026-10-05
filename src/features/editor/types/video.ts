/**
 * Media's one effective-value derivation (Checkpoint 1.15, generalized to
 * Audio in Checkpoint 1.15.6.12.3) — `controls` is the sole boolean field
 * on either tag whose "unset" meaning is NOT "attribute absent" (see
 * EditorElementNode.controls's own doc comment): a freshly created Video
 * or Audio with no controls at all would be unusable on the Canvas, so an
 * unset node still renders WITH controls. This mirrors mediaFit's own
 * DEFAULT_OBJECT_FIT resolver-level-fallback pattern — the document never
 * stores a synthesized default, only the rendering layer (VideoElement/
 * AudioElement, and the Inspector's own "effective value" display via
 * InspectorMediaPlaybackFields) supplies one. Renamed from
 * `getVideoControls` this checkpoint — the function was already fully
 * generic in behavior (just a plain `node.controls ?? true`), so once
 * Audio became a second real caller, keeping a Video-specific name on a
 * tag-agnostic helper would only have been misleading, not a meaningful
 * API boundary worth preserving; this file itself keeps its existing path
 * rather than being moved/renamed too, to keep the diff minimal.
 */
export function getMediaControls(node: { controls?: boolean }): boolean {
  return node.controls ?? true;
}

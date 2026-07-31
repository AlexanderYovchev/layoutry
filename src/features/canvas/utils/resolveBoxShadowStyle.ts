import { formatShadowLayerCss, getBoxShadowLayers, isValidShadowLayer } from "@/features/editor/types/boxShadow";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { CSSProperties } from "react";

/**
 * Pure Canvas resolver for a node's own box-shadow stack (Checkpoint 4.6) —
 * same shape as resolveBorderStyle/resolveBorderRadiusStyle: emits CSS
 * only when there is at least one enabled, structurally-valid layer to
 * render, never a guessed default. Disabled layers are filtered out
 * entirely (not rendered as a zero-alpha or invisible layer); a malformed
 * layer (defensive against loaded-document data — see isValidShadowLayer)
 * is skipped on its own without preventing the remaining valid layers in
 * the same list from rendering, and never throws. Layer order is
 * preserved exactly as stored, matching real CSS box-shadow's own
 * first-listed-paints-on-top layering.
 */
export function resolveBoxShadowStyle(node: EditorElementNode): CSSProperties {
  const layers = getBoxShadowLayers(node);
  const css = layers
    .filter((layer) => layer.enabled && isValidShadowLayer(layer))
    .map(formatShadowLayerCss)
    .join(", ");
  return css ? { boxShadow: css } : {};
}

import { getClipPathForShapePreset, getShapePreset } from "@/features/editor/types/shape";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { CSSProperties } from "react";

/**
 * Pure Canvas resolver for a node's own Advanced Container Shape
 * (Checkpoint 1.15.4) — same shape as resolveBorderRadiusStyle/
 * resolveDisplayStyle: reads the node's stored preset (getShapePreset,
 * which already resolves an unset/malformed field to "none") and emits
 * `clip-path` only when the preset's own mapping (getClipPathForShapePreset)
 * actually has one. The "none"/Rectangle preset emits an EMPTY style
 * object rather than `clip-path: none` — an omitted property, not an
 * explicit no-op value, is what guarantees a plain rectangular container
 * renders exactly as it did before this checkpoint existed (section 6 of
 * this checkpoint's own brief).
 */
export function resolveShapeStyle(node: EditorElementNode): CSSProperties {
  const clipPath = getClipPathForShapePreset(getShapePreset(node));
  return clipPath ? { clipPath } : {};
}

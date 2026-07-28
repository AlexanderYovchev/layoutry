import { getMediaFitSettings } from "@/features/editor/types/mediaFit";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { CSSProperties } from "react";

/**
 * CSS for the *inner* media element (the real <img>, and video/iframe
 * once those exist) — always fills its outer wrapper box (width/height:
 * 100%, matching that wrapper's own containment sizing) but uses
 * object-fit/object-position to control how the visual content itself
 * behaves within that box, so a Grid/Flex track being stretched to fill
 * (see resolveFlexOrGridChildStyle) never distorts the picture itself.
 * This is deliberately a separate resolver from resolveFlexOrGridChildStyle
 * — that one governs the *outer* wrapper's participation in its parent's
 * layout; this one governs the *inner* content's fit within whatever box
 * the wrapper ends up being.
 */
export function resolveMediaFitStyle(node: EditorElementNode): CSSProperties {
  const { fit, position, preserveAspectRatio } = getMediaFitSettings(node);
  return {
    width: "100%",
    height: "100%",
    maxWidth: "100%",
    maxHeight: "100%",
    objectFit: preserveAspectRatio ? fit : "fill",
    objectPosition: position,
  };
}

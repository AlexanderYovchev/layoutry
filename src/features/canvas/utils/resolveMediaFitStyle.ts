import {
  DEFAULT_OBJECT_FIT,
  DEFAULT_OBJECT_POSITION_AXIS,
  getMediaFitSettings,
  isValidObjectFitValue,
  isValidObjectPositionAxis,
} from "@/features/editor/types/mediaFit";
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
 * the wrapper ends up being. Also deliberately separate from
 * resolveAspectRatioStyle (Checkpoint 5.5), which shapes that same outer
 * wrapper's box — this resolver never reads or writes `aspectRatio`, and
 * is never spread onto the wrapper (see ImageElement: this only ever
 * lands on the inner <img>'s own `style`).
 *
 * Each field falls back independently (Checkpoint 5.6) — a malformed or
 * absent objectFit never suppresses a valid objectPositionX/Y and vice
 * versa, and a malformed single axis never suppresses the other valid
 * axis. This never throws on malformed node data.
 */
export function resolveMediaFitStyle(node: EditorElementNode): CSSProperties {
  const settings = getMediaFitSettings(node);

  const objectFit = settings.objectFit !== undefined && isValidObjectFitValue(settings.objectFit) ? settings.objectFit : DEFAULT_OBJECT_FIT;
  const x = settings.objectPositionX !== undefined && isValidObjectPositionAxis(settings.objectPositionX) ? settings.objectPositionX : DEFAULT_OBJECT_POSITION_AXIS;
  const y = settings.objectPositionY !== undefined && isValidObjectPositionAxis(settings.objectPositionY) ? settings.objectPositionY : DEFAULT_OBJECT_POSITION_AXIS;

  return {
    width: "100%",
    height: "100%",
    maxWidth: "100%",
    maxHeight: "100%",
    objectFit,
    objectPosition: `${x.value}${x.unit} ${y.value}${y.unit}`,
  };
}

import { isValidAspectRatioValue } from "@/features/editor/types/aspectRatio";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { CSSProperties } from "react";

/**
 * Pure Canvas resolver for a node's own CSS `aspect-ratio` (Checkpoint
 * 5.5) — same shape as resolvePositionStyle/resolveDisplayStyle: emits
 * CSS only when the field is actually present and structurally valid,
 * never a guessed default, never throws on malformed loaded-document
 * data, never reads the DOM, never mutates width/height. `{ mode: "auto"
 * }` and a genuinely absent field both currently resolve to no visible
 * difference (`aspectRatio: "auto"` is CSS's own default value), but
 * this resolver still emits the explicit keyword for "auto" rather than
 * omitting it — matching how resolvePositionStyle emits every explicitly
 * chosen PositionValue, including ones that equal the browser default.
 *
 * Deliberately spread alongside the other resolvers in every element
 * component's own style object, in no particular order relative to
 * them — `aspectRatio` cannot collide with width/height/position/
 * display/border/etc. (a distinct CSS property from all of them), unlike
 * the genuine shorthand/longhand precedence resolveDisplayStyle's own
 * overflow field needs.
 */
export function resolveAspectRatioStyle(node: EditorElementNode): CSSProperties {
  const value = node.aspectRatio;
  if (value === undefined || !isValidAspectRatioValue(value)) return {};

  if (value.mode === "auto") return { aspectRatio: "auto" };

  // The exact user-entered numerator/denominator, never a reduced or
  // decimal-converted form — 1920:1080 formats as "1920 / 1080", not
  // "16 / 9" or "1.7777777778" (this checkpoint's own explicit
  // requirement: the document's semantic ratio is the source of truth,
  // never silently renormalized for mathematical neatness).
  return { aspectRatio: `${value.width} / ${value.height}` };
}

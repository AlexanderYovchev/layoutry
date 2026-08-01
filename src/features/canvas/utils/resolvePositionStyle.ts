import { formatOffsetValue, getPositionSettings, isValidPositionFieldValue, OFFSET_SIDES } from "@/features/editor/types/position";
import type { OffsetSide } from "@/features/editor/types/position";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { CSSProperties } from "react";

/**
 * One offset side's contribution to the style object — written as an
 * explicit switch over literal property names, same rationale as
 * resolveBorderRadiusStyle.ts's applyCornerStyle: a generic `keyof
 * CSSProperties` lookup table can't be verified by TypeScript against
 * the specific property's value type, only a literal property name can.
 */
function applyOffsetStyle(style: CSSProperties, side: OffsetSide, value: string): void {
  switch (side) {
    case "top":
      style.top = value;
      break;
    case "right":
      style.right = value;
      break;
    case "bottom":
      style.bottom = value;
      break;
    case "left":
      style.left = value;
      break;
  }
}

/**
 * Pure Canvas resolver for a node's own CSS `position` and inset offsets
 * (Checkpoints 5.1/5.2) — same shape as resolveDisplayStyle/
 * resolveBorderRadiusStyle: emits CSS only for fields actually present
 * and structurally valid, never a guessed default, never throws on
 * malformed loaded-document data. `top`/`right`/`bottom`/`left` are
 * resolved independently of each other and of `position` itself — one
 * malformed offset never suppresses a still-valid sibling offset or the
 * position value (matching isValidPositionFieldValue's own per-field,
 * not per-object, validation).
 *
 * Deliberately does NOT gate offset emission on `position` being
 * non-static here — CSS itself already ignores top/right/bottom/left on
 * a statically positioned element, so resolving them unconditionally is
 * both simpler and harmless; the Inspector is what hides the Offsets
 * subsection while Position is Static (see offsetsApply), for the
 * user-facing "don't show a control with no effect" requirement, not
 * this resolver.
 *
 * Every element component (ButtonElement/ContainerElement/
 * HeadingElement/ImageElement/ParagraphElement) must spread this
 * resolver's result *before* elementPositionStyle (and, in
 * ContainerElement, before its own hostsOwnFreeChildren override) in its
 * style object — see types/position.ts's own doc comment for the full
 * reasoning. In short: the pre-existing Free layout mechanism already
 * writes `position: absolute`/`relative` for its own structural reasons,
 * and that must always win over this general, user-facing field for
 * whichever node it applies to, including against stale document data.
 * This resolver itself stays intentionally unaware of Free layout —
 * exactly like resolveDisplayStyle stays unaware of flowLayout's own
 * display default — the conflict is resolved entirely by spread order at
 * each call site, not inside either pure resolver.
 */
export function resolvePositionStyle(node: EditorElementNode): CSSProperties {
  const settings = getPositionSettings(node);
  const style: CSSProperties = {};

  if (settings.position !== undefined && isValidPositionFieldValue("position", settings.position)) {
    style.position = settings.position;
  }

  for (const side of OFFSET_SIDES) {
    const value = settings[side];
    if (value === undefined || !isValidPositionFieldValue(side, value)) continue;
    applyOffsetStyle(style, side, formatOffsetValue(value));
  }

  return style;
}

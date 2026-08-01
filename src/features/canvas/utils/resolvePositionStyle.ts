import { getPositionSettings, isValidPositionFieldValue } from "@/features/editor/types/position";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { CSSProperties } from "react";

/**
 * Pure Canvas resolver for a node's own CSS `position` (Checkpoint
 * 5.1) — same shape as resolveDisplayStyle: emits CSS only when the
 * field is actually present and structurally valid, never a guessed
 * default, never throws on malformed loaded-document data.
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

  return style;
}

import { getTransitionSettings } from "@/features/editor/types/transition";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { CSSProperties } from "react";

/**
 * Pure Canvas resolver for a node's own CSS Transition (Checkpoint
 * 1.15.6.14.1) — but, unlike every other resolver in this file's own
 * family (resolveFilterStyle, resolveDisplayStyle, ...), this one is NOT a
 * function of the node alone: it also takes `isPreview`, because this
 * checkpoint's own mandatory Design Safety Invariant is that authored
 * transition CSS must NEVER reach the Design canvas (resizing, moving, an
 * Inspector edit, undo/redo, layout changes, text/SVG editing must all
 * remain instant) — only Preview may ever receive the real
 * `transition-*` longhands. The authored `node.transition` itself is
 * completely unaffected by this; only the CSS actually handed to the
 * rendered element is gated, the same isPreview-gated-render-time-output
 * shape `VideoElement`'s own `autoPlay={isPreview && !!node.autoplay}`
 * already established (Checkpoint 1.15.6.12.3) — reused here as the
 * direct precedent, not reinvented.
 *
 * Emits CSS longhands (transitionProperty/transitionDuration/
 * transitionTimingFunction/transitionDelay), never the `transition`
 * shorthand — this checkpoint's own explicit instruction, matching every
 * other multi-field resolver in this file (resolveFilterStyle's own
 * `filter` function list is the one exception, since CSS itself has no
 * longhand for an individual filter function).
 */
export function resolveTransitionStyle(node: EditorElementNode, isPreview: boolean): CSSProperties {
  if (!isPreview) return {};

  const transition = getTransitionSettings(node);
  if (!transition) return {};

  return {
    transitionProperty: transition.property,
    transitionDuration: `${transition.durationMs}ms`,
    transitionTimingFunction: transition.timingFunction,
    transitionDelay: `${transition.delayMs}ms`,
  };
}

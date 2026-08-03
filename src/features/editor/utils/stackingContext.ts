/**
 * Lightweight stacking-context *awareness* for the Inspector's Z-index
 * help text (Checkpoint 5.3) — not a standards-compliant stacking engine.
 * Real CSS stacking-context formation has many triggers (will-change,
 * mix-blend-mode, contain, flex/grid item z-index, and more); this file
 * intentionally covers only the handful of triggers this app's own
 * document model can actually produce today — position + z-index,
 * fixed/sticky, opacity, and CSS filters — matching the brief's own
 * "lightweight... not a full diagnostic engine" scope. It exists purely
 * to decide whether to show a small informational note near the Z-index
 * control (see InspectorPositionSection's StackingSubsection); it is
 * never used by resolvePositionStyle (which stays fully unaware of this
 * file) and never stored in the document.
 */

import { findAncestorChain } from "@/features/editor/utils/findNodeById";
import { getFilterSettings } from "@/features/editor/types/filters";
import { getPositionSettings } from "@/features/editor/types/position";
import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * True when this node's own current settings already establish a new
 * CSS stacking context, by any trigger this app's document model can
 * currently produce:
 *
 *   - `position: fixed` or `position: sticky` — both always create one,
 *     regardless of z-index (a spec detail: only fixed did originally;
 *     sticky was added later, and both are unconditional today).
 *   - `position: relative`/`absolute` with an explicit numeric z-index
 *     (not "auto", not absent) — the ordinary "positioned + real
 *     z-index" trigger. `static` is deliberately excluded: z-index has
 *     no effect on a plain static element (ignoring the flex/grid-item
 *     exception real CSS also allows — this app has no way to know
 *     whether an arbitrary node's *parent* is a flex/grid container from
 *     the node's own settings alone without extra plumbing, and the
 *     brief's own scope keeps this check node-local and simple).
 *   - `opacity < 100` (i.e. CSS opacity < 1) — filters.opacity is a
 *     0-100 percentage in this app's model (see filters.ts).
 *   - Any active CSS filter function (blur/brightness/contrast/
 *     saturate/grayscale/hueRotate/invert/sepia) — `filter: none` is the
 *     only value that does *not* create a stacking context; this app has
 *     no way to set literally `filter: none` distinct from "no filter
 *     fields set at all," so any field being present is treated as
 *     "some filter is active."
 */
export function establishesStackingContext(node: EditorElementNode): boolean {
  const position = getPositionSettings(node);
  if (position.position === "fixed" || position.position === "sticky") return true;
  if (
    (position.position === "relative" || position.position === "absolute") &&
    typeof position.zIndex === "number"
  ) {
    return true;
  }

  const filters = getFilterSettings(node);
  if (filters.opacity !== undefined && filters.opacity < 100) return true;
  if (
    filters.blur !== undefined ||
    filters.brightness !== undefined ||
    filters.contrast !== undefined ||
    filters.saturate !== undefined ||
    filters.grayscale !== undefined ||
    filters.hueRotate !== undefined ||
    filters.invert !== undefined ||
    filters.sepia !== undefined
  ) {
    return true;
  }

  return false;
}

/**
 * True when any ancestor of nodeId (not nodeId itself — see
 * establishesStackingContext for that) up to the document root already
 * establishes a stacking context. Callers that also want to know about
 * the node itself call establishesStackingContext(node) separately —
 * this stays ancestors-only so it composes with a `node` the caller
 * already has in hand (e.g. InspectorPositionSection's own `node` prop)
 * without a redundant second lookup of that same node from the tree.
 */
export function ancestorEstablishesStackingContext(root: EditorElementNode, nodeId: string): boolean {
  return findAncestorChain(root, nodeId).some((ancestor) => establishesStackingContext(ancestor));
}

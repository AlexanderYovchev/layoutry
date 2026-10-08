import { findAncestorChain } from "@/features/editor/utils/findNodeById";
import { getTransformSettings, hasNonIdentityRotateOrScale } from "@/features/editor/types/transform";
import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * The geometry-safety restriction approved by Checkpoint 1.15.6.14.2.1's
 * feasibility audit (Policy D) — NOT a Style Protection concern (see that
 * file's own doc comment; this is a pointer-math-correctness rule, never
 * a CSS lock, and never persisted as its own document field — it derives
 * entirely from currently-authored Transform state). Layoutry's resize/
 * Free-move pointer math assumes a 1:1 viewport-to-local-pixel mapping;
 * a non-identity rotate or scale on an ANCESTOR breaks that assumption
 * (confirmed live in that audit — a 40px pointer delta painted as an 80px
 * visual delta under a 2x ancestor scale), while a translate-only
 * ancestor does not (translate only shifts the coordinate system's
 * origin, never its scale/orientation). Building a general inverse-matrix
 * pointer-conversion engine to fix this properly was explicitly rejected
 * by that audit as out of scope — this narrow, dynamic restriction
 * (blocking only move/resize of the affected descendants, never
 * selection or text/form editing, and clearing immediately once the
 * blocking ancestor's rotate/scale returns to identity) is the approved
 * mitigation instead.
 */
export const TRANSFORM_ANCESTOR_BLOCKED_NOTICE =
  "This element is inside a rotated or scaled container. Reset the ancestor's transform to move or resize it.";

/**
 * The closest ancestor (excluding nodeId itself — findAncestorChain
 * already starts at the immediate parent) whose own authored Transform
 * has a non-identity rotate or scale. Returns undefined when nodeId has
 * no such ancestor (including when nodeId itself has a non-identity
 * rotate/scale — an element's own Transform never blocks itself, per this
 * checkpoint's own Part T "Self Transform Behavior" requirement; only
 * ANCESTORS are ever walked here).
 */
export function getTransformBlockingAncestor(
  document: EditorElementNode,
  nodeId: string,
): EditorElementNode | undefined {
  return findAncestorChain(document, nodeId).find((ancestor) => hasNonIdentityRotateOrScale(getTransformSettings(ancestor)));
}

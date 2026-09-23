import { isHeadingTag } from "@/features/editor/types/heading";
import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * Checkpoint 1.15.6.9.1 — Dialog's accessible name/description, derived
 * fresh at render time from the dialog's own live descendant data, NOT a
 * stored document field. This was the narrowest of the options the
 * checkpoint's own brief laid out (Part C/10): an authored `htmlId` +
 * `aria-labelledby` pair was rejected because `htmlId` is never remapped
 * during duplication (see cloneNodeWithFreshIds — every field is copied by
 * value except id/interactions/svgScene), so two Modal copies on the same
 * page would silently share one DOM id and one would lose its label; a new
 * cross-node reference field (`dialogLabelledByNodeId`) was rejected as
 * inventing generic ARIA-relationship infrastructure the brief explicitly
 * scopes out (Part D). Deriving the label/description directly from the
 * first heading/paragraph descendant's own `text` needs no id at all, so
 * duplication is correct for free (each dialog reads only its own cloned
 * subtree), editing the heading later stays in sync for free (recomputed
 * every render, nothing to go stale), and it exports trivially to any
 * target (a literal `aria-label`/`aria-description` string, unlike
 * `aria-labelledby`, needs no companion id to also be emitted and kept
 * unique across a whole exported document).
 *
 * Scoped to Dialog only — this is not a generic "compute an accessible
 * name for any node" utility, and must not be reused as one.
 */
function findFirstDescendantText(children: EditorElementNode[] | undefined, matchesTag: (tag: string) => boolean): string | undefined {
  if (!children) return undefined;
  for (const child of children) {
    const text = child.text?.trim();
    if (matchesTag(child.tag) && text) return text;
    const nested = findFirstDescendantText(child.children, matchesTag);
    if (nested) return nested;
  }
  return undefined;
}

/**
 * The dialog's own accessible name — the first heading (h1-h6) found
 * anywhere in its subtree, depth-first. Undefined for a bare Dialog with
 * no heading descendant (or an empty one) — deliberately NOT a synthesized
 * fallback like "Dialog"; Part 15 of this checkpoint's own brief is
 * explicit that inventing a fake title is worse than an honestly absent
 * one.
 */
export function resolveDialogAccessibleName(node: EditorElementNode): string | undefined {
  return findFirstDescendantText(node.children, isHeadingTag);
}

/** The dialog's own accessible description — the first paragraph found anywhere in its subtree, depth-first. Same honesty rule as the name: undefined, never invented. */
export function resolveDialogAccessibleDescription(node: EditorElementNode): string | undefined {
  return findFirstDescendantText(node.children, (tag) => tag === "p");
}

import { normalizeSelectionRoots } from "@/features/editor/commands/bulkCommands";
import { insertNode } from "@/features/editor/commands/documentCommands";
import { canParentAcceptChild } from "@/features/editor/rules/insertionRules";
import type { EditorElementNode } from "@/features/editor/types/document";
import { withoutCopiedCurrentState } from "@/features/editor/types/pagination";
import { cloneNodesWithFreshIds } from "@/features/editor/utils/cloneNodeWithFreshIds";
import { findNodeById, findParentId } from "@/features/editor/utils/findNodeById";
import { resolveFreeDestinationPlacement } from "@/features/editor/utils/resolveFreeDestinationPlacement";

/**
 * BC-10.5 — multi-element Copy / Cut / Paste / Duplicate, as pure document
 * functions. The store adds history, Pagination invariants, the save-size
 * guard and notices around them.
 */

/** Selected ids that still exist (never the document root), unique, in selection order. */
export function existingSelectedIds(document: EditorElementNode, ids: readonly string[]): string[] {
  return Array.from(new Set(ids)).filter((id) => id !== document.id && findNodeById(document, id) !== undefined);
}

/**
 * The minimal set of selected subtrees, in DOCUMENT order: a selected
 * element inside another selected element is dropped (its ancestor's
 * subtree already contains it, with every unselected descendant too), and
 * ids that no longer resolve are ignored.
 */
export function orderedSelectionRoots(document: EditorElementNode, ids: readonly string[]): EditorElementNode[] {
  const roots = new Set(normalizeSelectionRoots(document, existingSelectedIds(document, ids)));
  const ordered: EditorElementNode[] = [];
  const visit = (node: EditorElementNode) => {
    if (roots.has(node.id)) {
      ordered.push(node);
      return;
    }
    node.children?.forEach(visit);
  };
  visit(document);
  return ordered;
}

export type CopiesInsertion =
  | {
      ok: true;
      document: EditorElementNode;
      /** The new top-level copies, in order. */
      rootIds: string[];
      /** Copies whose original root was a Pagination's current page (they become ordinary pages). */
      formerCurrentPageIds: Set<string>;
    }
  | { ok: false };

/** Every element id in the tree is unique (a structural check before committing a multi-insert). */
function hasUniqueIds(root: EditorElementNode): boolean {
  const seen = new Set<string>();
  const stack = [root];
  for (let node = stack.pop(); node; node = stack.pop()) {
    if (seen.has(node.id)) return false;
    seen.add(node.id);
    if (node.children) stack.push(...node.children);
  }
  return true;
}

/**
 * Inserts fresh copies of `sources` (cloned as one set, so references
 * between them are remapped to the copies). `placeFor(index)` gives each
 * copy's parent and optional position. All or nothing: if any copy would
 * be rejected, the original document is kept (`ok: false`).
 */
function insertCopies(
  document: EditorElementNode,
  sources: readonly EditorElementNode[],
  placeFor: (index: number) => { parentId: string; afterId?: string } | null,
): CopiesInsertion {
  if (sources.length === 0) return { ok: false };
  const clones = cloneNodesWithFreshIds(sources);
  const formerCurrentPageIds = new Set<string>();
  let next = document;
  for (const [index, clone] of clones.entries()) {
    const place = placeFor(index);
    const parent = place ? findNodeById(next, place.parentId) : undefined;
    if (!place || !parent || !canParentAcceptChild(parent.tag, clone.tag)) return { ok: false };
    // A copy is never "the current page" (one per Pagination, BC-09.3).
    if (sources[index].ariaCurrent === "page") formerCurrentPageIds.add(clone.id);
    const placed = resolveFreeDestinationPlacement(next, place.parentId, withoutCopiedCurrentState(clone));
    const inserted = insertNode(next, place.parentId, placed, place.afterId ? { referenceId: place.afterId, placement: "after" } : undefined);
    if (inserted === next) return { ok: false };
    next = inserted;
  }
  if (!hasUniqueIds(next)) return { ok: false };
  return { ok: true, document: next, rootIds: clones.map((clone) => clone.id), formerCurrentPageIds };
}

/**
 * Multi-paste: every clipboard root lands in the ONE destination container,
 * appended in clipboard order (the single-element paste rule, repeated).
 * Rejected as a whole when the destination can't accept every root.
 */
export function pasteCopiesInto(document: EditorElementNode, destinationParentId: string, sources: readonly EditorElementNode[]): CopiesInsertion {
  return insertCopies(document, sources, () => ({ parentId: destinationParentId }));
}

/**
 * Multi-duplicate: each root's copy goes right after its original, in that
 * original's own parent (so cross-container selections stay where they
 * are). Rejected as a whole if any root has no parent.
 */
export function duplicateRootsInPlace(document: EditorElementNode, roots: readonly EditorElementNode[]): CopiesInsertion {
  return insertCopies(document, roots, (index) => {
    const parentId = findParentId(document, roots[index].id);
    return parentId ? { parentId, afterId: roots[index].id } : null;
  });
}

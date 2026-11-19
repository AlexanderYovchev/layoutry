import { normalizeSelectionRoots } from "@/features/editor/commands/bulkCommands";
import { insertNode } from "@/features/editor/commands/documentCommands";
import { getNavigationLinks, MAX_NAVIGATION_LINKS } from "@/features/editor/commands/navigationLinkCommands";
import { getDefaultFreeElementSizeForNode } from "@/features/editor/factories/elementFactories";
import { canParentAcceptChild } from "@/features/editor/rules/insertionRules";
import type { EditorElementNode } from "@/features/editor/types/document";
import { getLayoutMode, type FreeLayoutGeometry } from "@/features/editor/types/layout";
import { withoutCopiedCurrentState } from "@/features/editor/types/pagination";
import { approximateFreeContainerSize } from "@/features/editor/utils/approximateFreeContainerSize";
import { cloneNodesWithFreshIds } from "@/features/editor/utils/cloneNodeWithFreshIds";
import { findNodeById, findParentId } from "@/features/editor/utils/findNodeById";
import { resolveFreeInsertionPosition } from "@/features/editor/utils/resolveFreeInsertionPosition";
import { withUniqueHtmlIdsForCopies } from "@/features/editor/utils/uniqueHtmlIdsForCopies";

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

/** Why a multi-paste / multi-duplicate was refused (nothing changed). */
export type CopiesRejection = "destination" | "free-bounds" | "navigation-links";

export type CopiesInsertion =
  | {
      ok: true;
      document: EditorElementNode;
      /** The new top-level copies, in order. */
      rootIds: string[];
      /** Copies whose original root was a Pagination's current page and became ordinary pages. */
      formerCurrentPageIds: Set<string>;
      /** A cut current page pasted back into its own Pagination: it stays the current page (BC-09.3). */
      keptCurrentPageId?: string;
    }
  | { ok: false; reason: CopiesRejection };

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
 * BC-10.5.1: whether `after` has a nav with more than MAX_NAVIGATION_LINKS
 * direct links that `before` didn't have that many in: a new nav (a pasted
 * or duplicated Navbar) or one that gained links. The BC-06 rule is "only
 * adding is refused": a nav that already had more is left alone as long as
 * it gains none.
 */
export function exceedsNavigationLinkLimit(before: EditorElementNode, after: EditorElementNode): boolean {
  const stack = [after];
  for (let node = stack.pop(); node; node = stack.pop()) {
    if (node.children) stack.push(...node.children);
    const count = getNavigationLinks(node).length;
    if (count <= MAX_NAVIGATION_LINKS) continue;
    const previous = findNodeById(before, node.id);
    if (!previous || getNavigationLinks(previous).length < count) return true;
  }
  return false;
}

const FREE_GROUP_GAP_PX = 16;

/**
 * BC-10.5.1 — Free-layout geometry for copies landing TOGETHER in one Free
 * container, keeping their arrangement:
 * - copies that already had a Free position keep their offsets from one
 *   another (their stored x/y, shifted so the group starts at 0,0; copies
 *   from different Free containers share one coordinate space);
 * - copies from Flow containers have no position, so they are stacked
 *   below, in order, at their default Free size.
 * The whole group is then placed as ONE block by the same rule as one
 * inserted element (resolveFreeInsertionPosition: the first grid slot
 * where it overlaps no existing child, else a cascade), so a repeated paste
 * lands at a new offset. Sizes are never shrunk to fit: a group larger than
 * the container is refused (null), never distorted. Descendants keep their
 * own geometry inside each copy.
 */
function placeFreeGroup(parent: EditorElementNode, nodes: readonly EditorElementNode[]): FreeLayoutGeometry[] | null {
  const bounds = approximateFreeContainerSize(parent);
  const positioned = nodes.flatMap((node) => (node.freeLayout ? [node.freeLayout] : []));
  const minX = positioned.length > 0 ? Math.min(...positioned.map((geometry) => geometry.x)) : 0;
  const minY = positioned.length > 0 ? Math.min(...positioned.map((geometry) => geometry.y)) : 0;
  let bottom: number | null = positioned.length > 0 ? Math.max(...positioned.map((geometry) => geometry.y - minY + geometry.height)) : null;
  const relative = nodes.map((node): FreeLayoutGeometry => {
    if (node.freeLayout) return { ...node.freeLayout, x: node.freeLayout.x - minX, y: node.freeLayout.y - minY };
    const size = getDefaultFreeElementSizeForNode(node);
    const y = bottom === null ? 0 : bottom + FREE_GROUP_GAP_PX;
    bottom = y + size.height;
    return { x: 0, y, width: size.width, height: size.height };
  });
  const width = Math.max(...relative.map((geometry) => geometry.x + geometry.width));
  const height = Math.max(...relative.map((geometry) => geometry.y + geometry.height));
  if (width > bounds.width || height > bounds.height) return null;
  const existing = (parent.children ?? []).flatMap((child) => (child.freeLayout ? [child.freeLayout] : []));
  const origin = resolveFreeInsertionPosition(existing, { width, height }, bounds);
  const placed = relative.map((geometry) => ({ ...geometry, x: origin.x + geometry.x, y: origin.y + geometry.y }));
  const fits = placed.every((geometry) => geometry.x >= 0 && geometry.y >= 0 && geometry.x + geometry.width <= bounds.width && geometry.y + geometry.height <= bounds.height);
  return fits ? placed : null;
}

interface CopyPlacement {
  parentId: string;
  afterId?: string;
}

/**
 * Inserts fresh copies of `sources`. They are cloned as one set, so
 * references between them are remapped to the copies, and their authored
 * HTML ids are made unique. `placements[index]` gives each copy's parent
 * and optional position. All or nothing: if any copy would be rejected,
 * nothing changes.
 */
function insertCopies(
  document: EditorElementNode,
  sources: readonly EditorElementNode[],
  placements: readonly (CopyPlacement | null)[],
  keepCurrentIndex?: number,
): CopiesInsertion {
  if (sources.length === 0) return { ok: false, reason: "destination" };
  const resolved: CopyPlacement[] = [];
  for (const [index, place] of placements.entries()) {
    const parent = place ? findNodeById(document, place.parentId) : undefined;
    if (!place || !parent || !canParentAcceptChild(parent.tag, sources[index].tag)) return { ok: false, reason: "destination" };
    resolved.push(place);
  }

  const clones = withUniqueHtmlIdsForCopies(document, cloneNodesWithFreshIds(sources));
  const formerCurrentPageIds = new Set<string>();
  let keptCurrentPageId: string | undefined;
  const prepared = clones.map((clone, index) => {
    if (sources[index].ariaCurrent !== "page") return clone;
    if (index === keepCurrentIndex) {
      keptCurrentPageId = clone.id;
      return clone;
    }
    // A copy is never "the current page" (one per Pagination, BC-09.3).
    formerCurrentPageIds.add(clone.id);
    return withoutCopiedCurrentState(clone);
  });

  // Copies going into the same Free container are placed as one group.
  const byParent = new Map<string, number[]>();
  resolved.forEach((place, index) => byParent.set(place.parentId, [...(byParent.get(place.parentId) ?? []), index]));
  for (const [parentId, indices] of byParent) {
    const parent = findNodeById(document, parentId);
    if (!parent || getLayoutMode(parent) !== "free") continue;
    const geometries = placeFreeGroup(parent, indices.map((index) => prepared[index]));
    if (!geometries) return { ok: false, reason: "free-bounds" };
    indices.forEach((index, position) => {
      prepared[index] = { ...prepared[index], freeLayout: geometries[position] };
    });
  }

  let next = document;
  for (const [index, copy] of prepared.entries()) {
    const place = resolved[index];
    const inserted = insertNode(next, place.parentId, copy, place.afterId ? { referenceId: place.afterId, placement: "after" } : undefined);
    if (inserted === next) return { ok: false, reason: "destination" };
    next = inserted;
  }
  if (exceedsNavigationLinkLimit(document, next)) return { ok: false, reason: "navigation-links" };
  if (!hasUniqueIds(next)) return { ok: false, reason: "destination" };
  return { ok: true, document: next, rootIds: prepared.map((copy) => copy.id), formerCurrentPageIds, keptCurrentPageId };
}

/**
 * Multi-paste: every clipboard root lands in the ONE destination container,
 * appended in clipboard order (the single-element paste rule, repeated).
 * The whole paste is rejected if the destination can't accept every root,
 * if a Free destination can't hold the group's arrangement, or if a nav
 * would go over the link limit.
 *
 * `cut.sourceParentIds` (aligned with `sources`) applies the BC-09.3
 * single-element rule to a cut: a cut current page pasted back into the
 * very Pagination it came from stays its current page.
 */
export function pasteCopiesInto(
  document: EditorElementNode,
  destinationParentId: string,
  sources: readonly EditorElementNode[],
  cut?: { sourceParentIds: readonly (string | null)[] },
): CopiesInsertion {
  const keepCurrentIndex = cut
    ? sources.findIndex((source, index) => source.ariaCurrent === "page" && cut.sourceParentIds[index] === destinationParentId)
    : -1;
  return insertCopies(
    document,
    sources,
    sources.map(() => ({ parentId: destinationParentId })),
    keepCurrentIndex === -1 ? undefined : keepCurrentIndex,
  );
}

/**
 * Multi-duplicate: each root's copy goes right after its original, in that
 * original's own parent (so cross-container selections stay where they
 * are). Copies that share a Free parent keep their arrangement as a group.
 * Rejected as a whole if any root has no parent, or for the same reasons as
 * pasteCopiesInto.
 */
export function duplicateRootsInPlace(document: EditorElementNode, roots: readonly EditorElementNode[]): CopiesInsertion {
  return insertCopies(
    document,
    roots,
    roots.map((root) => {
      const parentId = findParentId(document, root.id);
      return parentId ? { parentId, afterId: root.id } : null;
    }),
  );
}

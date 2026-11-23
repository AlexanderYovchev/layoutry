import { removeNodesByIds, updateNodesByIds } from "@/features/editor/commands/bulkCommands";
import { leavesItsLabel, validateMove, type MoveRejectionReason } from "@/features/editor/commands/moveCommands";
import { exceedsNavigationLinkLimit, orderedSelectionRoots, placeFreeGroup } from "@/features/editor/commands/multiClipboardCommands";
import { MAX_PAGINATION_PAGES } from "@/features/editor/commands/paginationCommands";
import { canParentAcceptChild } from "@/features/editor/rules/insertionRules";
import type { EditorElementNode } from "@/features/editor/types/document";
import { getFlowLayoutSettings, getGridContainerSettings } from "@/features/editor/types/flowLayout";
import { getLayoutMode } from "@/features/editor/types/layout";
import { getPaginationParts, isPaginationNode, withoutCopiedCurrentState, type PaginationControlRole } from "@/features/editor/types/pagination";
import { clampGridChildPlacement } from "@/features/editor/utils/clampGridChildPlacement";
import { findAncestorChain, findNodeById, findParentId } from "@/features/editor/utils/findNodeById";
import type { DropZone } from "@/features/editor/utils/resolveDropZone";

/**
 * BC-12.4 — moving SEVERAL selected elements as one operation (Structure
 * multi-drag). The multi-element counterpart of moveCommands.planMove,
 * built on the same rules and the BC-10.5 multi-selection helpers:
 * - the moved set is the minimal selected roots in document order
 *   (orderedSelectionRoots: a selected descendant travels inside its
 *   selected ancestor, never separately, and is never counted twice);
 * - the destination is a gap in the target parent's children with every
 *   moved root taken out; before/after a moved root itself means the gap
 *   it leaves;
 * - every root is removed once and the roots are inserted together, in
 *   document order, in ONE new document (same objects, same ids);
 * - the rules run on that final document: parent/child tags, cycles,
 *   Pagination controls, order and page limit, the Navbar link limit
 *   after removals AND insertions, Free bounds for the whole group;
 * - all or nothing: any failure is a rejection with one reason; a result
 *   identical to the current tree is "unchanged".
 * One selected root is not a batch: callers use planMove for it (the
 * single-element behaviour stays exactly as it was).
 */

export type MultiMovePlan =
  | {
      status: "moved";
      document: EditorElementNode;
      rootIds: string[];
      leftLabel: boolean;
      /** Roots that were a Pagination's current page and left it: they became ordinary pages (BC-09.5). */
      formerCurrentPageIds: Set<string>;
    }
  | { status: "unchanged" }
  | { status: "rejected"; reason: MoveRejectionReason };

const LEADING_ROLES: ReadonlySet<PaginationControlRole> = new Set(["first", "previous"]);
const TRAILING_ROLES: ReadonlySet<PaginationControlRole> = new Set(["next", "last"]);

function parentOf(root: EditorElementNode, id: string): string | null {
  return findParentId(root, id);
}

export function planMultiMove(root: EditorElementNode, ids: readonly string[], targetId: string, zone: DropZone): MultiMovePlan {
  const roots = orderedSelectionRoots(root, ids);
  if (roots.length === 0) return { status: "rejected", reason: "not-found" };
  const movedIds = new Set(roots.map((node) => node.id));
  if (movedIds.has(root.id)) return { status: "rejected", reason: "page" };

  const target = findNodeById(root, targetId);
  if (!target) return { status: "rejected", reason: "not-found" };
  if (findAncestorChain(root, targetId).some((ancestor) => movedIds.has(ancestor.id))) return { status: "rejected", reason: "descendant" };

  // The destination gap, counted among the parent's children that stay.
  let parentId: string;
  let index: number;
  if (zone === "inside") {
    if (movedIds.has(targetId)) return { status: "rejected", reason: "self" };
    parentId = targetId;
    index = (target.children ?? []).filter((child) => !movedIds.has(child.id)).length;
  } else {
    if (targetId === root.id) return { status: "rejected", reason: "beside-page" };
    const found = findParentId(root, targetId);
    if (!found) return { status: "rejected", reason: "not-found" };
    parentId = found;
    const siblings = findNodeById(root, parentId)?.children ?? [];
    const keptBefore = siblings.slice(0, siblings.findIndex((child) => child.id === targetId)).filter((child) => !movedIds.has(child.id)).length;
    index = zone === "after" && !movedIds.has(targetId) ? keptBefore + 1 : keptBefore;
  }
  const destination = findNodeById(root, parentId);
  if (!destination) return { status: "rejected", reason: "not-found" };
  if (roots.some((node) => !canParentAcceptChild(destination.tag, node.tag))) return { status: "rejected", reason: "incompatible-parent" };

  const sourceParents = new Map(roots.map((node) => [node.id, parentOf(root, node.id)]));
  for (const node of roots) {
    const source = findNodeById(root, sourceParents.get(node.id) ?? "");
    if (source && isPaginationNode(source) && getPaginationParts(source).roleById.has(node.id)) return { status: "rejected", reason: "pagination-control" };
  }

  // A result identical to the current tree changes nothing.
  const kept = (destination.children ?? []).filter((child) => !movedIds.has(child.id));
  const finalOrder = [...kept.slice(0, index), ...roots, ...kept.slice(index)].map((child) => child.id);
  const currentOrder = (destination.children ?? []).map((child) => child.id);
  if (roots.every((node) => sourceParents.get(node.id) === parentId) && finalOrder.join("\u0000") === currentOrder.join("\u0000")) {
    return { status: "unchanged" };
  }

  // Geometry for roots ENTERING the destination (same-parent roots keep theirs).
  const entering = roots.filter((node) => sourceParents.get(node.id) !== parentId);
  const formerCurrentPageIds = new Set<string>();
  const prepared = new Map<string, EditorElementNode>();
  for (const node of entering) {
    if (node.ariaCurrent === "page") {
      prepared.set(node.id, withoutCopiedCurrentState(node));
      formerCurrentPageIds.add(node.id);
    }
  }
  const current = (node: EditorElementNode) => prepared.get(node.id) ?? node;
  if (entering.length > 0 && getLayoutMode(destination) === "free") {
    // The BC-10.5.1 group rule: roots from the same Free container keep their
    // offsets, other containers stack as separate groups, Flow roots stack at
    // their default size; the whole group goes to the first free slot, and a
    // group larger than the container is refused (never shrunk).
    const staying = roots.filter((node) => sourceParents.get(node.id) === parentId);
    const geometries = placeFreeGroup(
      { ...destination, children: [...kept, ...staying] },
      entering.map(current),
      entering.map((node) => sourceParents.get(node.id)),
    );
    if (!geometries) return { status: "rejected", reason: "free-bounds" };
    entering.forEach((node, position) => prepared.set(node.id, { ...current(node), freeLayout: geometries[position] }));
  } else if (getFlowLayoutSettings(destination).display === "grid") {
    const grid = getGridContainerSettings(destination);
    for (const node of entering) {
      const gridChild = current(node).gridChild;
      if (gridChild) prepared.set(node.id, { ...current(node), gridChild: clampGridChildPlacement(gridChild, grid) });
    }
  }

  const inserted = roots.map(current);
  const withoutRoots = removeNodesByIds(root, movedIds);
  const document = updateNodesByIds(withoutRoots, new Set([parentId]), (parent) => {
    const children = parent.children ?? [];
    return { ...parent, children: [...children.slice(0, index), ...inserted, ...children.slice(index)] };
  });

  // Rules that depend on the whole resulting tree.
  const after = findNodeById(document, parentId);
  if (after && isPaginationNode(destination)) {
    const roles = getPaginationParts(destination).roleById;
    const beforePages = getPaginationParts(destination).pages.length;
    const afterPages = getPaginationParts(after).pages.length;
    if (afterPages > MAX_PAGINATION_PAGES && afterPages > beforePages) return { status: "rejected", reason: "pagination-page-limit" };
    const children = after.children ?? [];
    const hasRole = (child: EditorElementNode, set: ReadonlySet<PaginationControlRole>) => {
      const role = roles.get(child.id);
      return role !== undefined && set.has(role);
    };
    const lastLeading = children.reduce((last, child, position) => (hasRole(child, LEADING_ROLES) ? position : last), -1);
    const firstTrailing = children.findIndex((child) => hasRole(child, TRAILING_ROLES));
    const misplaced = children.some(
      (child, position) => movedIds.has(child.id) && child.tag === "a" && (position < lastLeading || (firstTrailing !== -1 && position > firstTrailing)),
    );
    if (misplaced) return { status: "rejected", reason: "pagination-order" };
  }
  if (exceedsNavigationLinkLimit(root, document)) return { status: "rejected", reason: "navigation-link-limit" };

  return {
    status: "moved",
    document,
    rootIds: roots.map((node) => node.id),
    leftLabel: roots.some((node) => leavesItsLabel(root, document, node.id)),
    formerCurrentPageIds,
  };
}

/**
 * The verdict for the Structure drop indicator: null when the batch may
 * go ahead (a no-op included). One root is validated exactly like a single
 * element (validateMove).
 */
export function validateMultiMove(root: EditorElementNode, ids: readonly string[], targetId: string, zone: DropZone): MoveRejectionReason | null {
  const roots = orderedSelectionRoots(root, ids);
  if (roots.length === 1) return validateMove(root, roots[0].id, targetId, zone);
  const plan = planMultiMove(root, ids, targetId, zone);
  return plan.status === "rejected" ? plan.reason : null;
}

import { updateNodesByIds } from "@/features/editor/commands/bulkCommands";
import { moveNode } from "@/features/editor/commands/documentCommands";
import { canAddNavigationLink, isNavigationLinkContainer, MAX_NAVIGATION_LINKS } from "@/features/editor/commands/navigationLinkCommands";
import { canAddPaginationPage, MAX_PAGINATION_PAGES } from "@/features/editor/commands/paginationCommands";
import { getDefaultFreeElementSizeForNode } from "@/features/editor/factories/elementFactories";
import { getMoveTargetRejection, type MoveTargetRejection } from "@/features/editor/rules/moveValidationRules";
import { getFlowLayoutSettings, getGridContainerSettings } from "@/features/editor/types/flowLayout";
import { getLayoutMode } from "@/features/editor/types/layout";
import { getPaginationParts, isPaginationNode } from "@/features/editor/types/pagination";
import { approximateFreeContainerSize } from "@/features/editor/utils/approximateFreeContainerSize";
import { clampGridChildPlacement } from "@/features/editor/utils/clampGridChildPlacement";
import { findAncestorChain, findNodeById, findParentId } from "@/features/editor/utils/findNodeById";
import { resolveFreeDestinationPlacement } from "@/features/editor/utils/resolveFreeDestinationPlacement";
import type { DropZone } from "@/features/editor/utils/resolveDropZone";
import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * BC-12.2 — the one movement system shared by Canvas drag, Structure
 * keyboard reorder and (BC-12.3) Structure drag. Every move:
 * 1. passes the structural rules (getMoveTargetRejection);
 * 2. is a no-op when the element would land where it already is;
 * 3. passes the component rules (validateMove: Navbar and Pagination
 *    limits, Pagination controls, Free bounds);
 * 4. is applied by the existing moveNode (the same object, same id), with
 *    the geometry an element needs in its new parent (Free position, Grid
 *    placement clamp) written in the same document.
 * The store adds Pagination invariants and records one history entry.
 */

export type MoveRejectionReason =
  | MoveTargetRejection
  | "navigation-link-limit"
  | "pagination-page-limit"
  | "pagination-control"
  | "pagination-order"
  | "free-bounds";

/** Where a move lands: the parent and the index among its children once the element is taken out. */
export interface MoveDestination {
  parentId: string;
  index: number;
}

export type MovePlan =
  | { status: "moved"; document: EditorElementNode; destination: MoveDestination; leftLabel: boolean }
  | { status: "unchanged" }
  | { status: "rejected"; reason: MoveRejectionReason };

/** What a move did, as reported by the store's moveElement. */
export type MoveOutcome =
  | { status: "moved"; leftLabel: boolean }
  | { status: "unchanged" }
  | { status: "rejected"; reason: MoveRejectionReason };

/** Before/after a sibling, or appended inside a container: the destination parent and index. Null when the target can't be resolved. */
export function resolveMoveDestination(
  root: EditorElementNode,
  nodeId: string,
  targetId: string,
  zone: DropZone,
): MoveDestination | null {
  if (zone === "inside") {
    const target = findNodeById(root, targetId);
    if (!target) return null;
    return { parentId: targetId, index: (target.children ?? []).filter((child) => child.id !== nodeId).length };
  }
  const parentId = findParentId(root, targetId);
  const parent = parentId ? findNodeById(root, parentId) : undefined;
  if (!parentId || !parent) return null;
  const siblings = (parent.children ?? []).filter((child) => child.id !== nodeId);
  const index = siblings.findIndex((child) => child.id === targetId);
  if (index === -1) return null;
  return { parentId, index: zone === "before" ? index : index + 1 };
}

/** Whether `destination` is exactly where the element already is (same parent, same index). */
function isCurrentPosition(root: EditorElementNode, nodeId: string, destination: MoveDestination): boolean {
  const parentId = findParentId(root, nodeId);
  if (parentId !== destination.parentId) return false;
  const parent = findNodeById(root, parentId);
  return (parent?.children ?? []).findIndex((child) => child.id === nodeId) === destination.index;
}

/**
 * The full rule set for a proposed move, without changing anything: null
 * when it may go ahead (including a move to where the element already
 * is, which simply changes nothing). The Canvas drop indicator, the
 * Canvas drop and the Structure panel all use this one function.
 */
export function validateMove(
  root: EditorElementNode,
  nodeId: string,
  targetId: string,
  zone: DropZone,
): MoveRejectionReason | null {
  const structural = getMoveTargetRejection(root, nodeId, targetId, zone);
  if (structural) return structural;
  const destination = resolveMoveDestination(root, nodeId, targetId, zone);
  if (!destination) return "not-found";
  if (isCurrentPosition(root, nodeId, destination)) return null;
  return componentRejection(root, nodeId, destination);
}

function componentRejection(
  root: EditorElementNode,
  nodeId: string,
  destination: MoveDestination,
): MoveRejectionReason | null {
  const node = findNodeById(root, nodeId);
  const destinationParent = findNodeById(root, destination.parentId);
  if (!node || !destinationParent) return "not-found";
  const sourceParentId = findParentId(root, nodeId);
  const sourceParent = sourceParentId ? findNodeById(root, sourceParentId) : undefined;
  const entering = sourceParentId !== destination.parentId;

  // Pagination (BC-09): First/Previous/Next/Last and the ellipsis keep their
  // place, so the controls always frame the pages.
  if (sourceParent && isPaginationNode(sourceParent) && getPaginationParts(sourceParent).roleById.has(nodeId)) {
    return "pagination-control";
  }
  if (isPaginationNode(destinationParent) && node.tag === "a") {
    if (entering && !canAddPaginationPage(destinationParent)) return "pagination-page-limit";
    const roles = getPaginationParts(destinationParent).roleById;
    const siblings = (destinationParent.children ?? []).filter((child) => child.id !== nodeId);
    const leading = siblings.slice(destination.index).some((child) => {
      const role = roles.get(child.id);
      return role === "first" || role === "previous";
    });
    const trailing = siblings.slice(0, destination.index).some((child) => {
      const role = roles.get(child.id);
      return role === "next" || role === "last";
    });
    if (leading || trailing) return "pagination-order";
  }

  // Navbar (BC-06): a link entering a nav is a new link for it.
  if (entering && node.tag === "a" && isNavigationLinkContainer(destinationParent) && !canAddNavigationLink(destinationParent)) {
    return "navigation-link-limit";
  }

  // Free (D8): an element entering a Free container keeps its size, so the
  // container must be able to hold it.
  if (entering && getLayoutMode(destinationParent) === "free") {
    const size = node.freeLayout ?? getDefaultFreeElementSizeForNode(node);
    const bounds = approximateFreeContainerSize(destinationParent);
    if (size.width > bounds.width || size.height > bounds.height) return "free-bounds";
  }

  return null;
}

/**
 * Validates and applies a move. "unchanged" when the element would land
 * where it already is (no history, nothing marked as changed). Entering a
 * different parent:
 * - Free parent: a position by the same rule as insert/paste/duplicate
 *   (resolveFreeDestinationPlacement: its Free size, or its default one,
 *   at the first free slot inside the bounds);
 * - Flow Grid parent: its Grid placement is clamped to that grid's tracks
 *   (clampGridChildPlacement, the rule used when a grid shrinks).
 * Reordering inside the same parent never touches geometry: in a Free
 * container only the paint order changes. Every other setting (Flex item,
 * Grid item under a non-Grid parent, an inert freeLayout in Flow) is kept
 * as authored: the renderers and the Inspector apply it only under a
 * matching parent, and it applies again if the element moves back.
 */
export function planMove(
  root: EditorElementNode,
  nodeId: string,
  targetId: string,
  zone: DropZone,
): MovePlan {
  const structural = getMoveTargetRejection(root, nodeId, targetId, zone);
  if (structural) return { status: "rejected", reason: structural };
  const destination = resolveMoveDestination(root, nodeId, targetId, zone);
  if (!destination) return { status: "rejected", reason: "not-found" };
  if (isCurrentPosition(root, nodeId, destination)) return { status: "unchanged" };
  const rejection = componentRejection(root, nodeId, destination);
  if (rejection) return { status: "rejected", reason: rejection };

  const entering = findParentId(root, nodeId) !== destination.parentId;
  const prepared = entering ? withDestinationGeometry(root, nodeId, destination.parentId) : root;
  const document = moveNode(prepared, nodeId, targetId, zone);
  if (document === prepared) return { status: "rejected", reason: "incompatible-parent" };
  return { status: "moved", document, destination, leftLabel: leavesItsLabel(root, document, nodeId) };
}

function withDestinationGeometry(root: EditorElementNode, nodeId: string, parentId: string): EditorElementNode {
  const node = findNodeById(root, nodeId);
  const parent = findNodeById(root, parentId);
  if (!node || !parent) return root;
  if (getLayoutMode(parent) === "free") {
    const placed = resolveFreeDestinationPlacement(root, parentId, node);
    return updateNodesByIds(root, new Set([nodeId]), (current) => ({ ...current, freeLayout: placed.freeLayout }));
  }
  if (node.gridChild && getFlowLayoutSettings(parent).display === "grid") {
    const gridChild = clampGridChildPlacement(node.gridChild, getGridContainerSettings(parent));
    return updateNodesByIds(root, new Set([nodeId]), (current) => ({ ...current, gridChild }));
  }
  return root;
}

const FORM_CONTROL_TAGS = new Set(["input", "select", "textarea"]);

function containsFormControl(node: EditorElementNode): boolean {
  return FORM_CONTROL_TAGS.has(node.tag) || (node.children ?? []).some(containsFormControl);
}

function nearestLabelId(root: EditorElementNode, nodeId: string): string | undefined {
  return findAncestorChain(root, nodeId).find((ancestor) => ancestor.tag === "label")?.id;
}

/**
 * Whether the move takes a form control out of the Label that names it.
 * The model has no `for` attribute: a label names the control it
 * contains, so leaving that label silently drops the association (D9:
 * allowed, with a notice).
 */
export function leavesItsLabel(before: EditorElementNode, after: EditorElementNode, nodeId: string): boolean {
  const node = findNodeById(before, nodeId);
  if (!node || !containsFormControl(node)) return false;
  const previousLabel = nearestLabelId(before, nodeId);
  return previousLabel !== undefined && previousLabel !== nearestLabelId(after, nodeId);
}

const REJECTION_REASONS: Readonly<Record<MoveRejectionReason, string>> = {
  self: "an element can't be moved onto itself",
  page: "the page itself can't be moved",
  "beside-page": "nothing can be placed beside the page itself",
  descendant: "an element can't be moved into its own contents",
  "not-found": "it is no longer in the page",
  "incompatible-parent": "that place can't contain this kind of element",
  "navigation-link-limit": `a navigation bar can have at most ${MAX_NAVIGATION_LINKS} links`,
  "pagination-page-limit": `a pagination can have at most ${MAX_PAGINATION_PAGES} pages`,
  "pagination-control": "a pagination's First, Previous, Next, Last and ellipsis controls keep their place",
  "pagination-order": "pages stay between a pagination's Previous and Next controls",
  "free-bounds": "it is larger than the free-layout container it would move into",
};

/** One sentence for a refused move, used by the notice and the Structure announcement. */
export function moveRejectedMessage(elementName: string, reason: MoveRejectionReason): string {
  return `${elementName} wasn't moved: ${REJECTION_REASONS[reason]}.`;
}

/** BC-12.4: a refused multi-move, one sentence for the whole batch. */
export function moveBatchRejectedMessage(count: number, reason: MoveRejectionReason): string {
  return `The ${count} elements weren't moved: ${REJECTION_REASONS[reason]}.`;
}

/** BC-12.3: the same reason as a short standalone phrase ("A navigation bar can have at most 12 links"), for the Structure drop indicator. */
export function moveRejectionReasonText(reason: MoveRejectionReason): string {
  const text = REJECTION_REASONS[reason];
  return text.charAt(0).toUpperCase() + text.slice(1);
}

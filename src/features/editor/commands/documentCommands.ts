import { isValidMoveTarget } from "@/features/editor/rules/moveValidationRules";
import { canResizeElement } from "@/features/editor/rules/resizeRules";
import { findNodeById, findParentId } from "@/features/editor/utils/findNodeById";
import { DEFAULT_RESIZE_CONSTRAINTS } from "@/features/editor/types/resize";
import type { DropZone } from "@/features/editor/utils/resolveDropZone";
import type { ElementDimensions, EditorElementNode } from "@/features/editor/types/document";

/**
 * Document mutation layer — the only place the document tree is ever
 * rebuilt. Every future mutation (replaceNode, duplicateNode) belongs
 * here alongside insertNode/removeNode/moveNode, sharing the same
 * immutable-update shape, so callers never splice EditorElementNode
 * arrays directly.
 *
 * Every command returns a new root only along the path that actually
 * changed — untouched branches keep their existing object identity
 * (structural sharing), which is what lets consumers skip re-rendering
 * subtrees that weren't affected.
 */

export interface InsertPosition {
  /** Insert immediately before/after this sibling rather than appending. */
  referenceId: string;
  placement: "before" | "after";
}

export function insertNode(
  root: EditorElementNode,
  parentId: string,
  newNode: EditorElementNode,
  position?: InsertPosition,
): EditorElementNode {
  if (root.id === parentId) {
    const children = root.children ?? [];

    if (!position) {
      return { ...root, children: [...children, newNode] };
    }

    const index = children.findIndex((child) => child.id === position.referenceId);
    if (index === -1) {
      return { ...root, children: [...children, newNode] };
    }
    const insertAt = position.placement === "before" ? index : index + 1;
    return {
      ...root,
      children: [...children.slice(0, insertAt), newNode, ...children.slice(insertAt)],
    };
  }

  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = insertNode(child, parentId, newNode, position);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}

/** Removes nodeId from wherever it currently lives. A no-op (same reference returned) if nodeId isn't found. */
export function removeNode(root: EditorElementNode, nodeId: string): EditorElementNode {
  if (!root.children) return root;

  const filteredChildren = root.children.filter((child) => child.id !== nodeId);
  if (filteredChildren.length !== root.children.length) {
    return { ...root, children: filteredChildren };
  }

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = removeNode(child, nodeId);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}

/**
 * Moves nodeId to sit before/after targetId (as a new sibling in
 * targetId's parent) or inside targetId (appended as its last child).
 * Delegates every safety check to isValidMoveTarget — self-descendant
 * drops, the document root, and non-container "inside" targets are all
 * rejected there, not re-implemented here. Any rejection (including the
 * requested target no longer being reachable after removal) returns the
 * original, completely unmodified root — the moved node is never lost.
 */
export function moveNode(
  root: EditorElementNode,
  nodeId: string,
  targetId: string,
  zone: DropZone,
): EditorElementNode {
  if (!isValidMoveTarget(root, nodeId, targetId, zone)) return root;

  const nodeToMove = findNodeById(root, nodeId);
  if (!nodeToMove) return root;

  const withoutNode = removeNode(root, nodeId);

  if (zone === "inside") {
    const result = insertNode(withoutNode, targetId, nodeToMove);
    return result === withoutNode ? root : result;
  }

  const targetParentId = findParentId(withoutNode, targetId);
  if (!targetParentId) return root;

  const result = insertNode(withoutNode, targetParentId, nodeToMove, {
    referenceId: targetId,
    placement: zone,
  });
  return result === withoutNode ? root : result;
}

/**
 * Sets nodeId's explicit pixel dimensions (and its west/north-anchor
 * offset — see ElementDimensions in document.ts). A no-op (same reference
 * returned) if nodeId doesn't resolve to a resizable tag (see
 * canResizeElement) or doesn't exist — the live resize session already
 * gates on the same rule before a drag can even start, so this is a
 * second, independent check rather than the only one, matching moveNode's
 * "never trust the caller alone" shape. width/height are also clamped
 * defensively to the same minimums the live session enforces, in case a
 * caller ever passes this command a raw value that bypassed
 * computeResizeResult's own clamping — offsetX/offsetY have no such floor
 * (a valid anchor shift can legitimately be any sign or magnitude), so
 * they pass through unchanged.
 */
export function resizeNode(
  root: EditorElementNode,
  nodeId: string,
  dimensions: ElementDimensions,
): EditorElementNode {
  if (root.id === nodeId) {
    if (!canResizeElement(root.tag)) return root;
    const safeDimensions: ElementDimensions = {
      width: Math.max(DEFAULT_RESIZE_CONSTRAINTS.minWidth, dimensions.width),
      height: Math.max(DEFAULT_RESIZE_CONSTRAINTS.minHeight, dimensions.height),
      offsetX: dimensions.offsetX,
      offsetY: dimensions.offsetY,
    };
    return { ...root, dimensions: safeDimensions };
  }

  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = resizeNode(child, nodeId, dimensions);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}

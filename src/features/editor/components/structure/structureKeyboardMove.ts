import { getElementDisplayName } from "@/features/editor/utils/elementDisplayName";
import { findNodeById, findParentId } from "@/features/editor/utils/findNodeById";
import type { DropZone } from "@/features/editor/utils/resolveDropZone";
import type { EditorElementNode } from "@/features/editor/types/document";

/** BC-12.2 (D11): Alt+ArrowUp / ArrowDown / ArrowRight / ArrowLeft on a Structure row. */
export type StructureMoveDirection = "up" | "down" | "into" | "out";

export type KeyboardMoveRequest =
  | { kind: "move"; targetId: string; zone: DropZone }
  | { kind: "unavailable"; message: string };

/**
 * The move a keyboard command asks for, in the shared before/after/inside
 * terms (the store's moveElement validates and applies it):
 * - up: before the previous sibling;
 * - down: after the next sibling;
 * - into: inside the previous sibling, as its last child;
 * - out: right after the current parent.
 * "unavailable" (with what to announce) when there is no such position:
 * the first/last child, no previous sibling, already at the top level, or
 * the page itself.
 */
export function resolveKeyboardMove(
  root: EditorElementNode,
  nodeId: string,
  direction: StructureMoveDirection,
): KeyboardMoveRequest {
  const node = findNodeById(root, nodeId);
  const parentId = findParentId(root, nodeId);
  const parent = parentId ? findNodeById(root, parentId) : undefined;
  if (!node || !parent) return { kind: "unavailable", message: "The page itself can't be moved." };

  const name = getElementDisplayName(node);
  const parentName = getElementDisplayName(parent);
  const siblings = parent.children ?? [];
  const index = siblings.findIndex((child) => child.id === nodeId);

  switch (direction) {
    case "up":
      if (index <= 0) return { kind: "unavailable", message: `${name} is already first in ${parentName}.` };
      return { kind: "move", targetId: siblings[index - 1].id, zone: "before" };
    case "down":
      if (index >= siblings.length - 1) return { kind: "unavailable", message: `${name} is already last in ${parentName}.` };
      return { kind: "move", targetId: siblings[index + 1].id, zone: "after" };
    case "into":
      if (index <= 0) return { kind: "unavailable", message: `There is no element before ${name} to move it into.` };
      return { kind: "move", targetId: siblings[index - 1].id, zone: "inside" };
    case "out":
      if (parent.id === root.id) return { kind: "unavailable", message: `${name} is already at the top level.` };
      return { kind: "move", targetId: parent.id, zone: "after" };
  }
}

/**
 * Where the element now is, read from the document after the move (never
 * the intended position): "Moved Button after Heading, position 3 of 5 in
 * Section." or, when it is first, "Moved Button to the start of Section,
 * position 1 of 5."
 */
export function describeMovedPosition(root: EditorElementNode, nodeId: string): string {
  const node = findNodeById(root, nodeId);
  const parentId = findParentId(root, nodeId);
  const parent = parentId ? findNodeById(root, parentId) : undefined;
  if (!node || !parent) return "";
  const siblings = parent.children ?? [];
  const index = siblings.findIndex((child) => child.id === nodeId);
  const name = getElementDisplayName(node);
  const parentName = getElementDisplayName(parent);
  const position = `position ${index + 1} of ${siblings.length}`;
  if (index === 0) return `Moved ${name} to the start of ${parentName}, ${position}.`;
  return `Moved ${name} after ${getElementDisplayName(siblings[index - 1])}, ${position} in ${parentName}.`;
}

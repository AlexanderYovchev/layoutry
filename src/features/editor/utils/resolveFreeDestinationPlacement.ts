import { getDefaultFreeElementSize } from "@/features/editor/factories/elementFactories";
import { getLayoutMode, getResizeConstraintsForTag } from "@/features/editor/types/layout";
import { approximateFreeContainerSize } from "@/features/editor/utils/approximateFreeContainerSize";
import { findNodeById } from "@/features/editor/utils/findNodeById";
import { normalizeFreeLayoutGeometry } from "@/features/editor/utils/normalizeFreeLayoutGeometry";
import { resolveFreeInsertionPosition } from "@/features/editor/utils/resolveFreeInsertionPosition";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { FreeLayoutGeometry } from "@/features/editor/types/layout";

/**
 * Assigns a node its freeLayout for landing inside a Free destination
 * parent — used by every one-shot placement (insertion, paste,
 * duplicate) so "how does a node get placed into a Free container" is
 * never duplicated between them, exactly mirroring how insertElement/
 * moveElement already share one pipeline. A no-op (returns node
 * unchanged) when the destination isn't Free-mode — Flow placement needs
 * no geometry at all.
 *
 * Never stacks the node exactly on top of an existing child (see
 * resolveFreeInsertionPosition) and never places it outside the parent's
 * bounds (see normalizeFreeLayoutGeometry). node.freeLayout, if it
 * already has one (e.g. a clipboard clone from another Free container),
 * is used as the size to place rather than a tag default — only its
 * position is recomputed for the new destination.
 */
export function resolveFreeDestinationPlacement(
  documentModel: EditorElementNode,
  destinationParentId: string,
  node: EditorElementNode,
): EditorElementNode {
  const parent = findNodeById(documentModel, destinationParentId);
  if (!parent || getLayoutMode(parent) !== "free") return node;

  const parentBounds = approximateFreeContainerSize(parent);
  const existingGeometries = (parent.children ?? [])
    .map((child) => child.freeLayout)
    .filter((geometry): geometry is FreeLayoutGeometry => geometry !== undefined);
  const size = node.freeLayout ?? getDefaultFreeElementSize(node.tag);

  const position = resolveFreeInsertionPosition(existingGeometries, size, parentBounds);
  const freeLayout = normalizeFreeLayoutGeometry(
    { x: position.x, y: position.y, width: size.width, height: size.height },
    parentBounds,
    getResizeConstraintsForTag(node.tag),
  );

  return { ...node, freeLayout };
}

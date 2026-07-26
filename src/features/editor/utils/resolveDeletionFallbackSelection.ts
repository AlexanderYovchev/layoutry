/**
 * What becomes selected right after a node is removed (delete or cut) —
 * the node's own former parent, since that's the container the user was
 * just working in and is guaranteed to still exist. Falls back to no
 * selection at all when that parent was the document root itself, since
 * the root has no canvas visual identity of its own (see
 * elementCapabilities/CanvasInteractionBoundary) and was never a
 * meaningful thing to land selection on.
 */
export function resolveDeletionFallbackSelection(
  removedNodeParentId: string | null,
  documentRootId: string,
): string | null {
  if (!removedNodeParentId || removedNodeParentId === documentRootId) return null;
  return removedNodeParentId;
}

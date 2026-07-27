import type { EditorElementNode } from "@/features/editor/types/document";
import type { FreeLayoutBounds } from "@/features/editor/utils/normalizeFreeLayoutGeometry";

/**
 * A generous default for a Free container with no explicit size of its
 * own yet (e.g. just converted from Flow, never resized) — used only by
 * one-shot placements (insertion, paste, duplicate) that have no live
 * DOM to measure, unlike the interactive move/resize sessions (see
 * measureFreeContainerBounds), which measure the real content box.
 */
const FALLBACK_FREE_CONTAINER_SIZE: FreeLayoutBounds = { width: 400, height: 300 };

/**
 * A Free container's own usable size, approximated from its stored
 * geometry (freeLayout if it's itself a Free child, dimensions if it's a
 * Flow child) — outer size, not inset by border/padding, since the
 * document model has no padding field to subtract. Good enough for
 * deterministic one-shot placement (insertion/paste/duplicate never need
 * pixel-perfect bounds the way a live drag does); the interactive
 * sessions use the DOM-measured measureFreeContainerBounds instead.
 */
export function approximateFreeContainerSize(node: EditorElementNode): FreeLayoutBounds {
  if (node.freeLayout) return { width: node.freeLayout.width, height: node.freeLayout.height };
  if (node.dimensions) return { width: node.dimensions.preferredWidth, height: node.dimensions.preferredHeight };
  return FALLBACK_FREE_CONTAINER_SIZE;
}

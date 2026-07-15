import type { EditorElementNode } from "@/features/editor/types/document";

/**
 * Stable data-* identifiers stamped onto every rendered document node.
 * Future selection, dragging, resizing, and history features read these
 * from the DOM instead of re-deriving node identity from layout.
 */
export function documentNodeAttributes(
  node: EditorElementNode,
  parentId: string | null,
) {
  return {
    "data-node-id": node.id,
    "data-node-type": node.tag,
    "data-parent-id": parentId ?? "",
  } as const;
}

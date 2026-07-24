import { documentNodeAttributes } from "@/features/canvas/utils/documentNodeAttributes";
import type { DocumentElementProps } from "@/features/canvas/types/documentRenderer";

/**
 * Safety net for any node type without a registered renderer (e.g.
 * "section", not yet given its own presentation). Renders children
 * without adding presentation, so new node types degrade gracefully
 * instead of breaking the canvas.
 */
export function FallbackElement({
  node,
  parentId,
  children,
}: DocumentElementProps) {
  return <div {...documentNodeAttributes(node, parentId)}>{children}</div>;
}

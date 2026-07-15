import { documentNodeAttributes } from "@/features/canvas/utils/documentNodeAttributes";
import type { DocumentElementProps } from "@/features/canvas/types/documentRenderer";

/**
 * Safety net for any node type without a registered renderer, including
 * the document root itself (tag "page", which owns no visual identity of
 * its own — the page chrome belongs to DocumentCanvas). Renders children
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

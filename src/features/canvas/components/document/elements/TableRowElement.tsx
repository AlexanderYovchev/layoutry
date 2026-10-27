"use client";

import { useNodeDragSource } from "@/features/canvas/hooks/useNodeDragSource";
import { useNodeDropRegistration } from "@/features/canvas/hooks/useNodeDropRegistration";
import { documentNodeAttributes } from "@/features/canvas/utils/documentNodeAttributes";
import { resolveTableStructureElementStyle } from "@/features/canvas/utils/elementStyleRecipes";
import { cn, mergeRefs } from "@/lib/utils";
import type { DocumentElementProps } from "@/features/canvas/types/documentRenderer";

/**
 * A genuine native `<tr>` (Checkpoint 1.14) — the same restricted-resolver
 * shape TableSectionElement uses and for the identical reason (typography/
 * background/border only, per elementCapabilities.ts's own `tr` override;
 * margin/padding/width/height don't apply to `table-row` per the CSS
 * spec regardless, so elementPositionStyle is correctly left unwired
 * rather than included-but-inert). Never independently text-editable,
 * holding only `<th>`/`<td>` children per insertionRules.ts's own
 * constrained-nesting rule.
 */
export function TableRowElement({ node, parentId, parentLayoutMode, children }: DocumentElementProps) {
  const dropRef = useNodeDropRegistration(node);
  const { setNodeRef: dragRef, listeners, isDragging } = useNodeDragSource(node, parentLayoutMode);

  return (
    <tr
      id={node.htmlId}
      ref={mergeRefs<HTMLTableRowElement>(dropRef, dragRef)}
      {...documentNodeAttributes(node, parentId)}
      className={cn(isDragging && "opacity-40", node.className)}
      style={resolveTableStructureElementStyle(node).style}
      {...listeners}
    >
      {children}
    </tr>
  );
}

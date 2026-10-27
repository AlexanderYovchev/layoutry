"use client";

import { useEditableText } from "@/features/canvas/hooks/useEditableText";
import { useNodeDragSource } from "@/features/canvas/hooks/useNodeDragSource";
import { useNodeDropRegistration } from "@/features/canvas/hooks/useNodeDropRegistration";
import { documentNodeAttributes } from "@/features/canvas/utils/documentNodeAttributes";
import { documentDefaultClasses } from "@/features/canvas/utils/documentDefaultStyles";
import { resolveTableCellElementStyle } from "@/features/canvas/utils/elementStyleRecipes";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { cn, mergeRefs } from "@/lib/utils";
import type { DocumentElementProps } from "@/features/canvas/types/documentRenderer";

type TableCellTag = "th" | "td";

/**
 * A genuine native `<th>`/`<td>` (Checkpoint 1.14) — one component for
 * both, the tag chosen from the document node the same way
 * TableSectionElement chooses thead/tbody/tfoot. A text-bearing leaf, the
 * same shape ListItemElement already uses (node.text via useEditableText —
 * click selects, double-click edits, Enter commits, Escape cancels, Blur
 * commits, an unchanged edit produces no history — see useEditableText's
 * own contract, unmodified here).
 *
 * Never independently resizable via a Canvas drag handle (see
 * elementCapabilities.ts's own th/td override, whose doc comment explains
 * why — no colgroup/shared-column-width model exists yet, so a resize
 * handle on one cell can't move the rest of its column). The Inspector's
 * own Size section IS still available (supportsAspectRatio stays true),
 * so elementPositionStyle/resolveAspectRatioStyle/resolveSizeConstraintsStyle
 * are still wired here, unlike TableSectionElement/TableRowElement —
 * width/height/padding (unlike margin) genuinely do apply to `table-cell`
 * per the CSS box model spec, so this is a real, effective control, not a
 * dead one. resolveDisplayStyle/resolvePositionStyle are deliberately NOT
 * imported at all (supportsDisplay/supportsPosition are both false — see
 * that override's own doc comment for why either would silently break
 * native table-cell layout), the same "only resolve what the tag's own
 * capabilities actually grant" precedent OptionElement/
 * TableSectionElement/TableRowElement already established.
 */
export function TableCellElement({ node, parentId, parentLayoutMode }: DocumentElementProps) {
  const dropRef = useNodeDropRegistration(node);
  const { setNodeRef: dragRef, listeners, isDragging } = useNodeDragSource(node, parentLayoutMode);
  const editable = useEditableText(node);
  const isPreview = useEditorStore((state) => state.editorMode === "preview");
  const recipe = resolveTableCellElementStyle(node, { parentLayoutMode, parentFlowDisplay: "block", isPreview });

  const Tag = node.tag as TableCellTag;

  return (
    <Tag
      id={node.htmlId}
      ref={mergeRefs<HTMLElement>(dropRef, dragRef, editable.elementRef)}
      {...documentNodeAttributes(node, parentId)}
      {...editable.editableProps}
      className={cn(
        documentDefaultClasses(recipe.defaults),
        editable.isEditing && "outline-none",
        isDragging && "opacity-40",
        node.className,
      )}
      style={recipe.style}
      {...(editable.isEditing ? undefined : listeners)}
    >
      {node.text}
    </Tag>
  );
}

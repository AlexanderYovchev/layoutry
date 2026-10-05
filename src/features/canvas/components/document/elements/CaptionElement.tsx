"use client";

import { useEditableText } from "@/features/canvas/hooks/useEditableText";
import { useNodeDragSource } from "@/features/canvas/hooks/useNodeDragSource";
import { useNodeDropRegistration } from "@/features/canvas/hooks/useNodeDropRegistration";
import { documentNodeAttributes } from "@/features/canvas/utils/documentNodeAttributes";
import { elementPositionStyle } from "@/features/canvas/utils/elementDimensionsStyle";
import { resolveAspectRatioStyle } from "@/features/canvas/utils/resolveAspectRatioStyle";
import { resolveBackgroundStyle } from "@/features/canvas/utils/resolveBackgroundStyle";
import { resolveBorderRadiusStyle } from "@/features/canvas/utils/resolveBorderRadiusStyle";
import { resolveBorderStyle } from "@/features/canvas/utils/resolveBorderStyle";
import { resolveBoxShadowStyle } from "@/features/canvas/utils/resolveBoxShadowStyle";
import { resolveFilterStyle } from "@/features/canvas/utils/resolveFilterStyle";
import { resolveSizeConstraintsStyle } from "@/features/canvas/utils/resolveSizeConstraintsStyle";
import { resolveTypographyStyle } from "@/features/canvas/utils/resolveTypographyStyle";
import { cn, mergeRefs } from "@/lib/utils";
import type { DocumentElementProps } from "@/features/canvas/types/documentRenderer";

/**
 * A genuine native `<caption>` (Checkpoint 1.15.6.12.2) — a text-bearing
 * leaf, the same shape ListItemElement/TableCellElement already use.
 * Never wrapped in a div: rendered directly as the table's own `<caption>`
 * child, exactly where native table layout expects it.
 *
 * resolveDisplayStyle/resolvePositionStyle are deliberately NOT imported at
 * all (supportsDisplay/supportsPosition are both false — see
 * elementCapabilities.ts's own caption override for why either would
 * silently pull it out of its native position relative to the table), and
 * resolveFlexOrGridChildStyle/parentFlowDisplay are not used either — the
 * exact same "only resolve what the tag's own capabilities actually grant,
 * and skip what native table layout already owns" precedent
 * TableCellElement's own doc comment establishes for th/td.
 */
export function CaptionElement({ node, parentId, parentLayoutMode }: DocumentElementProps) {
  const dropRef = useNodeDropRegistration(node);
  const { setNodeRef: dragRef, listeners, isDragging } = useNodeDragSource(node, parentLayoutMode);
  const editable = useEditableText(node);

  return (
    <caption
      id={node.htmlId}
      ref={mergeRefs<HTMLElement>(dropRef, dragRef, editable.elementRef)}
      {...documentNodeAttributes(node, parentId)}
      {...editable.editableProps}
      className={cn(
        "px-3 py-2 text-left text-sm text-zinc-600 dark:text-zinc-400",
        editable.isEditing && "outline-none",
        isDragging && "opacity-40",
        node.className,
      )}
      style={{
        ...elementPositionStyle(node, parentLayoutMode),
        ...resolveAspectRatioStyle(node),
        ...resolveSizeConstraintsStyle(node, parentLayoutMode),
        ...resolveTypographyStyle(node),
        ...resolveBackgroundStyle(node),
        ...resolveBorderStyle(node),
        ...resolveBorderRadiusStyle(node),
        ...resolveBoxShadowStyle(node),
        ...resolveFilterStyle(node),
      }}
      {...(editable.isEditing ? undefined : listeners)}
    >
      {node.text}
    </caption>
  );
}

"use client";

import { useNodeDragSource } from "@/features/canvas/hooks/useNodeDragSource";
import { useNodeDropRegistration } from "@/features/canvas/hooks/useNodeDropRegistration";
import { documentNodeAttributes } from "@/features/canvas/utils/documentNodeAttributes";
import { resolveBackgroundStyle } from "@/features/canvas/utils/resolveBackgroundStyle";
import { resolveBorderStyle } from "@/features/canvas/utils/resolveBorderStyle";
import { resolveTypographyStyle } from "@/features/canvas/utils/resolveTypographyStyle";
import { cn, mergeRefs } from "@/lib/utils";
import type { DocumentElementProps } from "@/features/canvas/types/documentRenderer";

type TableSectionTag = "thead" | "tbody" | "tfoot";

/**
 * A genuine native `<thead>`/`<tbody>`/`<tfoot>` (Checkpoint 1.14) — one
 * component for all three, the tag chosen from the document node exactly
 * the way ContainerElement's own SEMANTIC_TAGS pattern chooses
 * header/nav/main/etc., since all three share identical rendering: a
 * structural row-grouping container, never independently text-editable,
 * holding only `<tr>` children (insertionRules.ts).
 *
 * Deliberately resolves only the three CSS concerns elementCapabilities.ts's
 * own thead/tbody/tfoot override actually grants — typography/background/
 * border — never importing position/aspect-ratio/size-constraints/
 * flex-or-grid-child/display/border-radius/box-shadow/filter resolvers at
 * all, the same "only wire what the tag's own capabilities actually
 * grant" precedent OptionElement already established in Checkpoint 1.13.
 * This is more than a cosmetic restriction for margin/padding/width/
 * height specifically: per the CSS box model spec, those properties do
 * not apply to table-row-group/table-header-group/table-footer-group in
 * the first place (only 'table' and 'table-cell' honor them) — wiring
 * elementPositionStyle here would silently emit inline styles the
 * browser itself ignores, so it's correctly left out entirely rather
 * than included-but-inert (see this checkpoint's report, section J).
 */
export function TableSectionElement({ node, parentId, parentLayoutMode, children }: DocumentElementProps) {
  const dropRef = useNodeDropRegistration(node);
  const { setNodeRef: dragRef, listeners, isDragging } = useNodeDragSource(node, parentLayoutMode);

  const Tag = node.tag as TableSectionTag;

  return (
    <Tag
      id={node.htmlId}
      ref={mergeRefs<HTMLElement>(dropRef, dragRef)}
      {...documentNodeAttributes(node, parentId)}
      className={cn(isDragging && "opacity-40", node.className)}
      style={{
        ...resolveTypographyStyle(node),
        ...resolveBackgroundStyle(node),
        ...resolveBorderStyle(node),
      }}
      {...listeners}
    >
      {children}
    </Tag>
  );
}

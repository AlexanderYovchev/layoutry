"use client";

import { useNodeDragSource } from "@/features/canvas/hooks/useNodeDragSource";
import { useNodeDropRegistration } from "@/features/canvas/hooks/useNodeDropRegistration";
import { documentNodeAttributes } from "@/features/canvas/utils/documentNodeAttributes";
import { useNodeStyle } from "@/features/canvas/hooks/useNodeStyle";
import { cn, mergeRefs } from "@/lib/utils";
import type { DocumentElementProps } from "@/features/canvas/types/documentRenderer";

/**
 * A genuine native `<table>` (Checkpoint 1.14) — deliberately NOT rendered
 * through ContainerElement, even though Table is a childable tag exactly
 * like div/section/ul/ol: ContainerElement's own legacy "no explicit
 * flowLayout yet" fallback unconditionally applies Tailwind's
 * `flex flex-col items-start gap-4` classes, and resolveFlowLayoutStyle
 * would apply `display: flex/grid/block` the moment a flowLayout WAS set
 * on the node — either one would replace this element's native
 * `display: table` formatting context, exactly the "a `<tr
 * style="display:flex">` would fundamentally stop behaving like a table
 * row" hazard this checkpoint's own brief warns about, one level up.
 * createTableNode never sets flowLayout, and this component never reads
 * or applies one, so native table layout governs the thead/tbody/tfoot
 * children entirely — see elementCapabilities.ts's own
 * `supportsChildLayout: false` override for `table`, which also keeps
 * the Inspector's Flow/Flex/Grid Layout section from even offering a
 * control with no real effect here.
 *
 * `border-collapse` is applied unconditionally, the same way
 * ContainerElement applies `list-disc`/`list-decimal` unconditionally to
 * ul/ol — a fixed rendering-mode default with no corresponding Inspector
 * field (see this checkpoint's report, section J, on why one wasn't
 * added), not a per-node style a real CSS property could someday
 * override or conflict with.
 */
export function TableElement({ node, parentId, parentLayoutMode, parentFlowDisplay, children }: DocumentElementProps) {
  const dropRef = useNodeDropRegistration(node);
  const { setNodeRef: dragRef, listeners, isDragging } = useNodeDragSource(node, parentLayoutMode);
  const nodeStyle = useNodeStyle(node, parentLayoutMode, parentFlowDisplay);

  return (
    <table
      id={node.htmlId}
      ref={mergeRefs<HTMLTableElement>(dropRef, dragRef)}
      {...documentNodeAttributes(node, parentId)}
      className={cn(
        nodeStyle.className,
        isDragging && "opacity-40",
        nodeStyle.authoredClassName,
      )}
      style={nodeStyle.style}
      {...nodeStyle.overrideAttributes}
      {...listeners}
    >
      {children}
    </table>
  );
}

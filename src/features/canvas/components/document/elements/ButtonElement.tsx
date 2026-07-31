"use client";

import { useNodeDragSource } from "@/features/canvas/hooks/useNodeDragSource";
import { useNodeDropRegistration } from "@/features/canvas/hooks/useNodeDropRegistration";
import { documentNodeAttributes } from "@/features/canvas/utils/documentNodeAttributes";
import { elementPositionStyle } from "@/features/canvas/utils/elementDimensionsStyle";
import { resolveBackgroundStyle } from "@/features/canvas/utils/resolveBackgroundStyle";
import { resolveBorderRadiusStyle } from "@/features/canvas/utils/resolveBorderRadiusStyle";
import { resolveBorderStyle } from "@/features/canvas/utils/resolveBorderStyle";
import { resolveFlexOrGridChildStyle } from "@/features/canvas/utils/resolveFlexOrGridChildStyle";
import { resolveTypographyStyle } from "@/features/canvas/utils/resolveTypographyStyle";
import { cn, mergeRefs } from "@/lib/utils";
import type { DocumentElementProps } from "@/features/canvas/types/documentRenderer";

export function ButtonElement({ node, parentId, parentLayoutMode, parentFlowDisplay }: DocumentElementProps) {
  const dropRef = useNodeDropRegistration(node);
  const { setNodeRef: dragRef, listeners, isDragging } = useNodeDragSource(node, parentLayoutMode);

  // The button's own default "rounded-md" look (Checkpoint 4.5) is
  // gated the same way Container/Image's chrome rounding is: a Tailwind
  // shorthand `border-radius` rule still governs any corner an inline
  // longhand doesn't touch, so an "Individual Corners" radius set on
  // only one corner would otherwise leave the default 6px rounding
  // silently active on the other three.
  const usesLegacyRadiusChrome = !node.borderRadius;

  return (
    <button
      type="button"
      ref={mergeRefs(dropRef, dragRef)}
      {...documentNodeAttributes(node, parentId)}
      className={cn(
        "inline-flex w-fit items-center justify-center bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm dark:bg-zinc-50 dark:text-zinc-900",
        usesLegacyRadiusChrome && "rounded-md",
        isDragging && "opacity-40",
      )}
      style={{
        ...elementPositionStyle(node, parentLayoutMode, { clipOverflowY: true }),
        ...resolveFlexOrGridChildStyle(node, parentFlowDisplay),
        ...resolveTypographyStyle(node),
        ...resolveBackgroundStyle(node),
        ...resolveBorderStyle(node),
        ...resolveBorderRadiusStyle(node),
      }}
      {...listeners}
    >
      {node.text}
    </button>
  );
}

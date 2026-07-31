"use client";

import { useNodeDragSource } from "@/features/canvas/hooks/useNodeDragSource";
import { useNodeDropRegistration } from "@/features/canvas/hooks/useNodeDropRegistration";
import { documentNodeAttributes } from "@/features/canvas/utils/documentNodeAttributes";
import { elementPositionStyle } from "@/features/canvas/utils/elementDimensionsStyle";
import { resolveBackgroundStyle } from "@/features/canvas/utils/resolveBackgroundStyle";
import { resolveBorderRadiusStyle } from "@/features/canvas/utils/resolveBorderRadiusStyle";
import { resolveBorderStyle } from "@/features/canvas/utils/resolveBorderStyle";
import { resolveBoxShadowStyle } from "@/features/canvas/utils/resolveBoxShadowStyle";
import { resolveFilterStyle } from "@/features/canvas/utils/resolveFilterStyle";
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
  // The "shadow-sm" class below predates real box-shadow data (Checkpoint
  // 4.6) — pure editor chrome. Unlike the border/radius chrome above,
  // box-shadow is a single CSS property (not four independent per-side/
  // per-corner longhands), so an inline `boxShadow` always fully overrides
  // this class the moment it's written — but a node whose layers are all
  // disabled still has `boxShadow` set (a deliberate, non-empty choice;
  // see resolveBoxShadowStyle), and must not have this default chrome
  // shadow silently reappear underneath that explicit "no shadow" state.
  const usesLegacyShadowChrome = !node.boxShadow;

  return (
    <button
      type="button"
      ref={mergeRefs(dropRef, dragRef)}
      {...documentNodeAttributes(node, parentId)}
      className={cn(
        "inline-flex w-fit items-center justify-center bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900",
        usesLegacyRadiusChrome && "rounded-md",
        usesLegacyShadowChrome && "shadow-sm",
        isDragging && "opacity-40",
      )}
      style={{
        ...elementPositionStyle(node, parentLayoutMode, { clipOverflowY: true }),
        ...resolveFlexOrGridChildStyle(node, parentFlowDisplay),
        ...resolveTypographyStyle(node),
        ...resolveBackgroundStyle(node),
        ...resolveBorderStyle(node),
        ...resolveBorderRadiusStyle(node),
        ...resolveBoxShadowStyle(node),
        ...resolveFilterStyle(node),
      }}
      {...listeners}
    >
      {node.text}
    </button>
  );
}

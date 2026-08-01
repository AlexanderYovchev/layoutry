"use client";

import { useNodeDragSource } from "@/features/canvas/hooks/useNodeDragSource";
import { useNodeDropRegistration } from "@/features/canvas/hooks/useNodeDropRegistration";
import { documentNodeAttributes } from "@/features/canvas/utils/documentNodeAttributes";
import { elementPositionStyle } from "@/features/canvas/utils/elementDimensionsStyle";
import { resolveBackgroundStyle } from "@/features/canvas/utils/resolveBackgroundStyle";
import { resolveBorderRadiusStyle } from "@/features/canvas/utils/resolveBorderRadiusStyle";
import { resolveBorderStyle } from "@/features/canvas/utils/resolveBorderStyle";
import { resolveBoxShadowStyle } from "@/features/canvas/utils/resolveBoxShadowStyle";
import { resolveDisplayStyle } from "@/features/canvas/utils/resolveDisplayStyle";
import { resolveFilterStyle } from "@/features/canvas/utils/resolveFilterStyle";
import { resolveFlexOrGridChildStyle } from "@/features/canvas/utils/resolveFlexOrGridChildStyle";
import { resolveTypographyStyle } from "@/features/canvas/utils/resolveTypographyStyle";
import { cn, mergeRefs } from "@/lib/utils";
import type { DocumentElementProps } from "@/features/canvas/types/documentRenderer";

const HEADING_TAGS = ["h1", "h2", "h3", "h4", "h5", "h6"] as const;
type HeadingTag = (typeof HEADING_TAGS)[number];

function isHeadingTag(tag: string): tag is HeadingTag {
  return (HEADING_TAGS as readonly string[]).includes(tag);
}

export function HeadingElement({ node, parentId, parentLayoutMode, parentFlowDisplay }: DocumentElementProps) {
  const Tag = isHeadingTag(node.tag) ? node.tag : "h2";
  const dropRef = useNodeDropRegistration(node);
  const { setNodeRef: dragRef, listeners, isDragging } = useNodeDragSource(node, parentLayoutMode);
  // elementPositionStyle's clipOverflowY sets the `overflow` shorthand —
  // harmless on its own, but co-existing in the same style object as this
  // checkpoint's explicit overflowX/overflowY longhands (Checkpoint 4.8)
  // trips React's own "don't mix shorthand and non-shorthand for the same
  // value" warning, and leaves the two genuinely fighting over the same
  // box. Once either axis is explicitly set, this legacy resize-clip
  // shorthand must get out of the way entirely, the same way every other
  // pre-4.x chrome default already does once real data exists.
  const usesLegacyOverflowClip = !node.display?.overflowX && !node.display?.overflowY;

  return (
    <Tag
      ref={mergeRefs(dropRef, dragRef)}
      {...documentNodeAttributes(node, parentId)}
      className={cn(
        "text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50",
        isDragging && "opacity-40",
      )}
      style={{
        ...elementPositionStyle(node, parentLayoutMode, { clipOverflowY: usesLegacyOverflowClip }),
        ...resolveFlexOrGridChildStyle(node, parentFlowDisplay),
        ...resolveTypographyStyle(node),
        ...resolveBackgroundStyle(node),
        ...resolveBorderStyle(node),
        ...resolveBorderRadiusStyle(node),
        ...resolveBoxShadowStyle(node),
        ...resolveFilterStyle(node),
        ...resolveDisplayStyle(node),
      }}
      {...listeners}
    >
      {node.text}
    </Tag>
  );
}

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
import { resolvePositionStyle } from "@/features/canvas/utils/resolvePositionStyle";
import { resolveTypographyStyle } from "@/features/canvas/utils/resolveTypographyStyle";
import { cn, mergeRefs } from "@/lib/utils";
import type { DocumentElementProps } from "@/features/canvas/types/documentRenderer";

export function ParagraphElement({ node, parentId, parentLayoutMode, parentFlowDisplay }: DocumentElementProps) {
  const dropRef = useNodeDropRegistration(node);
  const { setNodeRef: dragRef, listeners, isDragging } = useNodeDragSource(node, parentLayoutMode);
  // elementPositionStyle's clipOverflowY sets the `overflow` shorthand —
  // harmless on its own, but co-existing in the same style object as this
  // checkpoint's explicit overflow/overflowX/overflowY fields (Checkpoint
  // 4.8, extended with the unified `overflow` shorthand in 5.4) trips
  // React's own "don't mix shorthand and non-shorthand for the same
  // value" warning, and leaves the two genuinely fighting over the same
  // box. Once any of the three is explicitly set, this legacy resize-clip
  // shorthand must get out of the way entirely, the same way every other
  // pre-4.x chrome default already does once real data exists.
  const usesLegacyOverflowClip = !node.display?.overflow && !node.display?.overflowX && !node.display?.overflowY;

  return (
    <p
      ref={mergeRefs(dropRef, dragRef)}
      {...documentNodeAttributes(node, parentId)}
      className={cn(
        "text-base leading-relaxed text-zinc-600 dark:text-zinc-400",
        // The 65ch reading-measure default only applies while the
        // paragraph sizes itself naturally — an explicit resize (which
        // sets an inline width) or a Free child's own inline width (which
        // is never "natural") must win over it, not silently get capped
        // back down to prose width by this class.
        parentLayoutMode !== "free" && !node.dimensions && "max-w-prose",
        isDragging && "opacity-40",
      )}
      style={{
        // resolvePositionStyle spread first, and elementPositionStyle after
        // (Checkpoint 5.1) — a Free child's own position: absolute (see
        // freeChildStyle, applied inside elementPositionStyle) must always
        // win over this checkpoint's general Position control; see
        // types/position.ts's own doc comment for the full ownership
        // conflict this resolves.
        ...resolvePositionStyle(node),
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
    </p>
  );
}

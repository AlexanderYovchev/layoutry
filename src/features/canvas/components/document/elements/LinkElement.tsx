"use client";

import type { MouseEvent as ReactMouseEvent } from "react";
import { useEditableText } from "@/features/canvas/hooks/useEditableText";
import { useNodeDragSource } from "@/features/canvas/hooks/useNodeDragSource";
import { useNodeDropRegistration } from "@/features/canvas/hooks/useNodeDropRegistration";
import { documentNodeAttributes } from "@/features/canvas/utils/documentNodeAttributes";
import { elementPositionStyle } from "@/features/canvas/utils/elementDimensionsStyle";
import { resolveBackgroundStyle } from "@/features/canvas/utils/resolveBackgroundStyle";
import { resolveBorderRadiusStyle } from "@/features/canvas/utils/resolveBorderRadiusStyle";
import { resolveBorderStyle } from "@/features/canvas/utils/resolveBorderStyle";
import { resolveBoxShadowStyle } from "@/features/canvas/utils/resolveBoxShadowStyle";
import { resolveAspectRatioStyle } from "@/features/canvas/utils/resolveAspectRatioStyle";
import { resolveSizeConstraintsStyle } from "@/features/canvas/utils/resolveSizeConstraintsStyle";
import { resolveDisplayStyle } from "@/features/canvas/utils/resolveDisplayStyle";
import { resolveFilterStyle } from "@/features/canvas/utils/resolveFilterStyle";
import { resolveFlexOrGridChildStyle } from "@/features/canvas/utils/resolveFlexOrGridChildStyle";
import { resolvePositionStyle } from "@/features/canvas/utils/resolvePositionStyle";
import { resolveTypographyStyle } from "@/features/canvas/utils/resolveTypographyStyle";
import { getLinkHref } from "@/features/editor/types/link";
import { cn, mergeRefs } from "@/lib/utils";
import type { DocumentElementProps } from "@/features/canvas/types/documentRenderer";

/**
 * Genuine navigation is never appropriate while designing a page —
 * clicking a Link on the Canvas must select/edit it, not carry the
 * whole Layoutry app away to its destination. preventDefault() is the
 * smallest possible fix: it stops the browser's default anchor-click
 * navigation for both mouse and keyboard (Enter-on-a-focused-anchor)
 * activation — both dispatch a real "click" event a browser handles
 * identically — while leaving `href` itself completely real and intact,
 * and without touching event propagation at all, so the click still
 * bubbles up to CanvasInteractionBoundary's own window listener for
 * ordinary selection exactly as it would on any other element. Preview/
 * Export are explicitly out of this checkpoint's scope; a real anchor
 * with a real href is what those future features will need to read.
 */
function preventEditorNavigation(event: ReactMouseEvent) {
  event.preventDefault();
}

export function LinkElement({ node, parentId, parentLayoutMode, parentFlowDisplay }: DocumentElementProps) {
  const dropRef = useNodeDropRegistration(node);
  const { setNodeRef: dragRef, listeners, isDragging } = useNodeDragSource(node, parentLayoutMode);
  const editable = useEditableText(node);
  const usesLegacyOverflowClip = !node.display?.overflow && !node.display?.overflowX && !node.display?.overflowY;

  return (
    <a
      href={getLinkHref(node)}
      onClick={preventEditorNavigation}
      ref={mergeRefs<HTMLElement>(dropRef, dragRef, editable.elementRef)}
      {...documentNodeAttributes(node, parentId)}
      {...editable.editableProps}
      className={cn(
        "inline-block w-fit text-blue-600 underline underline-offset-2 dark:text-blue-400",
        editable.isEditing && "outline-none",
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
        ...resolveAspectRatioStyle(node),
        ...resolveFlexOrGridChildStyle(node, parentFlowDisplay),
        // Spread AFTER resolveFlexOrGridChildStyle deliberately (Checkpoint
        // 5.7) — see HeadingElement's identical comment for the full
        // reasoning (an explicit user min-width/min-height must win over
        // that resolver's own Flex/Grid containment default of 0).
        ...resolveSizeConstraintsStyle(node, parentLayoutMode),
        ...resolveTypographyStyle(node),
        ...resolveBackgroundStyle(node),
        ...resolveBorderStyle(node),
        ...resolveBorderRadiusStyle(node),
        ...resolveBoxShadowStyle(node),
        ...resolveFilterStyle(node),
        ...resolveDisplayStyle(node),
      }}
      {...(editable.isEditing ? undefined : listeners)}
    >
      {node.text}
    </a>
  );
}

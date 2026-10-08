"use client";

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
import { resolveTransitionStyle } from "@/features/canvas/utils/resolveTransitionStyle";
import { resolveTransformStyle } from "@/features/canvas/utils/resolveTransformStyle";
import { resolveTypographyStyle } from "@/features/canvas/utils/resolveTypographyStyle";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { cn, mergeRefs } from "@/lib/utils";
import type { DocumentElementProps } from "@/features/canvas/types/documentRenderer";

/**
 * A genuine `<figcaption>` — text-bearing leaf, the exact same shape as
 * LegendElement (Checkpoint 1.15.6.12.2): no child-element content model,
 * `useEditableText` reused unchanged. Only ever meaningful as a direct
 * child of a real `<figure>` — enforced centrally by insertionRules.ts's
 * canParentAcceptChild (see its own CONSTRAINED_CHILD_EXTRA_PARENTS),
 * never by this component or by any drag/drop-local check.
 */
export function FigcaptionElement({ node, parentId, parentLayoutMode, parentFlowDisplay }: DocumentElementProps) {
  const dropRef = useNodeDropRegistration(node);
  const { setNodeRef: dragRef, listeners, isDragging } = useNodeDragSource(node, parentLayoutMode);
  const editable = useEditableText(node);
  const isPreview = useEditorStore((state) => state.editorMode === "preview");
  const usesLegacyOverflowClip = !node.display?.overflow && !node.display?.overflowX && !node.display?.overflowY;

  return (
    <figcaption
      id={node.htmlId}
      ref={mergeRefs<HTMLElement>(dropRef, dragRef, editable.elementRef)}
      {...documentNodeAttributes(node, parentId)}
      {...editable.editableProps}
      className={cn(
        "text-sm text-zinc-500 dark:text-zinc-400",
        editable.isEditing && "outline-none",
        isDragging && "opacity-40",
        node.className,
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
        ...resolveSizeConstraintsStyle(node, parentLayoutMode),
        ...resolveTypographyStyle(node),
        ...resolveBackgroundStyle(node),
        ...resolveBorderStyle(node),
        ...resolveBorderRadiusStyle(node),
        ...resolveBoxShadowStyle(node),
        ...resolveFilterStyle(node),
        ...resolveTransitionStyle(node, isPreview),
        ...resolveTransformStyle(node),
        ...resolveDisplayStyle(node),
      }}
      {...(editable.isEditing ? undefined : listeners)}
    >
      {node.text}
    </figcaption>
  );
}

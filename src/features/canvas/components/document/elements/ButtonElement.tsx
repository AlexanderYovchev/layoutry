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

export function ButtonElement({ node, parentId, parentLayoutMode, parentFlowDisplay }: DocumentElementProps) {
  const dropRef = useNodeDropRegistration(node);
  const { setNodeRef: dragRef, listeners, isDragging } = useNodeDragSource(node, parentLayoutMode);
  const editable = useEditableText(node);
  const isPreview = useEditorStore((state) => state.editorMode === "preview");

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
    <button
      type="button"
      id={node.htmlId}
      ref={mergeRefs<HTMLElement>(dropRef, dragRef, editable.elementRef)}
      {...documentNodeAttributes(node, parentId)}
      {...editable.editableProps}
      className={cn(
        "inline-flex w-fit items-center justify-center bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900",
        usesLegacyRadiusChrome && "rounded-md",
        usesLegacyShadowChrome && "shadow-sm",
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
        ...resolveTransitionStyle(node, isPreview),
        ...resolveTransformStyle(node),
        ...resolveDisplayStyle(node),
      }}
      {...(editable.isEditing ? undefined : listeners)}
    >
      {node.text}
    </button>
  );
}

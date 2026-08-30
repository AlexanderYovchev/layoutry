"use client";

import { useNativeInputEditing } from "@/features/canvas/hooks/useNativeInputEditing";
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
import { getInputType } from "@/features/editor/types/input";
import { cn, mergeRefs } from "@/lib/utils";
import type { DocumentElementProps } from "@/features/canvas/types/documentRenderer";

/**
 * A genuine native `<input type="text">` (Checkpoint 1.10) — never a
 * styled div standing in for one, matching every primitive's semantic-DOM
 * philosophy since Checkpoint 1.1. `defaultValue`, not `value`: node.value
 * is authored/default document state, not continuously-synchronized live
 * runtime state (see EditorElementNode.value's own doc comment) — an
 * uncontrolled `defaultValue` is what lets the browser own real typing
 * during an editing session while the document is only ever written to at
 * useNativeInputEditing's deliberate commit boundary. A `value` prop with
 * no matched `onChange` would instead lock the field, reproducing the
 * exact controlled-native-input footgun this project has already hit once
 * (the Checkpoint 4.3.0.1 color picker) — see useNativeInputEditing's own
 * doc comment for the full interaction model this renderer defers to.
 */
export function InputElement({ node, parentId, parentLayoutMode, parentFlowDisplay }: DocumentElementProps) {
  const dropRef = useNodeDropRegistration(node);
  const { setNodeRef: dragRef, listeners, isDragging } = useNodeDragSource(node, parentLayoutMode);
  const editable = useNativeInputEditing(node);

  const usesLegacyRadiusChrome = !node.borderRadius;
  const usesLegacyBorderChrome = !node.border;

  return (
    <input
      type={getInputType(node)}
      name={node.name}
      placeholder={node.placeholder}
      defaultValue={node.value}
      ref={mergeRefs<HTMLInputElement>(dropRef, dragRef, editable.elementRef)}
      {...documentNodeAttributes(node, parentId)}
      {...editable.editableProps}
      className={cn(
        "h-9 w-full min-w-0 bg-white px-3 text-sm text-zinc-900 outline-none dark:bg-zinc-950 dark:text-zinc-100",
        usesLegacyRadiusChrome && "rounded-md",
        usesLegacyBorderChrome && "border border-zinc-200 dark:border-zinc-800",
        editable.isEditing && "cursor-text",
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
        ...elementPositionStyle(node, parentLayoutMode),
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
    />
  );
}

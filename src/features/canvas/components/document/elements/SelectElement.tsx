"use client";

import { useEffect, useRef } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
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
import { getSelectedOptionValue } from "@/features/editor/types/select";
import { cn, mergeRefs } from "@/lib/utils";
import type { DocumentElementProps } from "@/features/canvas/types/documentRenderer";

/**
 * A real `<select>` normally opens its native dropdown and can change its
 * own selection as part of an ordinary click's default browser behavior
 * (Checkpoint 1.13). Inside the editor, a plain click must behave like
 * every other Canvas element (select the editor node, nothing more) —
 * the exact same hazard Checkbox/Radio's preventCheckedToggle already
 * solved for a different native default action, using the identical
 * technique: preventDefault() on mousedown (blocks the browser from even
 * opening the dropdown or focusing the control — for a `<select>`,
 * focus is a prerequisite for opening it, so blocking focus reliably
 * blocks the dropdown too) and on click (a defensive second layer,
 * matching Checkbox/Radio's own two-guard shape) — never
 * stopPropagation(), so Canvas selection's own click bubbling is
 * completely untouched.
 */
function preventSelectActivation(event: ReactMouseEvent) {
  event.preventDefault();
}

/**
 * A genuine native `<select>` (Checkpoint 1.13), rendering its Option
 * children exactly like ContainerElement renders any container's
 * children — DocumentNodeRenderer already recurses into node.children
 * and hands them down as the `children` prop, so no special child-
 * rendering logic is needed here.
 *
 * Selected-option rendering deliberately uses ONE model only:
 * `defaultValue` on this `<select>` itself, derived from whichever child
 * Option is authored `selected` (see getSelectedOptionValue) — never an
 * `<option selected>` DOM attribute (OptionElement never renders one).
 * This is React's own documented, actually-reconciled pattern for an
 * uncontrolled select with a dynamic option list; mixing it with a
 * per-option `selected` attribute is exactly the inconsistency this
 * checkpoint's brief warned against.
 *
 * External resync: Checkpoint 1.10/1.12 already proved that an
 * uncontrolled native control's `defaultValue`/`defaultChecked` does NOT
 * resync on an already-mounted DOM node when the prop changes on a later
 * render (Undo/Redo, an Inspector Selected toggle). The same small
 * imperative-effect fix is applied here, keyed on the derived selected
 * value rather than isEditing (Select has no editing session at all —
 * selection is Inspector-only, the same "Inspector-only, never
 * Canvas-toggled" shape Checkbox/Radio's checked state already uses).
 */
export function SelectElement({ node, parentId, parentLayoutMode, parentFlowDisplay, children }: DocumentElementProps) {
  const dropRef = useNodeDropRegistration(node);
  const { setNodeRef: dragRef, listeners, isDragging } = useNodeDragSource(node, parentLayoutMode);
  const selectRef = useRef<HTMLSelectElement | null>(null);

  const selectedValue = getSelectedOptionValue(node);

  // Setting `.value = ""` when nothing has that value forces the DOM
  // select into a genuinely blank (selectedIndex: -1) state instead of
  // the native "first option" default — not the same thing, and not
  // what an undefined selectedValue is supposed to mean (see
  // getSelectedOptionValue's own doc comment). selectedIndex = 0 is the
  // correct way to explicitly (re-)apply that native default, e.g. when
  // Undo clears an authored selection that was previously set.
  useEffect(() => {
    if (!selectRef.current) return;
    if (selectedValue !== undefined) {
      selectRef.current.value = selectedValue;
    } else {
      selectRef.current.selectedIndex = 0;
    }
  }, [selectedValue]);

  const usesLegacyRadiusChrome = !node.borderRadius;
  const usesLegacyBorderChrome = !node.border;

  return (
    <select
      name={node.name}
      defaultValue={selectedValue}
      id={node.htmlId}
      ref={mergeRefs<HTMLSelectElement>(dropRef, dragRef, (element) => {
        selectRef.current = element;
      })}
      {...documentNodeAttributes(node, parentId)}
      onMouseDown={preventSelectActivation}
      onClick={preventSelectActivation}
      className={cn(
        "h-9 w-full min-w-0 bg-white px-3 text-sm text-zinc-900 outline-none dark:bg-zinc-950 dark:text-zinc-100",
        usesLegacyRadiusChrome && "rounded-md",
        usesLegacyBorderChrome && "border border-zinc-200 dark:border-zinc-800",
        isDragging && "opacity-40",
        node.className,
      )}
      style={{
        // Same resolver ordering as every other primitive — see
        // ContainerElement/InputElement's identical comments for the
        // full reasoning behind each ordering decision.
        ...resolvePositionStyle(node),
        ...elementPositionStyle(node, parentLayoutMode),
        ...resolveAspectRatioStyle(node),
        ...resolveFlexOrGridChildStyle(node, parentFlowDisplay),
        ...resolveSizeConstraintsStyle(node, parentLayoutMode),
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
      {children}
    </select>
  );
}

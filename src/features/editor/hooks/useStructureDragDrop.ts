"use client";

import { useDndMonitor, type DragStartEvent } from "@dnd-kit/core";
import { useEffect, useRef, useState, type RefObject } from "react";
import { moveBatchRejectedMessage, moveRejectedMessage, moveRejectionReasonText, type MoveRejectionReason } from "@/features/editor/commands/moveCommands";
import {
  describeMovedGroup,
  describeStructureDragSet,
  isStructureDragData,
  resolvePageEndTarget,
  resolveStructureDragSet,
  structureMoveValidator,
  resolveStructureDropTarget,
  shouldAutoExpand,
  STRUCTURE_AUTO_EXPAND_DELAY_MS,
  STRUCTURE_PAGE_END_ATTRIBUTE,
  STRUCTURE_ROW_ID_ATTRIBUTE,
  type StructureDropTarget,
  type StructureMoveValidator,
} from "@/features/editor/components/structure/structureDragDrop";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { DropZone } from "@/features/editor/utils/resolveDropZone";

/**
 * What the Structure panel draws for the current hover target, in px
 * relative to the tree wrapper. "inside": the box of the target row (top,
 * height). "before" / "after": a line at y = top (height 0), starting at
 * the indentation of the level the element will land at.
 */
export interface StructureDropIndicatorState {
  targetId: string;
  zone: DropZone;
  rejection: MoveRejectionReason | null;
  reasonText: string | null;
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface StructureDragState {
  indicator: StructureDropIndicatorState | null;
  /** A Structure drag is in progress (shows the page-end drop area). */
  dragging: boolean;
}

interface StructureDragOptions {
  documentTree: EditorElementNode;
  openNodeIds: ReadonlySet<string>;
  /** The positioned wrapper the indicator is drawn in (contains the tree). */
  wrapperRef: RefObject<HTMLElement | null>;
  rowRefs: RefObject<Map<string, HTMLDivElement>>;
  expand: (ids: readonly string[]) => void;
  /** A successful drop: reveal, focus and announce the moved row. */
  onMoved: (id: string, message?: string) => void;
  announce: (message: string) => void;
}

const CHEVRON_WIDTH_PX = 20;
/** One indentation level in the tree (StructureTreeNode's indent scale). */
const LEVEL_STEP_PX = 16;

function sameIndicator(a: StructureDropIndicatorState | null, b: StructureDropIndicatorState | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.targetId === b.targetId &&
    a.zone === b.zone &&
    a.rejection === b.rejection &&
    a.top === b.top &&
    a.left === b.left &&
    a.width === b.width &&
    a.height === b.height
  );
}

/**
 * BC-12.3.1: Escape during a Structure drag only cancels the drag (dnd-kit's
 * own listener). Marked as handled first (capture phase), so the Canvas's
 * Escape-clears-the-selection shortcut (CanvasInteractionBoundary skips a
 * defaultPrevented Escape) keeps the selection. Module-level, so the same
 * function is added and removed.
 */
function claimEscape(event: KeyboardEvent) {
  if (event.key === "Escape") event.preventDefault();
}

/** BC-12.4: the shared validator for one drag, cached per target + zone (the document doesn't change while dragging). */
function cachedValidator(validate: StructureMoveValidator): StructureMoveValidator {
  const cache = new Map<string, MoveRejectionReason | null>();
  return (targetId, zone) => {
    const key = `${targetId}\u0000${zone}`;
    const known = cache.get(key);
    if (known !== undefined) return known;
    const verdict = validate(targetId, zone);
    cache.set(key, verdict);
    return verdict;
  };
}

function pointerOf(event: Event | null): { x: number; y: number } | null {
  if (event && "clientX" in event && "clientY" in event && typeof event.clientX === "number" && typeof event.clientY === "number") {
    return { x: event.clientX, y: event.clientY };
  }
  return null;
}

/**
 * BC-12.3 — the Structure panel's side of a pointer drag started from a
 * row handle (StructureDragHandle). Listens to the shared DndContext with
 * useDndMonitor, so the Canvas and catalog drags are untouched.
 *
 * - Hover: the row under the real pointer (live DOM hit-test), the zone and
 *   the shared validateMove verdict. Only a CHANGED target sets state, and
 *   rows are memoized, so pointer movement re-renders the indicator, not
 *   the tree. Nothing is written to the document while hovering.
 * - Auto-expand (D3): a valid "inside" on a closed container opens it after
 *   STRUCTURE_AUTO_EXPAND_DELAY_MS; leaving it cancels the timer.
 * - Drop: one store.moveElement (planMove: the same rules, one history
 *   entry, the moved element selected). An invalid drop changes nothing and
 *   shows the shared notice (which is itself announced, so the Structure
 *   live region does not repeat it). No target / Escape: cancelled.
 */
export function useStructureDragDrop({ documentTree, openNodeIds, wrapperRef, rowRefs, expand, onMoved, announce }: StructureDragOptions): StructureDragState {
  const [indicator, setIndicator] = useState<StructureDropIndicatorState | null>(null);
  const [dragging, setDragging] = useState(false);
  /**
   * The drag session, fixed at pick-up (BC-12.4): the dragged row, what it
   * moves (one element, or the minimal selected roots in document order),
   * its label and one cached validator.
   */
  const drag = useRef<{ nodeId: string; label: string; moved: string[]; validate: StructureMoveValidator } | null>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const target = useRef<StructureDropTarget | null>(null);
  const indicatorRef = useRef<StructureDropIndicatorState | null>(null);
  const expandTimer = useRef<{ id: string; timer: number } | null>(null);
  const latest = useRef({ documentTree, openNodeIds, expand, onMoved, announce });
  useEffect(() => {
    latest.current = { documentTree, openNodeIds, expand, onMoved, announce };
  });

  function clearExpandTimer() {
    if (expandTimer.current) window.clearTimeout(expandTimer.current.timer);
    expandTimer.current = null;
  }

  function show(next: StructureDropIndicatorState | null) {
    if (sameIndicator(indicatorRef.current, next)) return;
    indicatorRef.current = next;
    setIndicator(next);
  }

  /** The row (or the page-end drop area) under the pointer, inside this tree. */
  function hitTest(): { kind: "row" | "page-end"; element: HTMLElement } | null {
    const wrapper = wrapperRef.current;
    if (!pointer.current || !wrapper || typeof document.elementsFromPoint !== "function") return null;
    for (const element of document.elementsFromPoint(pointer.current.x, pointer.current.y)) {
      const row = element.closest<HTMLElement>(`[${STRUCTURE_ROW_ID_ATTRIBUTE}]`);
      if (row && wrapper.contains(row)) return { kind: "row", element: row };
      const pageEnd = element.closest<HTMLElement>(`[${STRUCTURE_PAGE_END_ATTRIBUTE}]`);
      if (pageEnd && wrapper.contains(pageEnd)) return { kind: "page-end", element: pageEnd };
    }
    return null;
  }

  /** Where a row's indentation starts (its left edge + padding), relative to the wrapper. */
  function indentStartOf(id: string): number | null {
    const row = rowRefs.current?.get(id);
    const wrapper = wrapperRef.current;
    if (!row || !wrapper) return null;
    return row.getBoundingClientRect().left - wrapper.getBoundingClientRect().left + (Number.parseFloat(getComputedStyle(row).paddingLeft) || 0);
  }

  function compute() {
    const active = drag.current;
    const wrapper = wrapperRef.current;
    if (!active || !wrapper || !pointer.current) return;
    const hit = hitTest();
    const { documentTree: doc, openNodeIds: open } = latest.current;
    const wrapperRect = wrapper.getBoundingClientRect();
    const hitRect = hit?.element.getBoundingClientRect();
    const rowId = hit?.kind === "row" ? hit.element.getAttribute(STRUCTURE_ROW_ID_ATTRIBUTE) : null;
    const next =
      hit?.kind === "page-end"
        ? resolvePageEndTarget(doc, active.moved, active.validate)
        : rowId && hitRect
          ? resolveStructureDropTarget(
              doc,
              active.moved,
              rowId,
              hitRect,
              pointer.current.y,
              { openNodeIds: open, pointerX: pointer.current.x - wrapperRect.left, indentStartOf },
              active.validate,
            )
          : null;
    target.current = next;

    if (shouldAutoExpand(doc, next, open) && next) {
      if (expandTimer.current?.id !== next.targetId) {
        clearExpandTimer();
        const id = next.targetId;
        expandTimer.current = {
          id,
          timer: window.setTimeout(() => {
            expandTimer.current = null;
            if (!drag.current) return;
            latest.current.expand([id]);
            // Re-hit-test once the newly revealed rows have laid out (the
            // branch opens with a short transition, none under reduced motion).
            window.setTimeout(compute, 250);
          }, STRUCTURE_AUTO_EXPAND_DELAY_MS),
        };
      }
    } else {
      clearExpandTimer();
    }

    if (!next || !hit || !hitRect) {
      show(null);
      return;
    }
    const hitTop = hitRect.top - wrapperRect.top;
    const right = hitRect.right - wrapperRect.left;
    const common = { targetId: next.targetId, zone: next.zone, rejection: next.rejection, reasonText: next.rejection ? moveRejectionReasonText(next.rejection) : null };
    if (next.zone === "inside" && hit.kind === "row") {
      const left = hitRect.left - wrapperRect.left;
      show({ ...common, top: Math.round(hitTop), left: Math.round(left), width: Math.round(right - left), height: Math.round(hitRect.height) });
      return;
    }
    // A line: at the top of the hovered row for "before", at its bottom for
    // every "after" meaning (incl. "before the first child" of an open
    // container), at the top of the page-end area. It starts at the label
    // indentation of the level the element lands at.
    const upperHalf = hit.kind === "row" && pointer.current.y < hitRect.top + hitRect.height / 2;
    const lineY = hit.kind === "page-end" || upperHalf ? hitTop : hitTop + hitRect.height;
    const levelIndent = next.levelId === doc.id ? (indentStartOf(doc.id) ?? 0) + LEVEL_STEP_PX : (indentStartOf(next.levelId) ?? hitRect.left - wrapperRect.left);
    const left = levelIndent + CHEVRON_WIDTH_PX;
    show({ ...common, top: Math.round(lineY), left: Math.round(left), width: Math.round(Math.max(0, right - left)), height: 0 });
  }

  // The listener added at drag start is kept, so the same function is removed at the end.
  const pointerListener = useRef<((event: PointerEvent) => void) | null>(null);
  function stopTrackingPointer() {
    if (pointerListener.current) window.removeEventListener("pointermove", pointerListener.current, true);
    pointerListener.current = null;
    window.removeEventListener("keydown", claimEscape, true);
  }


  function finish() {
    setDragging(false);
    drag.current = null;
    target.current = null;
    clearExpandTimer();
    stopTrackingPointer();
    show(null);
  }

  function focusRow(id: string) {
    rowRefs.current?.get(id)?.focus();
  }

  useDndMonitor({
    onDragStart(event: DragStartEvent) {
      const data = event.active.data.current;
      if (!isStructureDragData(data)) return;
      const store = useEditorStore.getState();
      // BC-12.4: with several selected elements including this row, the whole
      // selection (as minimal roots) moves; otherwise just this row.
      const moved = resolveStructureDragSet(store.document, store.selection.ids, data.nodeId);
      const { label, count } = describeStructureDragSet(store.document, moved, data.nodeId, data.label);
      drag.current = { nodeId: data.nodeId, label, moved, validate: cachedValidator(structureMoveValidator(store.document, moved)) };
      setDragging(true);
      pointer.current = pointerOf(event.activatorEvent);
      stopTrackingPointer();
      pointerListener.current = (pointerEvent: PointerEvent) => {
        pointer.current = { x: pointerEvent.clientX, y: pointerEvent.clientY };
        compute();
      };
      window.addEventListener("pointermove", pointerListener.current, true);
      window.addEventListener("keydown", claimEscape, true);
      // Dragging an unselected row selects it (plain selection, no document
      // change); a row of a multi-selection keeps the whole selection, also
      // after the drop (BC-12.3.1: moveElement keepSelection).
      if (!store.selection.ids.includes(data.nodeId)) store.selectOnly(data.nodeId);
      const what = count > 1 ? `${label} and ${count - 1} other ${count === 2 ? "element" : "elements"} (${count} in all)` : label;
      latest.current.announce(`Dragging ${what}. Move over another row to place ${count > 1 ? "them" : "it"} before, after or inside it, or press Escape to cancel.`);
      compute();
    },
    // Fires on pointer moves and on auto-scroll (the rows move under a still pointer).
    onDragMove() {
      compute();
    },
    onDragEnd() {
      const active = drag.current;
      if (!active) return;
      compute();
      const dropTarget = target.current;
      finish();
      const group = active.moved.length > 1;
      const subject = group ? `The ${active.moved.length} elements` : active.label;
      if (!dropTarget) {
        latest.current.announce(`Move cancelled. ${subject} ${group ? "were" : "was"} not moved.`);
        focusRow(active.nodeId);
        return;
      }
      if (dropTarget.rejection) {
        useEditorStore
          .getState()
          .showEditorNotice(group ? moveBatchRejectedMessage(active.moved.length, dropTarget.rejection) : moveRejectedMessage(active.label, dropTarget.rejection));
        focusRow(active.nodeId);
        return;
      }
      const store = useEditorStore.getState();
      const single = !group && active.moved[0] === active.nodeId;
      const outcome = single
        ? store.moveElement(active.nodeId, dropTarget.targetId, dropTarget.zone, { keepSelection: true })
        : store.moveElements(active.moved, dropTarget.targetId, dropTarget.zone, active.nodeId);
      if (outcome.status === "moved") {
        latest.current.onMoved(active.nodeId, group ? describeMovedGroup(useEditorStore.getState().document, active.moved) : undefined);
        return;
      }
      if (outcome.status === "unchanged") latest.current.announce(`${subject} ${group ? "were" : "was"} not moved: ${group ? "they are" : "it is"} already there.`);
      focusRow(active.nodeId);
    },
    onDragCancel() {
      const active = drag.current;
      if (!active) return;
      finish();
      const group = active.moved.length > 1;
      latest.current.announce(`Move cancelled. ${group ? `The ${active.moved.length} elements were` : `${active.label} was`} not moved.`);
      focusRow(active.nodeId);
    },
  });

  useEffect(
    () => () => {
      clearExpandTimer();
      stopTrackingPointer();
    },
    [],
  );

  return { indicator, dragging };
}

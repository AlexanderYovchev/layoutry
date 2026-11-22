"use client";

import { useDndMonitor, type DragStartEvent } from "@dnd-kit/core";
import { useEffect, useRef, useState, type RefObject } from "react";
import { moveRejectedMessage, moveRejectionReasonText, type MoveRejectionReason } from "@/features/editor/commands/moveCommands";
import {
  isStructureDragData,
  resolveStructureDropTarget,
  shouldAutoExpand,
  STRUCTURE_AUTO_EXPAND_DELAY_MS,
  STRUCTURE_ROW_ID_ATTRIBUTE,
  type StructureDropTarget,
} from "@/features/editor/components/structure/structureDragDrop";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { DropZone } from "@/features/editor/utils/resolveDropZone";

/** What the Structure panel draws for the current hover target, in px relative to the tree wrapper. */
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

interface StructureDragOptions {
  documentTree: EditorElementNode;
  openNodeIds: ReadonlySet<string>;
  /** The positioned wrapper the indicator is drawn in (contains the tree). */
  wrapperRef: RefObject<HTMLElement | null>;
  rowRefs: RefObject<Map<string, HTMLDivElement>>;
  expand: (ids: readonly string[]) => void;
  /** A successful drop: reveal, focus and announce the moved row. */
  onMoved: (id: string) => void;
  announce: (message: string) => void;
}

const CHEVRON_WIDTH_PX = 20;

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
export function useStructureDragDrop({ documentTree, openNodeIds, wrapperRef, rowRefs, expand, onMoved, announce }: StructureDragOptions): StructureDropIndicatorState | null {
  const [indicator, setIndicator] = useState<StructureDropIndicatorState | null>(null);
  const drag = useRef<{ nodeId: string; label: string } | null>(null);
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

  function rowUnderPointer(): HTMLElement | null {
    const wrapper = wrapperRef.current;
    if (!pointer.current || !wrapper || typeof document.elementsFromPoint !== "function") return null;
    for (const element of document.elementsFromPoint(pointer.current.x, pointer.current.y)) {
      const row = element.closest<HTMLElement>(`[${STRUCTURE_ROW_ID_ATTRIBUTE}]`);
      if (row && wrapper.contains(row)) return row;
    }
    return null;
  }

  function compute() {
    const active = drag.current;
    const wrapper = wrapperRef.current;
    if (!active || !wrapper || !pointer.current) return;
    const row = rowUnderPointer();
    const rowId = row?.getAttribute(STRUCTURE_ROW_ID_ATTRIBUTE);
    const { documentTree: doc, openNodeIds: open } = latest.current;
    const rowRect = row?.getBoundingClientRect();
    const next = row && rowId && rowRect ? resolveStructureDropTarget(doc, active.nodeId, rowId, rowRect, pointer.current.y) : null;
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

    if (!next || !row || !rowRect) {
      show(null);
      return;
    }
    const wrapperRect = wrapper.getBoundingClientRect();
    const indent = Number.parseFloat(getComputedStyle(row).paddingLeft) || 0;
    const rowLeft = rowRect.left - wrapperRect.left;
    const lineLeft = next.zone === "inside" ? rowLeft : rowLeft + indent + CHEVRON_WIDTH_PX;
    show({
      targetId: next.targetId,
      zone: next.zone,
      rejection: next.rejection,
      reasonText: next.rejection ? moveRejectionReasonText(next.rejection) : null,
      top: Math.round(rowRect.top - wrapperRect.top),
      left: Math.round(lineLeft),
      width: Math.round(rowRect.right - wrapperRect.left - lineLeft),
      height: Math.round(rowRect.height),
    });
  }

  // The listener added at drag start is kept, so the same function is removed at the end.
  const pointerListener = useRef<((event: PointerEvent) => void) | null>(null);
  function stopTrackingPointer() {
    if (pointerListener.current) window.removeEventListener("pointermove", pointerListener.current, true);
    pointerListener.current = null;
  }

  function finish() {
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
      drag.current = { nodeId: data.nodeId, label: data.label };
      pointer.current = pointerOf(event.activatorEvent);
      stopTrackingPointer();
      pointerListener.current = (pointerEvent: PointerEvent) => {
        pointer.current = { x: pointerEvent.clientX, y: pointerEvent.clientY };
        compute();
      };
      window.addEventListener("pointermove", pointerListener.current, true);
      // Dragging an unselected row selects it (no document change); a row of
      // a multi-selection keeps the selection until the drop.
      const store = useEditorStore.getState();
      if (!store.selection.ids.includes(data.nodeId)) store.selectOnly(data.nodeId);
      latest.current.announce(`Dragging ${data.label}. Move over another row to place it before, after or inside it, or press Escape to cancel.`);
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
      if (!dropTarget) {
        latest.current.announce(`Move cancelled. ${active.label} was not moved.`);
        focusRow(active.nodeId);
        return;
      }
      if (dropTarget.rejection) {
        useEditorStore.getState().showEditorNotice(moveRejectedMessage(active.label, dropTarget.rejection));
        focusRow(active.nodeId);
        return;
      }
      const outcome = useEditorStore.getState().moveElement(active.nodeId, dropTarget.targetId, dropTarget.zone);
      if (outcome.status === "moved") {
        latest.current.onMoved(active.nodeId);
        return;
      }
      if (outcome.status === "unchanged") latest.current.announce(`${active.label} was not moved: it is already there.`);
      focusRow(active.nodeId);
    },
    onDragCancel() {
      const active = drag.current;
      if (!active) return;
      finish();
      latest.current.announce(`Move cancelled. ${active.label} was not moved.`);
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

  return indicator;
}

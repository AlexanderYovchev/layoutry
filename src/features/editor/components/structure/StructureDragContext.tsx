"use client";

import { DndContext, useSensor, useSensors, type Announcements, type CollisionDetection } from "@dnd-kit/core";
import type { ReactNode } from "react";
import { STRUCTURE_TREE_ATTRIBUTE } from "@/features/editor/components/structure/structureDragDrop";
import { EditorPointerSensor } from "@/features/editor/utils/editorDragSensors";

/** Same activation as the editor's own context (EditorApp): 4px for mouse/pen, a short press for touch on a handle. */
const POINTER_SENSOR_OPTIONS = { activationConstraint: { distance: 4 } };

/** Rows are hit-tested by the Structure panel itself (useStructureDragDrop): no dnd-kit droppables, no collisions. */
const noCollisions: CollisionDetection = () => [];

/** The Structure panel announces drags in its own live region; dnd-kit's defaults (raw ids) stay silent. */
const SILENT_ANNOUNCEMENTS: Announcements = {
  onDragStart: () => undefined,
  onDragOver: () => undefined,
  onDragEnd: () => undefined,
  onDragCancel: () => undefined,
};
const ACCESSIBILITY = { announcements: SILENT_ANNOUNCEMENTS, screenReaderInstructions: { draggable: "" } };

/** Edge auto-scroll (D4): only the scroll region that holds the Structure tree, same threshold and acceleration as EditorApp. */
const AUTO_SCROLL = {
  threshold: { x: 0, y: 0.2 },
  acceleration: 10,
  canScroll: (element: Element) => element instanceof HTMLElement && element.querySelector(`[${STRUCTURE_TREE_ATTRIBUTE}]`) !== null && element.dataset.noDragAutoscroll !== undefined,
};

/**
 * BC-12.5 — the Structure panel's own dnd-kit context, nested inside the
 * editor's. Starting or ending ANY drag changes a DndContext's internal
 * state, which re-renders every draggable and droppable registered with it.
 * With the Structure drag in the editor's context, that was every Canvas
 * element and every row handle (~1 s at 1,000 elements, profiled). Here the
 * Structure drag only touches this context, which holds one draggable (the
 * tree's shared drag source, see StructureTree), so Canvas drags and
 * Structure drags no longer re-render each other.
 */
export function StructureDragContext({ children }: { children: ReactNode }) {
  const sensors = useSensors(useSensor(EditorPointerSensor, POINTER_SENSOR_OPTIONS));
  return (
    <DndContext sensors={sensors} collisionDetection={noCollisions} autoScroll={AUTO_SCROLL} accessibility={ACCESSIBILITY}>
      {children}
    </DndContext>
  );
}

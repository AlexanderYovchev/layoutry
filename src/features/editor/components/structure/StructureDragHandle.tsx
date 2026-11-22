"use client";

import { useDraggable } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { memo } from "react";
import { cn } from "@/lib/utils";
import { STRUCTURE_DRAG_KIND, type StructureDragData } from "@/features/editor/components/structure/structureDragDrop";

interface StructureDragHandleProps {
  nodeId: string;
  tag: string;
  label: string;
}

/**
 * BC-12.3 (D1): the only place a Structure drag starts. Clicking the row
 * still selects; Ctrl/Cmd/Shift+click and the chevron are untouched.
 *
 * - Its own small component, so dnd-kit's context updates re-render the
 *   handle, not the row.
 * - Not a tab stop (tabIndex -1): rows are the tree's roving tab stops and
 *   Alt+Arrow (BC-12.2) is the keyboard way to move. dnd-kit's keyboard
 *   attributes are not used, so there is no second keyboard-drag model.
 * - touch-action:none on the handle only: touch scrolling elsewhere in the
 *   tree keeps working; the touch press delay is in the sensor
 *   (editorDragSensors).
 * - data-dragging lets the row dim itself while it is the drag source.
 */
export const StructureDragHandle = memo(function StructureDragHandle({ nodeId, tag, label }: StructureDragHandleProps) {
  const data: StructureDragData = { kind: STRUCTURE_DRAG_KIND, nodeId, label, tag, count: 1 };
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: `structure:${nodeId}`, data });

  return (
    <button
      ref={setNodeRef}
      type="button"
      tabIndex={-1}
      aria-label={`Drag ${label}`}
      title="Drag to move (or Alt+Arrow keys)"
      data-structure-drag-handle=""
      data-dragging={isDragging ? "true" : undefined}
      {...listeners}
      className={cn(
        "text-fg-muted hover:bg-surface-selected hover:text-fg-primary flex size-5 shrink-0 cursor-grab touch-none items-center justify-center rounded-control-sm select-none [-webkit-touch-callout:none] active:cursor-grabbing",
        // Shown on row hover/focus and on the selected row; always on touch screens (no hover).
        "opacity-0 group-hover/row:opacity-100 group-focus-visible/row:opacity-100 group-aria-selected/row:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100",
        isDragging && "opacity-100",
      )}
    >
      <GripVertical aria-hidden="true" className="size-3.5" />
    </button>
  );
});

"use client";

import { GripVertical } from "lucide-react";
import { memo, type PointerEvent } from "react";
import { cn } from "@/lib/utils";

interface StructureDragHandleProps {
  nodeId: string;
  label: string;
  /** The tree's shared drag source (StructureTree): records the row, then starts dnd-kit's sensor. */
  onPointerDown: (nodeId: string, event: PointerEvent<HTMLButtonElement>) => void;
}

/**
 * BC-12.3 (D1): the only place a Structure drag starts. Clicking the row
 * still selects; Ctrl/Cmd/Shift+click and the chevron are untouched.
 *
 * - BC-12.5: a plain button, not a dnd-kit draggable. One shared drag
 *   source in StructureTree serves every handle, so starting or ending a
 *   drag no longer re-renders one dnd-kit consumer per row.
 * - Not a tab stop (tabIndex -1): rows are the tree's roving tab stops and
 *   Alt+Arrow (BC-12.2) is the keyboard way to move. dnd-kit's keyboard
 *   attributes are not used, so there is no second keyboard-drag model.
 * - touch-action:none on the handle only: touch scrolling elsewhere in the
 *   tree keeps working; the touch press delay is in the sensor
 *   (editorDragSensors).
 */
export const StructureDragHandle = memo(function StructureDragHandle({ nodeId, label, onPointerDown }: StructureDragHandleProps) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={`Drag ${label}`}
      title="Drag to move (or Alt+Arrow keys)"
      data-structure-drag-handle=""
      onPointerDown={(event) => onPointerDown(nodeId, event)}
      className={cn(
        "text-fg-muted hover:bg-surface-selected hover:text-fg-primary flex size-5 shrink-0 cursor-grab touch-none items-center justify-center rounded-control-sm select-none [-webkit-touch-callout:none] active:cursor-grabbing",
        // Shown on row hover/focus and on the selected row; always on touch screens (no hover), and on dragged rows.
        "opacity-0 group-hover/row:opacity-100 group-focus-visible/row:opacity-100 group-aria-selected/row:opacity-100 group-data-[drag-source=true]/row:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100",
      )}
    >
      <GripVertical aria-hidden="true" className="size-3.5" />
    </button>
  );
});

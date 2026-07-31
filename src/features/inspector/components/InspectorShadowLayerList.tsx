"use client";

import { ChevronDown, ChevronUp, Copy, GripVertical, Trash2 } from "lucide-react";
import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { InspectorBooleanToggle } from "@/features/inspector/components/InspectorBooleanToggle";
import { formatShadowLayerCss, type ShadowLayer } from "@/features/editor/types/boxShadow";
import { cn } from "@/lib/utils";

interface InspectorShadowLayerListProps {
  layers: ShadowLayer[];
  selectedLayerId: string | null;
  onSelect: (id: string) => void;
  onToggleEnabled: (id: string, enabled: boolean) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  /** One discrete move (Move Up/Down button) — one call is one commit, no transaction involved. Same "discrete vs continuous" split as InspectorGradientStopTrack's onAdjustPosition vs onDragMove. */
  onMove: (id: string, toIndex: number) => void;
  /** Fires once, at the start of a pointer drag gesture — the caller opens its transaction here. */
  onDragStart: () => void;
  /** Fires on every pointer move during a drag with the layer's new target index — the caller writes this live (no history). */
  onDragMove: (id: string, toIndex: number) => void;
  /** Fires once when the drag gesture ends — `moved` is false for a plain click (nothing to commit) and true after any real reorder. */
  onDragEnd: (moved: boolean) => void;
}

function layerName(layer: ShadowLayer, index: number): string {
  return `Shadow ${index + 1}${layer.inset ? " (inset)" : ""}`;
}

/**
 * The reorderable shadow layer list (Checkpoint 4.6's #5) — each row
 * exposes a visibility toggle, selection, duplicate, delete, and
 * reordering via both a pointer-drag handle (mirroring
 * InspectorGradientStopTrack's begin/move/end transaction shape, adapted
 * from a horizontal 0-100 position to a vertical row index) and explicit
 * Move Up/Down buttons — the brief's own "(or explicit move up/down if
 * that better matches current architecture)" fallback, kept alongside
 * the drag handle rather than instead of it, since a button is
 * unconditionally keyboard-operable in a way a pointer drag alone never
 * is (Checkpoint 4.6's #14 accessibility pass).
 *
 * Rendered for any non-empty layer list, including a single layer — the
 * Move Up/Down buttons and drag handle are simply inert (disabled/no-op)
 * when there's nothing to reorder, rather than switching to a second,
 * parallel single-layer-only layout.
 */
export function InspectorShadowLayerList({
  layers,
  selectedLayerId,
  onSelect,
  onToggleEnabled,
  onDuplicate,
  onDelete,
  onMove,
  onDragStart,
  onDragMove,
  onDragEnd,
}: InspectorShadowLayerListProps) {
  const rowRefs = useRef<Array<HTMLDivElement | null>>([]);
  const draggingRef = useRef<{ id: string; moved: boolean } | null>(null);

  function indexFromClientY(clientY: number): number {
    for (let i = 0; i < rowRefs.current.length; i++) {
      const rect = rowRefs.current[i]?.getBoundingClientRect();
      if (rect && clientY < rect.top + rect.height / 2) return i;
    }
    return layers.length - 1;
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>, id: string) {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    draggingRef.current = { id, moved: false };
    onDragStart();
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLButtonElement>, id: string) {
    const dragging = draggingRef.current;
    if (!dragging || dragging.id !== id) return;
    const targetIndex = indexFromClientY(event.clientY);
    if (targetIndex !== layers.findIndex((layer) => layer.id === id)) dragging.moved = true;
    onDragMove(id, targetIndex);
  }

  function handlePointerUp() {
    const dragging = draggingRef.current;
    draggingRef.current = null;
    onDragEnd(dragging?.moved ?? false);
  }

  return (
    <div role="list" aria-label="Shadow layers" className="flex flex-col gap-1">
      {layers.map((layer, index) => {
        const isSelected = layer.id === selectedLayerId;
        const name = layerName(layer, index);
        return (
          <div
            key={layer.id}
            ref={(el) => {
              rowRefs.current[index] = el;
            }}
            role="listitem"
            className={cn(
              "flex items-center gap-0.5 rounded-md border px-1 py-1",
              isSelected
                ? "border-blue-300 bg-blue-50/60 dark:border-blue-800 dark:bg-blue-950/30"
                : "border-transparent",
            )}
          >
            <div className="flex flex-col">
              <button
                type="button"
                aria-label={`Move ${name} up`}
                disabled={index === 0}
                onClick={() => onMove(layer.id, index - 1)}
                className="flex h-3 w-4 items-center justify-center text-zinc-400 hover:text-zinc-600 disabled:pointer-events-none disabled:opacity-30 dark:text-zinc-500 dark:hover:text-zinc-300"
              >
                <ChevronUp aria-hidden="true" className="size-3" />
              </button>
              <button
                type="button"
                aria-label={`Move ${name} down`}
                disabled={index === layers.length - 1}
                onClick={() => onMove(layer.id, index + 1)}
                className="flex h-3 w-4 items-center justify-center text-zinc-400 hover:text-zinc-600 disabled:pointer-events-none disabled:opacity-30 dark:text-zinc-500 dark:hover:text-zinc-300"
              >
                <ChevronDown aria-hidden="true" className="size-3" />
              </button>
            </div>

            <button
              type="button"
              disabled={layers.length <= 1}
              aria-label={`Drag to reorder ${name}`}
              title={`Drag to reorder ${name}`}
              onPointerDown={(event) => handlePointerDown(event, layer.id)}
              onPointerMove={(event) => handlePointerMove(event, layer.id)}
              onPointerUp={handlePointerUp}
              className="flex h-6 w-4 shrink-0 touch-none items-center justify-center text-zinc-400 disabled:pointer-events-none disabled:opacity-30 enabled:cursor-grab enabled:active:cursor-grabbing dark:text-zinc-500"
            >
              <GripVertical aria-hidden="true" className="size-3.5" />
            </button>

            <InspectorBooleanToggle
              checked={layer.enabled}
              onChange={(checked) => onToggleEnabled(layer.id, checked)}
              label={`${name} enabled`}
            />

            <button
              type="button"
              onClick={() => onSelect(layer.id)}
              aria-pressed={isSelected}
              aria-label={`Select ${name}`}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-0.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500"
            >
              <span
                aria-hidden="true"
                className="flex size-5 shrink-0 items-center justify-center overflow-visible rounded-sm bg-white dark:bg-zinc-800"
              >
                <span
                  aria-hidden="true"
                  className="size-3 rounded-sm bg-zinc-300 dark:bg-zinc-600"
                  style={{ boxShadow: formatShadowLayerCss(layer) }}
                />
              </span>
              <span
                className={cn(
                  "truncate text-xs",
                  isSelected ? "font-medium text-zinc-700 dark:text-zinc-300" : "text-zinc-500 dark:text-zinc-400",
                )}
              >
                {name}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onDuplicate(layer.id)}
              aria-label={`Duplicate ${name}`}
              title={`Duplicate ${name}`}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-zinc-400 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            >
              <Copy aria-hidden="true" className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(layer.id)}
              aria-label={`Delete ${name}`}
              title={`Delete ${name}`}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-zinc-400 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            >
              <Trash2 aria-hidden="true" className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

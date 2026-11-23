"use client";

import { Info, Magnet } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/Tooltip";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";

/**
 * BC-13.3 (D36) — the compact Canvas control strip: the one Snap On/Off
 * control (the Inspector toggle is gone) and an informational popover.
 * Editor chrome only: rendered over the Workspace (AppShell's
 * workspaceControls slot), outside the document surface, hidden in Preview.
 * The setting is the global preference (setSnapEnabled persists it).
 * No animation; keyboard: Tab to either button, Enter/Space, Escape closes
 * the popover and returns focus to its button.
 */
export function CanvasControlStrip() {
  const snapEnabled = useEditorStore((state) => state.snapEnabled);
  const setSnapEnabled = useEditorStore((state) => state.setSnapEnabled);
  const isPreview = useEditorStore((state) => state.editorMode === "preview");
  const [open, setOpen] = useState(false);
  const popoverId = useId();
  const infoButtonRef = useRef<HTMLButtonElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      infoButtonRef.current?.focus();
    }
    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Node && stripRef.current?.contains(event.target)) return;
      setOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [open]);

  if (isPreview) return null;

  return (
    <div
      ref={stripRef}
      role="toolbar"
      aria-label="Canvas controls"
      data-canvas-control-strip=""
      className="border-line bg-surface-panel shadow-panel relative flex items-center gap-0.5 rounded-control border p-0.5"
    >
      <Tooltip label={snapEnabled ? "Snapping is on" : "Snapping is off"} align="end">
        <button
          type="button"
          aria-pressed={snapEnabled}
          aria-label="Snap"
          data-canvas-snap-toggle=""
          onClick={() => setSnapEnabled(!snapEnabled)}
          className={cn(
            "rounded-control-sm flex h-7 items-center gap-1.5 px-2 text-xs font-medium focus-visible:outline-2 focus-visible:outline-accent",
            snapEnabled ? "bg-accent/15 text-accent" : "text-fg-secondary hover:bg-surface-hover hover:text-fg-primary",
          )}
        >
          <Magnet aria-hidden="true" className="size-3.5" />
          <span>Snap</span>
          <span className={cn("text-[10px] font-semibold uppercase", snapEnabled ? "text-accent" : "text-fg-muted")}>{snapEnabled ? "On" : "Off"}</span>
        </button>
      </Tooltip>
      <button
        ref={infoButtonRef}
        type="button"
        aria-label="About snapping"
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={() => setOpen((current) => !current)}
        className="text-fg-muted hover:bg-surface-hover hover:text-fg-primary rounded-control-sm flex size-7 items-center justify-center focus-visible:outline-2 focus-visible:outline-accent"
      >
        <Info aria-hidden="true" className="size-3.5" />
      </button>
      {open && (
        <div
          id={popoverId}
          role="dialog"
          aria-label="About snapping"
          data-canvas-snap-info=""
          className="border-line bg-surface-panel text-fg-primary shadow-elevated rounded-card absolute top-full right-0 z-20 mt-1.5 w-64 border p-3 text-xs leading-relaxed"
        >
          <p className="mb-1.5 font-semibold">Snapping</p>
          <ul className="text-fg-secondary list-disc space-y-1 pl-4">
            <li>While you drag an element in a Free container, it snaps to nearby edges, centres and equal spacing within 6 screen pixels.</li>
            <li>Hold Alt (Option on a Mac) while dragging to place it freely, without snapping.</li>
            <li>Alignment guides and distances still show when snapping is off.</li>
            <li>Hold Shift while dragging to move along one axis only.</li>
          </ul>
        </div>
      )}
    </div>
  );
}

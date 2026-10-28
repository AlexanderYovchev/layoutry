import { CodeXml, Eye, Redo2, SquarePen, Undo2, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/Tooltip";

/**
 * Plain callback/string only — no feature types (see EditMenuCommands's
 * own identical doc comment in applicationMenus.ts) — components/layout
 * must never import src/features/*. `mode` mirrors the editor's own
 * EditorMode union as a local string literal rather than importing that
 * type directly.
 */
export interface PreviewControl {
  mode: "design" | "preview";
  onToggle: () => void;
}

/**
 * Checkpoint 1.15.6.10.2 — the same plain-callback shape PreviewControl
 * above already established, now for Undo/Redo. This toolbar consumes
 * the SAME canUndo/canRedo/onUndo/onRedo values EditorApp.tsx already
 * computes for the Edit menu (`EditMenuCommands`, applicationMenus.ts) —
 * AppHeader passes the matching slice of that same object down to both
 * MenuBarTrigger (via buildApplicationMenus) and here, so there is only
 * ever ONE history source of truth; GlobalActions itself holds no local
 * canUndo/canRedo state of its own to go stale.
 */
export interface HistoryControl {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

interface GlobalActionsProps {
  historyControl: HistoryControl;
  previewControl: PreviewControl;
  /**
   * EXPORT-1.4 — the same File › Export Code… callback (FileMenuCommands),
   * so the header button and the menu item open one dialog. No button
   * when absent.
   */
  onExportCode?: () => void;
}

export function GlobalActions({ historyControl, previewControl, onExportCode }: GlobalActionsProps) {
  const isPreview = previewControl.mode === "preview";

  return (
    <div className="flex shrink-0 items-center gap-1">
      {/* Undo/Redo: a quiet icon group, visually separated from the primary Preview action. */}
      <Tooltip label="Undo">
        <button
          type="button"
          disabled={!historyControl.canUndo}
          onClick={historyControl.onUndo}
          aria-label="Undo"
          className="flex size-9 items-center justify-center rounded-control text-fg-secondary transition-colors duration-150 ease-studio hover:bg-surface-hover hover:text-fg-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:bg-surface-selected disabled:cursor-not-allowed disabled:text-fg-muted disabled:opacity-60 disabled:hover:bg-transparent"
        >
          <Undo2 aria-hidden="true" className="size-4" />
        </button>
      </Tooltip>

      <Tooltip label="Redo">
        <button
          type="button"
          disabled={!historyControl.canRedo}
          onClick={historyControl.onRedo}
          aria-label="Redo"
          className="flex size-9 items-center justify-center rounded-control text-fg-secondary transition-colors duration-150 ease-studio hover:bg-surface-hover hover:text-fg-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:bg-surface-selected disabled:cursor-not-allowed disabled:text-fg-muted disabled:opacity-60 disabled:hover:bg-transparent"
        >
          <Redo2 aria-hidden="true" className="size-4" />
        </button>
      </Tooltip>

      <span aria-hidden="true" className="mx-1.5 h-5 w-px bg-line" />

      {onExportCode && (
        <Tooltip label="Export HTML and CSS code">
          <button
            type="button"
            onClick={onExportCode}
            aria-label="Export Code"
            className="mr-1 flex h-9 items-center gap-1.5 rounded-control border border-line bg-surface-panel px-3 text-sm font-semibold text-fg-primary transition-colors duration-150 ease-studio hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:bg-surface-selected max-lg:px-2.5"
          >
            <CodeXml aria-hidden="true" className="size-3.5" />
            <span className="max-lg:sr-only">Export</span>
          </button>
        </Tooltip>
      )}

      <Tooltip
        align="end"
        label={isPreview ? "Exit Preview and return to Design" : "Preview authored click interactions"}
      >
        <button
          type="button"
          onClick={previewControl.onToggle}
          aria-pressed={isPreview}
          aria-label={isPreview ? "Exit Preview" : "Enter Preview"}
          className={cn(
            // Design mode: Preview is the header's primary action (accent
            // gradient). Preview mode: the pressed "Exit Preview" state
            // switches to an accent-outlined surface so the two states
            // never look alike.
            "flex h-9 items-center gap-1.5 rounded-control border px-3.5 text-sm font-semibold transition-[background-color,border-color,box-shadow,filter] duration-150 ease-studio focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            isPreview
              ? "border-accent bg-surface-selected text-fg-primary hover:bg-surface-hover"
              : "bg-accent-gradient border-transparent text-white shadow-panel hover:shadow-elevated hover:brightness-110 active:brightness-95",
          )}
        >
          {isPreview ? (
            <SquarePen aria-hidden="true" className="size-3.5" />
          ) : (
            <Eye aria-hidden="true" className="size-3.5" />
          )}
          {isPreview ? "Exit Preview" : "Preview"}
        </button>
      </Tooltip>

      <Tooltip align="end" label="Account isn't available yet">
        <button
          type="button"
          disabled
          aria-label="Account (not available yet)"
          className="ml-1.5 flex size-9 items-center justify-center rounded-full border border-line bg-surface-panel-secondary text-fg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed"
        >
          <UserRound aria-hidden="true" className="size-4" />
        </button>
      </Tooltip>
    </div>
  );
}

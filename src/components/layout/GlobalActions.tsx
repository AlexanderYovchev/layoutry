import { Eye, Redo2, SquarePen, Undo2, UserRound } from "lucide-react";
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

interface GlobalActionsProps {
  previewControl: PreviewControl;
}

export function GlobalActions({ previewControl }: GlobalActionsProps) {
  const isPreview = previewControl.mode === "preview";

  return (
    <div className="flex shrink-0 items-center gap-1">
      <Tooltip label="Undo (no history yet)">
        <button
          type="button"
          disabled
          aria-label="Undo (no history yet)"
          className="flex size-8 items-center justify-center rounded-md text-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed dark:text-zinc-700"
        >
          <Undo2 aria-hidden="true" className="size-4" />
        </button>
      </Tooltip>

      <Tooltip label="Redo (no history yet)">
        <button
          type="button"
          disabled
          aria-label="Redo (no history yet)"
          className="flex size-8 items-center justify-center rounded-md text-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed dark:text-zinc-700"
        >
          <Redo2 aria-hidden="true" className="size-4" />
        </button>
      </Tooltip>

      <Tooltip label={isPreview ? "Exit Preview and return to Design" : "Preview authored click interactions"}>
        <button
          type="button"
          onClick={previewControl.onToggle}
          aria-pressed={isPreview}
          aria-label={isPreview ? "Exit Preview" : "Enter Preview"}
          className={cn(
            "ml-1 flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500",
            isPreview
              ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-700"
              : "border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900",
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

      <Tooltip label="Account isn't available yet">
        <button
          type="button"
          disabled
          aria-label="Account (not available yet)"
          className="ml-1 flex size-8 items-center justify-center rounded-full border border-zinc-200 text-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed dark:border-zinc-800 dark:text-zinc-700"
        >
          <UserRound aria-hidden="true" className="size-4" />
        </button>
      </Tooltip>
    </div>
  );
}

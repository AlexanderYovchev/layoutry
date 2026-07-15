import { Redo2, Undo2, UserRound } from "lucide-react";
import { Tooltip } from "@/components/ui/Tooltip";

export function GlobalActions() {
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

      <Tooltip label="Preview isn't available yet">
        <button
          type="button"
          disabled
          aria-label="Preview (not available yet)"
          className="ml-1 flex items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 py-1.5 text-sm text-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed dark:border-zinc-800 dark:text-zinc-600"
        >
          Preview
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

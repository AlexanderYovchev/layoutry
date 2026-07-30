"use client";

import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface InspectorResetButtonProps {
  onReset: () => void;
  /** True when there is no explicit value to remove — hides the button rather than leaving a dead affordance visible. */
  disabled?: boolean;
  /** Accessible name — should name the property being reset, e.g. "Reset margin". */
  label?: string;
}

/**
 * Shared reset affordance (Checkpoint 4.1). Reset always means "remove the
 * explicit value and let the document model's own default/inherited
 * behavior take over" — the caller supplies onReset wired to that model's
 * actual default (see InspectorSpacingSection's ZERO_EDGES, the spacing
 * model's own documented unset value), never a guessed browser default.
 * Invisible (not just inert) when there is nothing to reset, so it never
 * occupies attention as a dead control.
 */
export function InspectorResetButton({ onReset, disabled = false, label = "Reset" }: InspectorResetButtonProps) {
  return (
    <button
      type="button"
      onClick={onReset}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 disabled:pointer-events-none disabled:opacity-0 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300",
      )}
    >
      <RotateCcw aria-hidden="true" className="size-3" />
    </button>
  );
}

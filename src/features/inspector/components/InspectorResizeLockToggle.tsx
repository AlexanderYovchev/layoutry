"use client";

import { Lock, Unlock } from "lucide-react";
import { cn } from "@/lib/utils";

interface InspectorResizeLockToggleProps {
  locked: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

/**
 * The Resize Proportions toggle (Checkpoint 5.7) — exposes the
 * pre-existing `aspectRatioLocked` resize-interaction flag (Checkpoint
 * 3.4.4) in the Inspector for the first time. Deliberately not
 * InspectorLinkToggle (margin/padding/gap's shared "Linked"/"Unlinked"
 * primitive): that component's copy implies "these values move
 * together," which isn't what this flag means (it governs whether a
 * *corner drag* preserves the box's *current* ratio while resizing — see
 * computeFreeChildResizeResult) — a purpose-built label avoids that
 * mismatch. Also deliberately not labelled "Aspect Ratio": Checkpoint
 * 5.5 already owns that term for the unrelated CSS `aspect-ratio`
 * property (see aspectRatio.ts's own doc comment for the full
 * distinction) — reusing the word here for a different concept would
 * be actively misleading, not just imprecise.
 */
export function InspectorResizeLockToggle({ locked, onToggle, disabled = false }: InspectorResizeLockToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={locked}
      aria-label={locked ? "Lock resize proportions (currently locked)" : "Lock resize proportions (currently unlocked)"}
      title="Lock resize proportions"
      className={cn(
        "flex h-6 items-center gap-1 rounded-md border px-2 text-xs transition-colors duration-150 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 disabled:pointer-events-none disabled:opacity-40 dark:hover:bg-zinc-800/50",
        locked
          ? "border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
          : "border-transparent text-zinc-500 dark:text-zinc-400",
      )}
    >
      {locked ? <Lock aria-hidden="true" className="size-3" /> : <Unlock aria-hidden="true" className="size-3" />}
      {locked ? "Locked" : "Unlocked"}
    </button>
  );
}

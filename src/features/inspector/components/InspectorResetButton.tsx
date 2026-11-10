"use client";

import { RotateCcw } from "lucide-react";
import type { MouseEvent } from "react";
import { cn } from "@/lib/utils";
import { RESET_BUTTON_ATTRIBUTE, resetFocusTarget, resetScopeOf } from "@/features/inspector/utils/inspectorResetScope";

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
 * actual default (e.g. InspectorSpacingSection removes the box or side,
 * leaving it unset), never a guessed browser default.
 * Invisible (not just inert) when there is nothing to reset, so it never
 * occupies attention as a dead control.
 *
 * BC-05.2:
 * - Marked as a reset button, so an edit session open in a field this
 *   reset covers is cancelled instead of committed when it is pressed
 *   (see utils/inspectorResetScope.ts).
 * - Keyboard activation (Enter/Space: a click with detail 0) usually
 *   disables, and so hides, this button. Focus would fall to <body>, so
 *   after the reset has rendered it moves to the property's own control
 *   in the same row (or section). A pointer click leaves focus alone.
 */
export function InspectorResetButton({ onReset, disabled = false, label = "Reset" }: InspectorResetButtonProps) {
  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    const button = event.currentTarget;
    const fromKeyboard = event.detail === 0;
    const scope = resetScopeOf(button);
    onReset();
    if (!fromKeyboard) return;
    // After React has rendered the reset (and possibly disabled this button).
    window.setTimeout(() => {
      const active = document.activeElement;
      const lost = active === null || active === document.body || active === button;
      if (!lost) return;
      if (button.isConnected && !button.disabled) return;
      if (scope?.isConnected) resetFocusTarget(scope)?.focus();
    }, 0);
  }

  return (
    <button
      type="button"
      {...{ [RESET_BUTTON_ATTRIBUTE]: "" }}
      onClick={handleClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-control-sm text-fg-muted transition-colors duration-150 ease-studio hover:bg-surface-hover hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-0",
      )}
    >
      <RotateCcw aria-hidden="true" className="size-3" />
    </button>
  );
}

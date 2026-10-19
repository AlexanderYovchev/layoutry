"use client";

import { cn } from "@/lib/utils";

interface InspectorBooleanToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Accessible name — required since this control has no visible text label of its own. */
  label: string;
}

/**
 * A true on/off switch (Checkpoint 4.1) — for genuine boolean settings
 * only. A multi-state CSS enum (e.g. overflow's visible/hidden/scroll/
 * auto) belongs in InspectorSegmentedRow instead; this must not be reused
 * to squeeze a 3+ option property into two visual states.
 */
export function InspectorBooleanToggle({ checked, onChange, disabled = false, label }: InspectorBooleanToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      // Positive outline-offset (ring drawn outside the pill), unlike every
      // larger rectangular Inspector control's -outline-offset-2 (ring
      // inset). Deliberate, not a missed pass: an inset ring on a 16px-tall
      // pill leaves almost nothing visible, whereas an outside ring is the
      // standard, clearly-visible treatment for small switch/checkbox-style
      // controls — see the Checkpoint 4.1.5 report's interactive-states audit.
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 ease-studio focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-40",
        checked ? "bg-accent hover:brightness-110" : "bg-line-strong hover:bg-fg-muted",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "inline-block size-4 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-studio",
          checked && "translate-x-4.5",
        )}
      />
    </button>
  );
}

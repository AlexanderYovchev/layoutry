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
      className={cn(
        "relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:pointer-events-none disabled:opacity-40",
        checked ? "bg-blue-500" : "bg-zinc-300 dark:bg-zinc-700",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "inline-block size-3 translate-x-0.5 rounded-full bg-white shadow transition-transform duration-150",
          checked && "translate-x-3.5",
        )}
      />
    </button>
  );
}

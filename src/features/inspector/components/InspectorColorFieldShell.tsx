"use client";

import { InspectorResetButton } from "@/features/inspector/components/InspectorResetButton";
import { cn } from "@/lib/utils";

interface InspectorColorFieldShellProps {
  /** A CSS color string (any valid syntax), or null when unset. This shell never parses or validates it — that's a future picker's job. */
  value: string | null;
  /** Extension point for a future color-picker popover — omitted, the swatch renders as a static (non-interactive) preview. */
  onOpenPicker?: () => void;
  onReset?: () => void;
  disabled?: boolean;
  /** Accessible name, e.g. "Background color". */
  label: string;
}

/**
 * The reusable color field shell only (Checkpoint 4.1) — swatch, value
 * text, unset state, a checkerboard alpha hint, and a reset action. No
 * picker popover, gradient support, or alpha slider yet; onOpenPicker is
 * the seam a future picker attaches to without this shell changing shape.
 */
export function InspectorColorFieldShell({
  value,
  onOpenPicker,
  onReset,
  disabled = false,
  label,
}: InspectorColorFieldShellProps) {
  const hasValue = value !== null;

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={onOpenPicker}
        disabled={disabled || !onOpenPicker}
        aria-label={`${label} swatch${hasValue ? `: ${value}` : ": unset"}`}
        className={cn(
          "relative size-5 shrink-0 overflow-hidden rounded-md border border-zinc-200 disabled:pointer-events-none dark:border-zinc-800",
          !hasValue && "border-dashed",
        )}
      >
        {hasValue && (
          <>
            {/* Checkerboard base — lets a semi-transparent color's alpha read visually through the swatch. */}
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-[linear-gradient(45deg,#d4d4d8_25%,transparent_25%),linear-gradient(-45deg,#d4d4d8_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#d4d4d8_75%),linear-gradient(-45deg,transparent_75%,#d4d4d8_75%)] bg-[length:6px_6px] bg-[position:0_0,0_3px,3px_-3px,-3px_0]"
            />
            <span aria-hidden="true" className="absolute inset-0" style={{ backgroundColor: value }} />
          </>
        )}
      </button>
      <input
        type="text"
        readOnly
        aria-label={label}
        value={value ?? ""}
        placeholder="Unset"
        disabled={disabled}
        className="min-w-20 flex-1 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-700 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
      />
      {onReset && <InspectorResetButton onReset={onReset} disabled={!hasValue} label={`Reset ${label.toLowerCase()}`} />}
    </div>
  );
}

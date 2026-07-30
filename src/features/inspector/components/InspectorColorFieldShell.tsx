"use client";

import { useState, type KeyboardEvent } from "react";
import { InspectorResetButton } from "@/features/inspector/components/InspectorResetButton";
import { cn } from "@/lib/utils";

interface InspectorColorFieldShellProps {
  /** A CSS color string (any valid syntax), or null when unset. */
  value: string | null;
  /** Extension point for a future color-picker popover — omitted, the swatch renders as a static (non-interactive) preview. */
  onOpenPicker?: () => void;
  /**
   * Makes the text field editable (Checkpoint 4.2's "hexadecimal text
   * entry, rgb()/rgba() parsing") — commits the typed text verbatim on
   * blur/Enter, Escape reverts. This component never validates the text
   * itself (that's the caller's domain concern — see
   * isValidCssColor/typography.ts); it only reflects an externally-passed
   * `error` as a visual invalid state. Omitted, the field stays the
   * original Checkpoint 4.1 read-only preview shell.
   */
  onCommit?: (value: string) => void;
  onReset?: () => void;
  disabled?: boolean;
  /** Accessible name, e.g. "Text color". */
  label: string;
  /** Presence marks the field visually invalid (red border, aria-invalid) — the caller renders the actual message (e.g. via the wrapping InspectorPropertyRow's own `error`), so it isn't duplicated here. */
  error?: string;
}

/**
 * The reusable color field shell (Checkpoint 4.1, made editable in 4.2) —
 * swatch, editable value text, unset state, a checkerboard alpha hint,
 * and a reset action. Still no picker popover or gradient support;
 * onOpenPicker remains the seam a future picker attaches to without this
 * shell changing shape.
 */
export function InspectorColorFieldShell({
  value,
  onOpenPicker,
  onCommit,
  onReset,
  disabled = false,
  label,
  error,
}: InspectorColorFieldShellProps) {
  const hasValue = value !== null;
  const isEditable = onCommit !== undefined;

  const [draft, setDraft] = useState(value ?? "");
  // Adjusts the draft when the external value changes (Undo/Redo, another
  // control affecting the same node) — same reset-during-render pattern
  // every other draft/commit Inspector control uses.
  const [lastSyncedValue, setLastSyncedValue] = useState(value);
  if (value !== lastSyncedValue) {
    setLastSyncedValue(value);
    setDraft(value ?? "");
  }

  function commit() {
    if (!onCommit) return;
    const trimmed = draft.trim();
    if (trimmed === "") {
      setDraft(value ?? "");
      return;
    }
    onCommit(trimmed);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      commit();
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      setDraft(value ?? "");
      event.currentTarget.blur();
    }
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onOpenPicker}
        disabled={disabled || !onOpenPicker}
        aria-label={`${label} swatch${hasValue ? `: ${value}` : ": unset"}`}
        className={cn(
          "relative size-6 shrink-0 overflow-hidden rounded-md border border-zinc-200 transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 disabled:pointer-events-none dark:border-zinc-800",
          onOpenPicker && "hover:border-zinc-300 dark:hover:border-zinc-700",
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
        readOnly={!isEditable}
        aria-label={label}
        aria-invalid={error ? true : undefined}
        value={isEditable ? draft : (value ?? "")}
        onChange={isEditable ? (event) => setDraft(event.target.value) : undefined}
        onBlur={isEditable ? commit : undefined}
        onKeyDown={isEditable ? handleKeyDown : undefined}
        placeholder="Unset"
        disabled={disabled}
        className={cn(
          "h-6 min-w-20 flex-1 rounded-md border bg-zinc-50 px-2 text-xs text-zinc-700 disabled:opacity-50 dark:bg-zinc-900 dark:text-zinc-300",
          error
            ? "border-red-400 dark:border-red-600"
            : "border-zinc-200 dark:border-zinc-800",
          isEditable &&
            "focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500",
        )}
      />
      {onReset && <InspectorResetButton onReset={onReset} disabled={!hasValue} label={`Reset ${label.toLowerCase()}`} />}
    </div>
  );
}

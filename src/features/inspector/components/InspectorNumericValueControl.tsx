"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { InspectorUnitSelect, type CssUnit } from "@/features/inspector/components/InspectorUnitSelect";

export type NumericOrAuto = number | "auto";

interface InspectorNumericValueControlProps {
  /** Accessible name — matched by getByLabelText in tests the same way a <label for> would be. */
  ariaLabel: string;
  value: NumericOrAuto;
  onCommit: (value: NumericOrAuto) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Step used with Shift held — defaults to 10x step. */
  largeStep?: number;
  /** Lets an empty draft commit "auto" instead of reverting — off by default, since most numeric properties have no keyword state. */
  allowAuto?: boolean;
  unit?: CssUnit;
  allowedUnits?: readonly CssUnit[];
  onUnitChange?: (unit: CssUnit) => void;
  disabled?: boolean;
}

function clamp(value: number, min?: number, max?: number): number {
  let result = value;
  if (min !== undefined) result = Math.max(min, result);
  if (max !== undefined) result = Math.min(max, result);
  return result;
}

function formatDraft(value: NumericOrAuto): string {
  return value === "auto" ? "" : String(value);
}

/**
 * The general-purpose numeric CSS control (Checkpoint 4.1) — draft/commit
 * editing in the same spirit as InspectorNumberFieldRow (blur/Enter
 * commits, Escape reverts to the last-synced value, an invalid draft is
 * discarded rather than committing NaN — see that component's tests for
 * the pattern this generalizes), plus an optional "auto" keyword state,
 * min/max clamping applied at commit time, keyboard Arrow Up/Down
 * increment (Shift for the larger step), and an optional unit selector.
 * Existing simple call sites can keep using InspectorNumberFieldRow;
 * this is the richer control future CSS properties needing units, auto,
 * or bounds should build on. Never bypasses the caller's onCommit — this
 * component holds only transient draft-text state, never the committed
 * value itself.
 */
export function InspectorNumericValueControl({
  ariaLabel,
  value,
  onCommit,
  min,
  max,
  step = 1,
  largeStep,
  allowAuto = false,
  unit,
  allowedUnits,
  onUnitChange,
  disabled = false,
}: InspectorNumericValueControlProps) {
  const inputId = useId();
  const [draft, setDraft] = useState(() => formatDraft(value));

  // Adjusts the draft when the external value changes (a live drag/resize
  // session elsewhere, an Undo/Redo, or another field's commit that also
  // affects this one) — reset during render itself against the
  // previous-render value, the same pattern InspectorNumberFieldRow uses,
  // rather than a useEffect (avoids an extra cascading render).
  const [lastSyncedValue, setLastSyncedValue] = useState(value);
  if (value !== lastSyncedValue) {
    setLastSyncedValue(value);
    setDraft(formatDraft(value));
  }

  function commit() {
    const trimmed = draft.trim();
    if (trimmed === "") {
      if (allowAuto) {
        onCommit("auto");
      } else {
        setDraft(formatDraft(value));
      }
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      setDraft(formatDraft(value));
      return;
    }
    onCommit(clamp(parsed, min, max));
  }

  function applyStep(delta: number) {
    const current = typeof value === "number" ? value : min ?? 0;
    const next = clamp(current + delta, min, max);
    setDraft(String(next));
    onCommit(next);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      commit();
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      setDraft(formatDraft(value));
      event.currentTarget.blur();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      applyStep(event.shiftKey ? largeStep ?? step * 10 : step);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      applyStep(-(event.shiftKey ? largeStep ?? step * 10 : step));
    }
  }

  return (
    <div className="flex items-center gap-1">
      <input
        id={inputId}
        aria-label={ariaLabel}
        type="number"
        value={draft}
        placeholder={allowAuto ? "Auto" : undefined}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        className="h-6 min-w-14 rounded-md border border-zinc-200 bg-zinc-50 px-2 text-right text-xs text-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
      />
      {unit && allowedUnits && allowedUnits.length > 0 && (
        <InspectorUnitSelect
          unit={unit}
          allowedUnits={allowedUnits}
          onChange={(next) => onUnitChange?.(next)}
          disabled={disabled}
          label={`${ariaLabel} unit`}
        />
      )}
    </div>
  );
}

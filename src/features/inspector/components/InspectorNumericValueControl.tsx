"use client";

import { useId, useRef, type KeyboardEvent } from "react";
import { InspectorUnitSelect, type CssUnit } from "@/features/inspector/components/InspectorUnitSelect";
import { cn } from "@/lib/utils";
import { inspectorFieldClassName } from "@/features/inspector/components/inspectorFieldClassName";
import { useNumericEditSession } from "@/features/inspector/hooks/useNumericEditSession";

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
  /** Called when the user cancels an edit with Escape — clear a transient validation message here. */
  onEditCancel?: () => void;
  /** Apply valid drafts while typing (BC-01.3). On by default; off = commit on blur/Enter only. */
  live?: boolean;
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

function parseFiniteNumber(draft: string): number | null {
  const trimmed = draft.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * The general-purpose numeric CSS control (Checkpoint 4.1) — units, an
 * optional "auto" keyword state, min/max clamping, keyboard Arrow Up/Down
 * stepping (Shift for the larger step) and an optional unit selector.
 *
 * Live editing (BC-01.3): every valid draft is applied to the document as
 * the user types, and the whole edit — typing and Arrow steps until Enter,
 * blur, a click elsewhere or a selection change — is one undo entry;
 * Escape restores the pre-edit value. Incomplete or out-of-range drafts
 * are never written: min/max still clamp only when the edit is committed,
 * and an empty draft still commits "auto" (allowAuto) only at commit. See
 * useNumericEditSession for the full lifecycle, including the Checkpoint
 * 5.5 (Enter/Escape double-blur) and 5.6 (no commit without an edit)
 * fixes it carries forward. `live={false}` keeps commit-on-blur/Enter.
 * Never bypasses the caller's onCommit — it holds only transient draft
 * text, never the committed value itself.
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
  onEditCancel,
  live = true,
}: InspectorNumericValueControlProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const session = useNumericEditSession<NumericOrAuto>({
    inputRef,
    value,
    format: formatDraft,
    parseLive: (draft) => {
      const parsed = parseFiniteNumber(draft);
      return parsed !== null && clamp(parsed, min, max) === parsed ? { value: parsed } : null;
    },
    parseFinal: (draft) => {
      if (draft.trim() === "") return allowAuto ? { value: "auto" } : null;
      const parsed = parseFiniteNumber(draft);
      return parsed === null ? null : { value: clamp(parsed, min, max) };
    },
    onCommit,
    onEditCancel,
    live,
  });

  function applyStep(delta: number) {
    const current = typeof value === "number" ? value : min ?? 0;
    session.stepTo(clamp(current + delta, min, max));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      session.commitAndRelease(event.currentTarget);
    } else if (event.key === "Escape") {
      event.preventDefault();
      session.cancelAndRelease(event.currentTarget);
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
        ref={inputRef}
        id={inputId}
        aria-label={ariaLabel}
        type="number"
        value={session.draft}
        placeholder={allowAuto ? "Auto" : undefined}
        disabled={disabled}
        onChange={session.handleChange}
        onBlur={session.handleBlur}
        onKeyDown={handleKeyDown}
        className={cn(inspectorFieldClassName, "min-w-14 px-2 text-right")}
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

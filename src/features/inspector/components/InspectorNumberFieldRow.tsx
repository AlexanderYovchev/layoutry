"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { inspectorFieldClassName } from "@/features/inspector/components/inspectorFieldClassName";
import { InspectorPropertyStateDot } from "@/features/inspector/components/InspectorPropertyStateDot";
import { useInspectorEditSession } from "@/features/inspector/hooks/useInspectorEditSession";
import type { PropertyState } from "@/features/inspector/types/propertyState";
import { resetScopeProps } from "@/features/inspector/utils/inspectorResetScope";

interface InspectorNumberFieldRowProps {
  label: string;
  value: number;
  onCommit: (value: number) => void;
  /**
   * Apply valid drafts while typing (BC-01.3). Off by default: this row
   * also edits structure and attributes (table/list/option counts,
   * progress, SVG geometry), where a live "1" on the way to "12" would
   * really delete rows. Callers opt in only for CSS properties.
   */
  live?: boolean;
  /** Property-state dot next to the label (BC-05.2), as InspectorPropertyRow and InspectorSegmentedRow show it. */
  state?: PropertyState;
  /** Reset affordance after the field (BC-05.2) — typically an InspectorResetButton. */
  reset?: ReactNode;
}

function formatDraft(value: number): string {
  return String(Math.round(value));
}

function parseFiniteNumber(draft: string): { value: number } | null {
  if (draft.trim() === "") return null;
  const parsed = Number(draft);
  return Number.isFinite(parsed) ? { value: parsed } : null;
}

/**
 * An editable numeric row (Checkpoint 3.4.4) — the counterpart to the
 * read-only InspectorFieldRow, used for a Free child's X/Y/Width/Height
 * fields and the other simple numeric rows. Every commit goes through
 * onCommit, which callers wire to the same store action the drag/resize
 * handles use (see InspectorFreeGeometryFields), so the Inspector is never
 * a second source of truth. Escape reverts without committing; an invalid
 * (non-numeric) draft is discarded rather than committing NaN.
 *
 * Shares its draft/commit lifecycle with InspectorNumericValueControl via
 * useInspectorEditSession (BC-01.3), including the Checkpoint 5.7 fixes that
 * hook carries forward (no double commit from Enter's own blur, no commit
 * without an edit), and optionally its live mode.
 */
export function InspectorNumberFieldRow({ label, value, onCommit, live = false, state, reset }: InspectorNumberFieldRowProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const session = useInspectorEditSession<number>({
    inputRef,
    value,
    format: formatDraft,
    parseLive: parseFiniteNumber,
    parseFinal: parseFiniteNumber,
    onCommit,
    live,
  });

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      session.commitAndRelease(event.currentTarget);
    } else if (event.key === "Escape") {
      event.preventDefault();
      session.cancelAndRelease(event.currentTarget);
    }
  }

  const labelElement = (
    <label htmlFor={inputId} className="text-zinc-500 dark:text-zinc-400">
      {label}
    </label>
  );
  const inputElement = (
    <input
      ref={inputRef}
      id={inputId}
      type="number"
      value={session.draft}
      onChange={session.handleChange}
      onInput={session.handleInput}
      onBlur={session.handleBlur}
      onKeyDown={handleKeyDown}
      className={cn(inspectorFieldClassName, "min-w-16 px-2 text-right")}
    />
  );

  return (
    <div {...resetScopeProps} className="flex items-center justify-between gap-2 text-xs">
      {/* The wrappers appear only with a state or reset, so rows without them keep their original structure. */}
      {state ? (
        <div className="flex min-w-0 items-center gap-1">
          {labelElement}
          <InspectorPropertyStateDot state={state} />
        </div>
      ) : (
        labelElement
      )}
      {reset ? (
        <div className="flex items-center gap-1">
          {inputElement}
          {reset}
        </div>
      ) : (
        inputElement
      )}
    </div>
  );
}

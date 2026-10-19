"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import type { SharedValue } from "@/features/inspector/types/sharedValue";
import { cn } from "@/lib/utils";
import { inspectorFieldClassName } from "@/features/inspector/components/inspectorFieldClassName";

interface InspectorBulkNumberFieldProps {
  ariaLabel: string;
  shared: SharedValue<number>;
  onCommit: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}

function clamp(value: number, min?: number, max?: number): number {
  let result = value;
  if (min !== undefined) result = Math.max(min, result);
  if (max !== undefined) result = Math.min(max, result);
  return result;
}

/**
 * The multi-selection counterpart to InspectorNumericValueControl
 * (Checkpoint 1.15.2) — a separate, small component rather than teaching
 * the single-selection control a "mixed" mode: that control's `value`
 * is typed `NumericOrAuto` with no room for a genuinely-blank-but-not-
 * "auto" display, and every one of its existing callers/tests assumes a
 * real number is always shown. Same draft/touched/suppressNextBlurCommitRef
 * shape every proven text field in this app already uses (see
 * InspectorMediaTextField's own doc comment for the exact race that
 * guards against) — a mixed field shows an empty draft with a "Mixed"
 * placeholder rather than any one selected node's own value, and typing
 * a real number and committing applies that SAME number to every
 * selected node in one bulk action (Checkpoint 1.15.2, Part 27).
 */
export function InspectorBulkNumberField({ ariaLabel, shared, onCommit, min, max, disabled = false }: InspectorBulkNumberFieldProps) {
  const displayValue = shared.kind === "same" ? String(shared.value) : "";
  const [draft, setDraft] = useState(displayValue);
  const [touched, setTouched] = useState(false);
  const suppressNextBlurCommitRef = useRef(false);
  const [lastSynced, setLastSynced] = useState(shared);
  if (shared !== lastSynced && (shared.kind !== lastSynced.kind || (shared.kind === "same" && lastSynced.kind === "same" && shared.value !== lastSynced.value))) {
    setLastSynced(shared);
    setDraft(displayValue);
    setTouched(false);
  }

  function commit() {
    if (!touched) return;
    setTouched(false);
    const trimmed = draft.trim();
    if (trimmed === "") {
      setDraft(displayValue);
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      setDraft(displayValue);
      return;
    }
    onCommit(clamp(parsed, min, max));
  }

  function handleBlur() {
    if (suppressNextBlurCommitRef.current) {
      suppressNextBlurCommitRef.current = false;
      return;
    }
    commit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      commit();
      suppressNextBlurCommitRef.current = true;
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setDraft(displayValue);
      setTouched(false);
      suppressNextBlurCommitRef.current = true;
      event.currentTarget.blur();
    }
  }

  return (
    <input
      aria-label={ariaLabel}
      type="number"
      value={draft}
      placeholder={shared.kind === "mixed" ? "Mixed" : undefined}
      disabled={disabled}
      onChange={(event) => {
        setDraft(event.target.value);
        setTouched(true);
      }}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={cn(
        inspectorFieldClassName,
        "min-w-14 px-2 text-right",
        shared.kind === "mixed" && "placeholder:text-zinc-400 placeholder:italic dark:placeholder:text-zinc-500",
      )}
    />
  );
}

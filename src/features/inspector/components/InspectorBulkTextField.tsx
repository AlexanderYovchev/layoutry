"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import type { SharedValue } from "@/features/inspector/types/sharedValue";
import { cn } from "@/lib/utils";

interface InspectorBulkTextFieldProps {
  ariaLabel: string;
  shared: SharedValue<string>;
  onCommit: (value: string) => void;
  placeholder?: string;
  error?: string;
}

/**
 * The multi-selection counterpart to the app's proven single-node draft/
 * commit/Escape-revert text field (LinkDestinationField/
 * InspectorMediaTextField/IdentityTextField) — same touched/
 * suppressNextBlurCommitRef guard shape, but shows an empty draft with a
 * "Mixed" placeholder instead of any one selected node's own value when
 * the selection disagrees (Checkpoint 1.15.2). An empty committed draft
 * reverts rather than clearing (this field is only used for CSS text
 * values like color, which have their own dedicated Reset affordance —
 * matching every other CSS text field's own convention, unlike
 * Identity's deliberate clear-on-empty).
 */
export function InspectorBulkTextField({ ariaLabel, shared, onCommit, placeholder, error }: InspectorBulkTextFieldProps) {
  const displayValue = shared.kind === "same" ? shared.value : "";
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
    onCommit(trimmed);
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
      type="text"
      aria-invalid={error ? true : undefined}
      value={draft}
      placeholder={shared.kind === "mixed" ? "Mixed" : placeholder}
      onChange={(event) => {
        setDraft(event.target.value);
        setTouched(true);
      }}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={cn(
        "h-6 w-full min-w-0 rounded-md border bg-zinc-50 px-2 text-xs text-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 dark:bg-zinc-900 dark:text-zinc-300",
        error ? "border-red-400 dark:border-red-600" : "border-zinc-200 dark:border-zinc-800",
        shared.kind === "mixed" && "placeholder:text-zinc-400 placeholder:italic dark:placeholder:text-zinc-500",
      )}
    />
  );
}

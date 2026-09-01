"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { InspectorPropertyRow } from "@/features/inspector/components/InspectorPropertyRow";
import { InspectorResetButton } from "@/features/inspector/components/InspectorResetButton";
import { cn } from "@/lib/utils";

interface InspectorMediaTextFieldProps {
  id: string;
  label: string;
  value: string;
  hasExplicitValue: boolean;
  placeholder?: string;
  onCommit: (value: string) => void;
  onReset: () => void;
  error?: string;
}

/**
 * A shared draft/commit/Escape-revert text field for element-data (not
 * CSS) fields (Checkpoint 1.15) — built on InspectorLinkSection's own
 * LinkDestinationField (same two bug fixes: `touched`, so blurring an
 * untouched field never pushes a spurious no-op history entry;
 * `suppressNextBlurCommitRef`, so Enter's own `blur()` call never
 * double-commits — genuinely load-bearing, not redundant with `touched`
 * alone: `event.currentTarget.blur()` dispatches a real, SYNCHRONOUS
 * native blur event immediately after `setTouched(false)`, but that
 * `setState` call hasn't re-rendered yet, so the blur handler's own
 * closure still sees the stale pre-update `touched` value unless a ref,
 * not state, gates it — this exact race is what a first-draft version of
 * Iframe's own Title field silently reintroduced before being caught and
 * fixed by reusing this component instead).
 *
 * Unlike LinkDestinationField/BackgroundImageUrlField (each intentionally
 * left unshared with only one consumer at the time — see either's own
 * doc comment), this checkpoint has FOUR simultaneous consumers from the
 * moment it's written (Video's Source URL and Poster URL, Iframe's Source
 * URL and Title), well past this project's own "don't extract until
 * genuinely shared by more than one consumer" threshold. No built-in URL
 * validation lives here — that stays the caller's concern (see
 * InspectorVideoSection/InspectorIframeSection's own isValidLinkHref
 * checks), the same division LinkDestinationField already uses; Title has
 * no such check since a plain accessible-name string has no URL shape to
 * validate.
 *
 * An empty draft on blur/Enter reverts rather than committing — Reset is
 * the only clear affordance, the same convention every other text-shaped
 * field in this app already uses.
 */
export function InspectorMediaTextField({
  id,
  label,
  value,
  hasExplicitValue,
  placeholder,
  onCommit,
  onReset,
  error,
}: InspectorMediaTextFieldProps) {
  const [draft, setDraft] = useState(value);
  const [touched, setTouched] = useState(false);
  const suppressNextBlurCommitRef = useRef(false);
  const [lastSyncedValue, setLastSyncedValue] = useState(value);
  if (value !== lastSyncedValue) {
    setLastSyncedValue(value);
    setDraft(value);
    setTouched(false);
  }

  function commit() {
    if (!touched) return;
    setTouched(false);
    const trimmed = draft.trim();
    if (trimmed === "") {
      setDraft(value);
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
      setDraft(value);
      setTouched(false);
      suppressNextBlurCommitRef.current = true;
      event.currentTarget.blur();
    }
  }

  return (
    <InspectorPropertyRow
      label={label}
      labelHtmlFor={id}
      variant="stack"
      state={error ? "invalid" : hasExplicitValue ? "set" : "unset"}
      error={error}
      reset={<InspectorResetButton onReset={onReset} disabled={!hasExplicitValue} label={`Reset ${label.toLowerCase()}`} />}
    >
      <input
        id={id}
        type="text"
        aria-invalid={error ? true : undefined}
        value={draft}
        placeholder={placeholder}
        onChange={(event) => {
          setDraft(event.target.value);
          setTouched(true);
        }}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={cn(
          "h-6 w-full rounded-md border bg-zinc-50 px-2 text-xs text-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 dark:bg-zinc-900 dark:text-zinc-300",
          error ? "border-red-400 dark:border-red-600" : "border-zinc-200 dark:border-zinc-800",
        )}
      />
    </InspectorPropertyRow>
  );
}

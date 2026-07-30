"use client";

import { useId, useState, type KeyboardEvent } from "react";

interface InspectorNumberFieldRowProps {
  label: string;
  value: number;
  onCommit: (value: number) => void;
}

/**
 * An editable numeric row (Checkpoint 3.4.4) — the counterpart to the
 * read-only InspectorFieldRow, used for a Free child's X/Y/Width/Height
 * fields. Edits are local (draft state) until blur/Enter commits them
 * through onCommit, which every caller wires to the same store action
 * the drag/resize handles use (see InspectorFreeGeometryFields), so the
 * Inspector is never a second source of truth for geometry. Escape
 * reverts the draft to the last committed value without calling
 * onCommit. An invalid (non-numeric) draft on blur/Enter is discarded
 * the same way, rather than committing NaN.
 */
export function InspectorNumberFieldRow({ label, value, onCommit }: InspectorNumberFieldRowProps) {
  const inputId = useId();
  const [draft, setDraft] = useState(String(Math.round(value)));

  // Keeps the field in sync with live external updates (a drag/resize
  // session, or another field's commit that also affects this one) by
  // comparing against the value seen on the previous render, resetting
  // draft during render itself rather than in a useEffect (React's
  // recommended "adjusting state when a prop changes" pattern — avoids
  // the extra cascading render a useEffect-based sync would cause).
  const [lastSyncedValue, setLastSyncedValue] = useState(value);
  if (value !== lastSyncedValue) {
    setLastSyncedValue(value);
    setDraft(String(Math.round(value)));
  }

  function commit() {
    const parsed = Number(draft);
    if (draft.trim() !== "" && Number.isFinite(parsed)) {
      onCommit(parsed);
    } else {
      setDraft(String(Math.round(value)));
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      commit();
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      setDraft(String(Math.round(value)));
      event.currentTarget.blur();
    }
  }

  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <label htmlFor={inputId} className="text-zinc-500 dark:text-zinc-400">
        {label}
      </label>
      <input
        id={inputId}
        type="number"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        className="h-6 min-w-16 rounded-md border border-zinc-200 bg-zinc-50 px-2 text-right text-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
      />
    </div>
  );
}

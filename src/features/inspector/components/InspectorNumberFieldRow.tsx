"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";

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
 *
 * Two bug fixes (Checkpoint 5.7 — this control shares the exact same
 * risk class InspectorNumericValueControl already had two real bugs
 * found and fixed for, in Checkpoints 5.5 and 5.6, but had never itself
 * been audited):
 *
 * 1. Enter/Escape both call event.currentTarget.blur() to visually
 *    release focus. In a genuinely-focused real browser input, that
 *    dispatches a real native blur event, which this input's own
 *    onBlur handler previously treated as an *unrelated second* commit
 *    of the identical already-committed (Enter) or just-reverted
 *    (Escape) draft — silently doubling undo/redo history entries for
 *    one keypress (the Checkpoint 5.5 bug). suppressNextBlurCommitRef
 *    fixes this exactly like InspectorNumericValueControl does.
 * 2. A blur with no edit at all (tabbing into an X/Y/Width/Height field
 *    without touching it, then clicking elsewhere) still ran the full
 *    commit path and called onCommit with the value it already had —
 *    a spurious no-op history entry (the Checkpoint 5.6 bug). `touched`
 *    fixes this exactly like InspectorNumericValueControl does — set
 *    only by a real onChange, cleared on every resync/commit, so
 *    commit() can tell "genuinely edited" apart from "focus passed
 *    through."
 */
export function InspectorNumberFieldRow({ label, value, onCommit }: InspectorNumberFieldRowProps) {
  const inputId = useId();
  const [draft, setDraft] = useState(String(Math.round(value)));
  const suppressNextBlurCommitRef = useRef(false);
  const [touched, setTouched] = useState(false);

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
    setTouched(false);
  }

  function commit() {
    if (!touched) return;
    setTouched(false);
    const parsed = Number(draft);
    if (draft.trim() !== "" && Number.isFinite(parsed)) {
      onCommit(parsed);
    } else {
      setDraft(String(Math.round(value)));
    }
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
      setDraft(String(Math.round(value)));
      setTouched(false);
      suppressNextBlurCommitRef.current = true;
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
        onChange={(event) => {
          setDraft(event.target.value);
          setTouched(true);
        }}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="h-6 min-w-16 rounded-md border border-zinc-200 bg-zinc-50 px-2 text-right text-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
      />
    </div>
  );
}

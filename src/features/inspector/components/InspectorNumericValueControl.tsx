"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
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
 *
 * Bug fix (Checkpoint 5.5 — found via this checkpoint's own real-browser
 * undo/redo verification, but pre-existing since Checkpoint 4.1 and
 * shared by every caller of this control, e.g. Position's Offsets/
 * Z-index fields, not just Aspect Ratio): Enter and Escape both call
 * event.currentTarget.blur() to visually release focus after handling
 * the key. In a genuinely-focused real browser input, that .blur() call
 * dispatches a real native blur event, which this same input's own
 * onBlur handler previously treated as an *unrelated second* commit of
 * the identical already-committed (Enter) or just-reverted (Escape)
 * draft — silently doubling the undo/redo history entries for what a
 * user experiences as one single action. Existing unit tests never
 * caught this because a synthetic `fireEvent.keyDown` fired at an
 * element that was never actually `.focus()`-ed leaves
 * `document.activeElement` unchanged, so the follow-up `.blur()` call is
 * a no-op in that context — see this file's own test suite for a
 * regression test that explicitly focuses the input first, reproducing
 * the real-browser condition. suppressNextBlurCommitRef fixes this at
 * the root (this shared primitive), not per call site.
 *
 * Bug fix (Checkpoint 5.6 — found the same way, via this checkpoint's own
 * real-browser undo/redo verification, this time of Object Position's
 * tab-adjacent X/Y fields, but again pre-existing since Checkpoint 4.1
 * and shared by every caller with more than one numeric field in tab
 * order — Position's Offsets X/Y, Aspect Ratio's Custom width/height,
 * Background's Custom size, not just Object Position): tabbing *into* a
 * field without ever editing it, then blurring it by clicking elsewhere,
 * still ran the full commit path and called onCommit with the value it
 * already had — pushing a spurious, no-op history entry for a field the
 * user never touched. `touched` (set only by a real onChange, cleared on
 * every resync or successful commit) now guards commit() so it can tell
 * "the user actually edited this field" apart from "focus merely passed
 * through it" — deliberately not a `next !== value` equality check,
 * which would also swallow a genuine edit that happens to resolve to the
 * same number (e.g. Spacing's unset-padding-reads-as-0: typing "0" there
 * must still commit, since that's how an implicit default becomes an
 * explicit stored value).
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
  // Enter and Escape both call event.currentTarget.blur() to visually
  // release focus after handling the key — in a real, genuinely-focused
  // browser input (unlike a synthetic keyDown fired at an unfocused
  // element in a test), that .blur() call dispatches a real native blur
  // event, which the input's own onBlur={commit} handler would otherwise
  // treat as an *unrelated* second commit of the same already-committed
  // (or just-reverted) draft — silently doubling the undo/redo history
  // entries for a single Enter/Escape keypress. This ref suppresses
  // exactly that one following blur, and only that one.
  const suppressNextBlurCommitRef = useRef(false);

  // Checkpoint 5.6 fix (found via this checkpoint's own real-browser
  // undo/redo verification of Object Position's tab-adjacent X/Y fields,
  // but pre-existing since Checkpoint 4.1 and shared by every caller with
  // more than one numeric field in tab order — Position's Offsets X/Y,
  // Aspect Ratio's Custom width/height, Background's Custom size, not
  // just Object Position): tabbing *into* a field without ever editing
  // it, then blurring it by clicking elsewhere, still ran the full commit
  // path and called onCommit with the value it already had — pushing a
  // spurious, no-op history entry for a field the user never touched.
  // `touched` is set only by a real onChange, and cleared on every resync
  // (external value change) or successful commit, so commit() can tell
  // "the user actually edited this field" apart from "focus merely
  // passed through it." Deliberately NOT a `next !== value` equality
  // check instead: a caller may pass an *effective/defaulted* display
  // value (e.g. Spacing's unset-padding reading as 0), where committing a
  // genuinely-typed value that resolves to that same number is exactly
  // how an implicit default becomes an explicit stored one — skipping
  // that commit would silently break "make it explicit" flows. Only "no
  // edit occurred at all" is safe to treat as a no-op.
  const [touched, setTouched] = useState(false);

  // Adjusts the draft when the external value changes (a live drag/resize
  // session elsewhere, an Undo/Redo, or another field's commit that also
  // affects this one) — reset during render itself against the
  // previous-render value, the same pattern InspectorNumberFieldRow uses,
  // rather than a useEffect (avoids an extra cascading render).
  const [lastSyncedValue, setLastSyncedValue] = useState(value);
  if (value !== lastSyncedValue) {
    setLastSyncedValue(value);
    setDraft(formatDraft(value));
    setTouched(false);
  }

  function commit() {
    if (!touched) return;
    setTouched(false);
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
      setDraft(formatDraft(value));
      setTouched(false);
      suppressNextBlurCommitRef.current = true;
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
        onChange={(event) => {
          setDraft(event.target.value);
          setTouched(true);
        }}
        onBlur={handleBlur}
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

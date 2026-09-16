"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { cn } from "@/lib/utils";

interface InspectorSliderFieldProps {
  label: string;
  /** null means "Mixed" — a multi-selection whose selected nodes currently disagree on this value (section 34: never pretend there's one current value). */
  value: number | null;
  min: number;
  max: number;
  step?: number;
  /** Shown after the numeric field, e.g. "px" or "%" — purely cosmetic, never silently converts what's stored (section 33). */
  unit?: string;
  disabled?: boolean;
  /**
   * Called on every live drag/keyboard tick (the native range input's own
   * `input` event) — wire this to a non-history "Live" store setter (the
   * same convention resizeElement/setFreeChildGeometryLive/
   * setElementBoxShadowLive already established). This component itself
   * wraps the WHOLE gesture in beginTransaction()/commitTransaction(), so
   * any number of onLiveChange calls between them still collapse into
   * exactly one undo step (section 28) — callers never need to manage
   * transactions themselves.
   */
  onLiveChange: (value: number) => void;
  /**
   * Called exactly once when the paired exact-entry numeric field commits
   * (Enter or blur) — wire this to the property's normal, history-
   * pushing setter (one commit = one history entry, matching every other
   * Inspector numeric field). Never called for the slider itself — the
   * slider's own commit is commitTransaction(), triggered internally by
   * this component's native `change` listener.
   */
  onCommit: (value: number) => void;
}

/**
 * The reusable Inspector slider (Checkpoint 1.15.6.1.1, sections 25-27) —
 * [[label]] / [range][numeric][unit], shared by every slider-enabled
 * property rather than one bespoke component per CSS property. Exact
 * numeric entry always stays available alongside the slider (never
 * replaces it).
 *
 * The native `<input type="range">` is deliberately UNCONTROLLED (no
 * `value` prop), synced imperatively via a ref effect — the exact same
 * "controlled range/color input footgun" fix InspectorColorFieldShell's
 * own doc comment documents in detail: a React-controlled range input
 * (even with a technically-correct onChange) fights the browser the
 * moment any unrelated store update re-renders this component mid-drag
 * (which happens constantly in this app, since the drag's own live
 * writes go through Zustand), snapping the thumb back to the last
 * rendered prop and fighting the user's own in-progress gesture. Reading
 * the DOM's own live value from the native `input`/`change` listeners
 * avoids this entirely — this component never fights what the browser is
 * already tracking.
 *
 * History (section 28): beginTransaction() fires on the first `input`
 * tick of a fresh gesture (guarded by draggingRef so it only ever fires
 * once per gesture, not once per tick — keyboard arrow-key adjustment
 * produces a separate `input` event per key press, and each one must
 * still only need ONE commit if the user holds the key down, exactly
 * like a pointer drag); commitTransaction() fires on the native `change`
 * event, which browsers dispatch exactly once when a range input's
 * interaction ends (pointerup, or the key that ends a
 * keyboard-adjustment). Escape mid-gesture restores the pre-gesture
 * document (mirroring every other continuous-drag session's own
 * Escape-cancel) and resets the input's own DOM value to match.
 */
export function InspectorSliderField({ label, value, min, max, step = 1, unit, disabled = false, onLiveChange, onCommit }: InspectorSliderFieldProps) {
  const sliderId = useId();
  const numberId = useId();
  const isMixed = value === null;
  const displayValue = value ?? Math.round((min + max) / 2);

  const rangeRef = useRef<HTMLInputElement>(null);
  const draggingRef = useRef(false);
  const preGestureValueRef = useRef(displayValue);
  // Always holds the last value synced in FROM OUTSIDE (props) — updated
  // in the same effect that pushes displayValue into the uncontrolled
  // input below, never by the input's own live interaction. A gesture's
  // pre-gesture snapshot must read this, not the DOM input's current
  // value: by the time handleInput's first tick runs, fireEvent/the
  // browser has already written the NEW dragged-to value into the DOM,
  // so the DOM itself no longer remembers what the value was a moment ago.
  const lastKnownValueRef = useRef(displayValue);

  const [draft, setDraft] = useState(isMixed ? "" : String(displayValue));
  const [touched, setTouched] = useState(false);
  const [lastSyncedValue, setLastSyncedValue] = useState(value);
  if (value !== lastSyncedValue) {
    setLastSyncedValue(value);
    setDraft(value === null ? "" : String(value));
    setTouched(false);
  }

  // Imperative sync into the uncontrolled range input — only ever pushes
  // a value IN from outside (undo/redo, another control, a fresh
  // selection); never overwrites the input's own live interaction, since
  // this only reruns when `displayValue` itself changes from outside.
  useEffect(() => {
    const input = rangeRef.current;
    if (input && Number(input.value) !== displayValue) input.value = String(displayValue);
    lastKnownValueRef.current = displayValue;
  }, [displayValue]);

  useEffect(() => {
    const input = rangeRef.current;
    if (!input) return;

    function handleInput() {
      if (!draggingRef.current) {
        draggingRef.current = true;
        preGestureValueRef.current = lastKnownValueRef.current;
        useEditorStore.getState().beginTransaction();
      }
      onLiveChange(Number(input!.value));
    }

    function handleChange() {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      useEditorStore.getState().commitTransaction();
    }

    input.addEventListener("input", handleInput);
    input.addEventListener("change", handleChange);
    return () => {
      input.removeEventListener("input", handleInput);
      input.removeEventListener("change", handleChange);
    };
  }, [onLiveChange]);

  function handleSliderKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Escape" || !draggingRef.current) return;
    event.preventDefault();
    const store = useEditorStore.getState();
    const snapshot = store.transactionSnapshot;
    if (snapshot) useEditorStore.setState({ document: snapshot.document, selection: snapshot.selection });
    store.cancelTransaction();
    draggingRef.current = false;
    if (rangeRef.current) rangeRef.current.value = String(preGestureValueRef.current);
    event.currentTarget.blur();
  }

  function commitNumericDraft() {
    if (!touched) return;
    setTouched(false);
    const parsed = Number(draft);
    if (draft.trim() !== "" && Number.isFinite(parsed)) {
      const clamped = Math.min(max, Math.max(min, parsed));
      onCommit(clamped);
    } else {
      setDraft(isMixed ? "" : String(displayValue));
    }
  }

  function handleNumericKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      commitNumericDraft();
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setDraft(isMixed ? "" : String(displayValue));
      setTouched(false);
      event.currentTarget.blur();
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <label htmlFor={sliderId} className="text-zinc-500 dark:text-zinc-400">
          {label}
        </label>
      </div>
      <div className="flex items-center gap-2">
        <input
          ref={rangeRef}
          id={sliderId}
          type="range"
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          defaultValue={displayValue}
          onKeyDown={handleSliderKeyDown}
          aria-label={label}
          className={cn("h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-zinc-200 accent-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-800")}
        />
        <input
          id={numberId}
          type="number"
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          aria-label={`${label} (exact value)`}
          value={draft}
          placeholder={isMixed ? "Mixed" : undefined}
          onChange={(event) => {
            setDraft(event.target.value);
            setTouched(true);
          }}
          onBlur={commitNumericDraft}
          onKeyDown={handleNumericKeyDown}
          className="h-6 w-14 shrink-0 rounded-md border border-zinc-200 bg-zinc-50 px-2 text-right text-xs text-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
        />
        {unit && <span className="w-5 shrink-0 text-xs text-zinc-400 dark:text-zinc-500">{unit}</span>}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useId, useRef, type KeyboardEvent } from "react";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { cn } from "@/lib/utils";
import { inspectorFieldClassName } from "@/features/inspector/components/inspectorFieldClassName";
import { useInspectorEditSession } from "@/features/inspector/hooks/useInspectorEditSession";

function parseFiniteNumber(draft: string): number | null {
  if (draft.trim() === "") return null;
  const parsed = Number(draft);
  return Number.isFinite(parsed) ? parsed : null;
}

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
   * Called by the paired exact-entry numeric field — once per valid draft
   * while typing, plus once at commit if the final (clamped) value differs
   * (BC-01.3). Wire this to the property's normal, history-pushing setter:
   * the field wraps the edit in a merging transaction, so the whole edit is
   * still one history entry, matching every other Inspector numeric field.
   * Never called for the slider itself — the slider's own commit is
   * commitTransaction(), triggered internally by its native `change`.
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

  // The exact-value box shares the numeric Inspector edit session
  // (BC-01.3): valid in-range drafts apply live through onCommit inside a
  // merging transaction (one undo entry per edit), out-of-range drafts
  // clamp only at commit, Escape restores. It carries forward the BC-01.2
  // fix for Enter/Escape's own blur committing a second time.
  const numberInputRef = useRef<HTMLInputElement>(null);
  const numericSession = useInspectorEditSession<number | null>({
    inputRef: numberInputRef,
    value,
    format: (current) => (current === null ? "" : String(current)),
    parseLive: (draft) => {
      const parsed = parseFiniteNumber(draft);
      return parsed !== null && parsed >= min && parsed <= max ? { value: parsed } : null;
    },
    parseFinal: (draft) => {
      const parsed = parseFiniteNumber(draft);
      return parsed === null ? null : { value: Math.min(max, Math.max(min, parsed)) };
    },
    onCommit: (next) => {
      if (next !== null) onCommit(next);
    },
    live: true,
  });

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

  function handleNumericKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      numericSession.commitAndRelease(event.currentTarget);
    } else if (event.key === "Escape") {
      event.preventDefault();
      numericSession.cancelAndRelease(event.currentTarget);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <label htmlFor={sliderId} className="text-fg-secondary">
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
          className={cn("h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-line accent-accent disabled:cursor-not-allowed disabled:opacity-50")}
        />
        <input
          ref={numberInputRef}
          id={numberId}
          type="number"
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          aria-label={`${label} (exact value)`}
          value={numericSession.draft}
          placeholder={isMixed ? "Mixed" : undefined}
          onChange={numericSession.handleChange}
          onBlur={numericSession.handleBlur}
          onKeyDown={handleNumericKeyDown}
          className={cn(inspectorFieldClassName, "w-14 shrink-0 px-2 text-right")}
        />
        {unit && <span className="w-5 shrink-0 text-xs text-fg-secondary">{unit}</span>}
      </div>
    </div>
  );
}

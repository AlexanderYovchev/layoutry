"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { InspectorResetButton } from "@/features/inspector/components/InspectorResetButton";
import { cn } from "@/lib/utils";
import { inspectorFieldClassName } from "@/features/inspector/components/inspectorFieldClassName";

interface InspectorColorFieldShellProps {
  /** A CSS color string (any valid syntax), or null when unset. */
  value: string | null;
  /**
   * Makes the text field editable (Checkpoint 4.2's "hexadecimal text
   * entry, rgb()/rgba() parsing") — commits the typed text verbatim on
   * blur/Enter, Escape reverts. Its mere presence also turns the circular
   * swatch into a real visual color-picker trigger (Checkpoint 4.3.0.1) —
   * there is no separate "picker enabled" flag; typing and visually
   * picking always share one commit path. This component never validates
   * the text itself (that's the caller's domain concern — see
   * isValidCssColor/editor/utils/cssColor.ts); it only reflects an
   * externally-passed `error` as a visual invalid state. Omitted, the
   * field stays the original Checkpoint 4.1 read-only preview shell (no
   * picker either — there would be nowhere to send a picked value).
   */
  onCommit?: (value: string) => void;
  onReset?: () => void;
  disabled?: boolean;
  /** Accessible name, e.g. "Text color". Also used to derive the picker trigger's own accessible name ("Choose text color"). */
  label: string;
  /** Presence marks the field visually invalid (red border, aria-invalid) — the caller renders the actual message (e.g. via the wrapping InspectorPropertyRow's own `error`), so it isn't duplicated here. */
  error?: string;
}

// A native <input type="color"> only ever accepts a 6-digit, alpha-free
// hex string — never rgb()/hsl()/keywords/alpha-hex. These two patterns
// are the only currently-committed CSS color forms that map to one
// directly and losslessly (short hex is expanded to its 6-digit form;
// everything else — rgba(), hsl(), transparent, currentColor, 4/8-digit
// alpha hex — has no lossless opaque-RGB equivalent and is deliberately
// left non-representable rather than guessed at).
const SHORT_HEX = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i;
const FULL_OPAQUE_HEX = /^#[0-9a-f]{6}$/i;

/** Returns the lowercase 6-digit hex the native color input can directly represent, or null if `value` has no lossless opaque-RGB equivalent. */
function toNativeColorInputValue(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  const shortMatch = trimmed.match(SHORT_HEX);
  if (shortMatch) {
    const [, r, g, b] = shortMatch;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return FULL_OPAQUE_HEX.test(trimmed) ? trimmed.toLowerCase() : null;
}

/** Shown in the native picker only while the committed value has no representable equivalent (e.g. "transparent", an rgba(), an alpha hex) — never written back as a guess; see the "picker to text"/"text to picker" sync rules this checkpoint's report documents. */
const FALLBACK_PICKER_VALUE = "#000000";

/**
 * The reusable color field shell (Checkpoint 4.1, made editable in 4.2,
 * given a real visual picker in Checkpoint 4.3.0.1) — swatch, editable
 * value text, unset state, a checkerboard alpha hint, and a reset action.
 *
 * The swatch is a real native <input type="color"> layered invisibly over
 * the decorative circular preview (Checkpoint 4.3.0.1's own explicitly
 * anticipated "invisible overlay" pattern) rather than a plain button that
 * calls back out to open some picker of the caller's choosing — no
 * project popover primitive fit ("do not introduce an oversized floating
 * palette if the native browser picker is sufficient"), and no dependency
 * was installed for one. This means opening the picker is never simulated
 * from JS (no `.click()` forwarding): the user's real click or Enter/Space
 * on the native input is what the browser responds to, so native
 * keyboard/focus/screen-reader behavior for a color input is preserved
 * exactly. A picked color always commits through the exact same `onCommit`
 * the text field uses (a picked value is always a valid 6-digit hex, so it
 * always passes the caller's own color validation) — there is no separate
 * "picker value" callback, and no change was needed in either Typography
 * or Background's Inspector sections to pick this up.
 *
 * Deliberately listens for the native `change` event via a ref, not
 * React's `onChange` — React's onChange fires on every native `input`
 * event, which some browsers dispatch continuously while the user is
 * still dragging inside the native color dialog. Committing on every one
 * of those would flood undo history with one entry per drag frame; the
 * native `change` event fires exactly once, when the user finalizes a
 * color, which is the one commit this component ever makes per pick.
 *
 * The native input is deliberately *uncontrolled* (no `value` prop) —
 * its value is synced imperatively via a ref effect instead. A
 * React-controlled `value` here (even with a no-op `onChange`) fights
 * the browser: any unrelated re-render while the native color dialog is
 * still open (this app re-renders on every Zustand store change, which
 * happens often) forces the DOM value back to its last-rendered prop,
 * discarding whatever the user is still mid-picking — the classic
 * "controlled range/color input" footgun. Reading the imperatively-synced
 * DOM value from the `change` listener avoids this entirely.
 */
export function InspectorColorFieldShell({
  value,
  onCommit,
  onReset,
  disabled = false,
  label,
  error,
}: InspectorColorFieldShellProps) {
  const hasValue = value !== null;
  const isEditable = onCommit !== undefined;

  const [draft, setDraft] = useState(value ?? "");
  // Adjusts the draft when the external value changes (Undo/Redo, another
  // control affecting the same node, or a color picked visually — see
  // this component's own doc comment) — same reset-during-render pattern
  // every other draft/commit Inspector control uses.
  const [lastSyncedValue, setLastSyncedValue] = useState(value);
  if (value !== lastSyncedValue) {
    setLastSyncedValue(value);
    setDraft(value ?? "");
  }

  const colorInputRef = useRef<HTMLInputElement>(null);
  const representableHex = toNativeColorInputValue(value);
  const nativePickerValue = representableHex ?? FALLBACK_PICKER_VALUE;

  // Imperative sync (see this component's doc comment on why the input
  // is uncontrolled) — only ever pushes a value *into* the input from
  // outside (Undo/Redo, another control, a fresh selection); the input's
  // own live interaction is never overwritten by this, since it only
  // reruns when `nativePickerValue` itself changes, not on every render.
  useEffect(() => {
    const input = colorInputRef.current;
    if (input && input.value !== nativePickerValue) input.value = nativePickerValue;
  }, [nativePickerValue]);

  useEffect(() => {
    const input = colorInputRef.current;
    const commitFn = onCommit;
    if (!input || !commitFn) return;

    const handleNativeChange = (event: Event) => {
      const picked = (event.target as HTMLInputElement).value;
      commitFn(picked);
    };

    input.addEventListener("change", handleNativeChange);
    return () => input.removeEventListener("change", handleNativeChange);
  }, [onCommit]);

  function commit() {
    if (!onCommit) return;
    const trimmed = draft.trim();
    if (trimmed === "") {
      setDraft(value ?? "");
      return;
    }
    onCommit(trimmed);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      commit();
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setDraft(value ?? "");
      event.currentTarget.blur();
    }
  }

  const pickerLabel = `Choose ${label.toLowerCase()}`;

  return (
    <div className="flex items-center gap-1">
      <span className="relative inline-flex size-6 shrink-0">
        {isEditable ? (
          <>
            <input
              ref={colorInputRef}
              type="color"
              aria-label={pickerLabel}
              title={pickerLabel}
              disabled={disabled}
              defaultValue={nativePickerValue}
              className="peer absolute inset-0 size-full cursor-pointer rounded-full opacity-0 disabled:cursor-not-allowed"
            />
            <span
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute inset-0 overflow-hidden rounded-full border border-line shadow-panel transition-colors duration-150 peer-hover:border-line-strong peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-accent peer-disabled:opacity-50",
                !hasValue && "border-dashed",
              )}
            >
              {hasValue && (
                <>
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 bg-[linear-gradient(45deg,#d4d4d8_25%,transparent_25%),linear-gradient(-45deg,#d4d4d8_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#d4d4d8_75%),linear-gradient(-45deg,transparent_75%,#d4d4d8_75%)] bg-[length:6px_6px] bg-[position:0_0,0_3px,3px_-3px,-3px_0]"
                  />
                  <span aria-hidden="true" className="absolute inset-0" style={{ backgroundColor: value }} />
                </>
              )}
            </span>
          </>
        ) : (
          <button
            type="button"
            disabled
            aria-label={`${label} preview${hasValue ? `: ${value}` : ": unset"}`}
            className={cn(
              "relative size-6 shrink-0 overflow-hidden rounded-full border border-line shadow-panel disabled:pointer-events-none",
              !hasValue && "border-dashed",
            )}
          >
            {hasValue && (
              <>
                <span
                  aria-hidden="true"
                  className="absolute inset-0 bg-[linear-gradient(45deg,#d4d4d8_25%,transparent_25%),linear-gradient(-45deg,#d4d4d8_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#d4d4d8_75%),linear-gradient(-45deg,transparent_75%,#d4d4d8_75%)] bg-[length:6px_6px] bg-[position:0_0,0_3px,3px_-3px,-3px_0]"
                />
                <span aria-hidden="true" className="absolute inset-0" style={{ backgroundColor: value }} />
              </>
            )}
          </button>
        )}
      </span>
      <input
        type="text"
        readOnly={!isEditable}
        aria-label={label}
        aria-invalid={error ? true : undefined}
        value={isEditable ? draft : (value ?? "")}
        onChange={isEditable ? (event) => setDraft(event.target.value) : undefined}
        onBlur={isEditable ? commit : undefined}
        onKeyDown={isEditable ? handleKeyDown : undefined}
        placeholder="Unset"
        disabled={disabled}
        className={cn(
          inspectorFieldClassName,
          "min-w-20 flex-1 px-2 font-mono text-[11px]",
          // The error border must come after the shared field classes so
          // tailwind-merge keeps it over the default border-line.
          error && "border-red-400 dark:border-red-600",
          !isEditable && "hover:border-line",
        )}
      />
      {onReset && <InspectorResetButton onReset={onReset} disabled={!hasValue} label={`Reset ${label.toLowerCase()}`} />}
    </div>
  );
}

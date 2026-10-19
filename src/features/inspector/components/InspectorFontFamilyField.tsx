"use client";

import { useId, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { FONT_FAMILY_OPTIONS, findFontFamilyOption, type FontFamilyOption } from "@/features/inspector/utils/fontFamilyCatalog";
import { useRecentFontsStore } from "@/features/inspector/stores/useRecentFontsStore";
import { inspectorFieldClassName } from "@/features/inspector/components/inspectorFieldClassName";

interface InspectorFontFamilyFieldProps {
  ariaLabel: string;
  /** The committed CSS font-family value, or undefined when unset. */
  value: string | undefined;
  onCommit: (value: string) => void;
  disabled?: boolean;
}

const CATEGORY_LABELS: Record<FontFamilyOption["category"], string> = {
  system: "System",
  generic: "Generic",
  "web-safe": "Web-safe",
};

function displayLabel(value: string | undefined): string {
  if (!value) return "";
  return findFontFamilyOption(value)?.label ?? value;
}

/**
 * A searchable Font Family combobox (Checkpoint 4.2) — the trigger doubles
 * as the search input: focusing it opens the dropdown and clears the field
 * to a live search query, blurring or Escape closes it and restores the
 * committed value's display label. Selecting an option (click, or Enter on
 * the highlighted one) is the only way to commit — free-text entry isn't
 * committable today, keeping this component's interaction model simple;
 * the document model itself already accepts any string (see
 * TypographySettings.fontFamily), so a future Google Fonts search only
 * needs to append real entries to FONT_FAMILY_OPTIONS, not change this
 * component. Selecting an option also records it via useRecentFontsStore,
 * which surfaces it under "Recently used" the next time the dropdown opens
 * with an empty query.
 */
export function InspectorFontFamilyField({ ariaLabel, value, onCommit, disabled = false }: InspectorFontFamilyFieldProps) {
  const inputId = useId();
  const listboxId = useId();
  const recentFonts = useRecentFontsStore((state) => state.recentFonts);
  const addRecentFont = useRecentFontsStore((state) => state.addRecentFont);

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const trimmedQuery = query.trim().toLowerCase();
  const recentOptions: FontFamilyOption[] =
    trimmedQuery !== ""
      ? []
      : recentFonts
          .filter((fontValue) => fontValue !== value)
          .map((fontValue) => findFontFamilyOption(fontValue) ?? { label: fontValue, value: fontValue, category: "web-safe" });
  // Excludes any catalog entry already shown under "Recently used" — a
  // font that's both recent and in the catalog should appear once, in its
  // quick-access slot, not duplicated in its category too.
  const filteredCatalog = FONT_FAMILY_OPTIONS.filter(
    (option) =>
      option.label.toLowerCase().includes(trimmedQuery) &&
      !recentOptions.some((recent) => recent.value === option.value),
  );
  const flatOptions = [...recentOptions, ...filteredCatalog];

  function commit(option: FontFamilyOption) {
    onCommit(option.value);
    addRecentFont(option.value);
    setIsOpen(false);
    setQuery("");
  }

  function openDropdown() {
    setIsOpen(true);
    setQuery("");
    setHighlightedIndex(0);
  }

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (containerRef.current && event.relatedTarget && containerRef.current.contains(event.relatedTarget as Node)) {
      return;
    }
    setIsOpen(false);
    setQuery("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!isOpen) {
        openDropdown();
        return;
      }
      setHighlightedIndex((index) => Math.min(index + 1, flatOptions.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = flatOptions[highlightedIndex];
      if (option) commit(option);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
      setQuery("");
      event.currentTarget.blur();
    }
  }

  let flatIndex = 0;

  return (
    <div ref={containerRef} className="relative w-full" onBlur={handleBlur}>
      <input
        id={inputId}
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={isOpen && flatOptions[highlightedIndex] ? `${listboxId}-option-${highlightedIndex}` : undefined}
        autoComplete="off"
        disabled={disabled}
        value={isOpen ? query : displayLabel(value)}
        placeholder="Default"
        onFocus={openDropdown}
        onChange={(event) => {
          setQuery(event.target.value);
          setHighlightedIndex(0);
        }}
        onKeyDown={handleKeyDown}
        style={!isOpen && value ? { fontFamily: value } : undefined}
        className={cn(inspectorFieldClassName, "w-full min-w-0 px-2")}
      />
      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          className="absolute z-50 mt-1 max-h-56 w-56 overflow-y-auto rounded-md border border-zinc-200 bg-white py-1 shadow-md dark:border-zinc-800 dark:bg-zinc-950"
        >
          {flatOptions.length === 0 && <p className="px-2 py-1 text-xs text-zinc-400 dark:text-zinc-500">No matching fonts</p>}
          {recentOptions.length > 0 && (
            <p className="px-2 pt-1 pb-0.5 text-[11px] font-semibold tracking-wide text-zinc-400 uppercase dark:text-zinc-500">
              Recently used
            </p>
          )}
          {recentOptions.map((option) => renderOption(option, flatIndex++))}
          {(["system", "generic", "web-safe"] as const).map((category) => {
            const options = filteredCatalog.filter((option) => option.category === category);
            if (options.length === 0) return null;
            return (
              <div key={category}>
                <p className="px-2 pt-1.5 pb-0.5 text-[11px] font-semibold tracking-wide text-zinc-400 uppercase dark:text-zinc-500">
                  {CATEGORY_LABELS[category]}
                </p>
                {options.map((option) => renderOption(option, flatIndex++))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  function renderOption(option: FontFamilyOption, index: number) {
    const isHighlighted = index === highlightedIndex;
    return (
      <button
        key={`${option.category}-${option.value}`}
        id={`${listboxId}-option-${index}`}
        type="button"
        role="option"
        aria-selected={option.value === value}
        onClick={() => commit(option)}
        onMouseEnter={() => setHighlightedIndex(index)}
        style={{ fontFamily: option.value }}
        className={cn(
          "block w-full truncate px-2 py-1 text-left text-xs",
          isHighlighted ? "bg-zinc-100 dark:bg-zinc-900" : "text-zinc-600 dark:text-zinc-300",
        )}
      >
        {option.label}
      </button>
    );
  }
}

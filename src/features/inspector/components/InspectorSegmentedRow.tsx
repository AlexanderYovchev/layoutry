"use client";

import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

interface InspectorSegmentedRowProps {
  label: string;
  options: string[];
  activeOption: string;
  /** Makes each option a real clickable control instead of a plain display span (Checkpoint 3.4.4) — omitted for the CSS Inspector's still-static demo scaffold in InspectorContent.tsx, which stays purely presentational. */
  onSelect?: (option: string) => void;
  disabled?: boolean;
  /** Per-option tooltip text — mainly for a future icon-only variant, where the label alone wouldn't be visible. */
  optionTooltips?: Record<string, string>;
}

export function InspectorSegmentedRow({
  label,
  options,
  activeOption,
  onSelect,
  disabled = false,
  optionTooltips,
}: InspectorSegmentedRowProps) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const delta = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (index + delta + options.length) % options.length;
    buttonRefs.current[nextIndex]?.focus();
  }

  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
      <div role={onSelect ? "group" : undefined} aria-label={onSelect ? label : undefined} className="flex overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800">
        {options.map((option, index) => {
          const className = cn(
            "px-2 py-1",
            option === activeOption
              ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
              : "text-zinc-500 dark:text-zinc-400",
          );

          if (!onSelect) {
            return (
              <span key={option} className={className} title={optionTooltips?.[option]}>
                {option}
              </span>
            );
          }

          return (
            <button
              key={option}
              ref={(el) => {
                buttonRefs.current[index] = el;
              }}
              type="button"
              disabled={disabled}
              title={optionTooltips?.[option]}
              className={cn(
                className,
                "hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 disabled:pointer-events-none disabled:opacity-40 dark:hover:bg-zinc-800/50",
              )}
              aria-pressed={option === activeOption}
              onClick={() => onSelect(option)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

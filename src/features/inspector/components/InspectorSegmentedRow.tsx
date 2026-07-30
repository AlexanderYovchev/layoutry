"use client";

import { HelpCircle } from "lucide-react";
import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/Tooltip";

interface InspectorSegmentedRowProps {
  label: string;
  options: string[];
  activeOption: string;
  /** Makes each option a real clickable control instead of a plain display span (Checkpoint 3.4.4) — omitted for the CSS Inspector's still-static demo scaffold in InspectorContent.tsx, which stays purely presentational. */
  onSelect?: (option: string) => void;
  disabled?: boolean;
  /** Per-option tooltip text — mainly for a future icon-only variant, where the label alone wouldn't be visible. */
  optionTooltips?: Record<string, string>;
  /** Short plain-language guidance shown via a small help icon next to the label — same affordance as InspectorPropertyRow's help, for a segmented control used outside a property row. */
  help?: string;
}

export function InspectorSegmentedRow({
  label,
  options,
  activeOption,
  onSelect,
  disabled = false,
  optionTooltips,
  help,
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
    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs">
      {help ? (
        // Only introduces the extra wrapper when help is actually present —
        // several existing tests locate a segmented row's button group via
        // `getByText(label).closest("div")`, which depends on the label
        // being a direct child of the outer row when there's no help icon
        // to lay out alongside it.
        <div className="flex min-w-0 items-center gap-1 text-zinc-500 dark:text-zinc-400">
          <span className="truncate">{label}</span>
          <Tooltip label={help}>
            <button type="button" aria-label={help} className="text-zinc-400 dark:text-zinc-500">
              <HelpCircle aria-hidden="true" className="size-3" />
            </button>
          </Tooltip>
        </div>
      ) : (
        <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
      )}
      {/*
       * Individually-chipped options (each its own rounded-md, bordered only
       * when active) rather than one continuous bordered pill — an option
       * set with several longer words (e.g. Justify content's "Space
       * between"/"Space around"/"Space evenly") can exceed the Inspector's
       * width, and only individually-rounded chips can wrap onto a second
       * line cleanly; a single pill with internal dividers has no correct
       * rounded-corner treatment once it wraps. flex-wrap here (and on the
       * row above) is what actually prevents the overflow/clipping this
       * would otherwise cause.
       */}
      <div
        role={onSelect ? "group" : undefined}
        aria-label={onSelect ? label : undefined}
        className="flex flex-wrap justify-end gap-1"
      >
        {options.map((option, index) => {
          const isActive = option === activeOption;
          const className = cn(
            "flex h-6 items-center justify-center rounded-md border px-2",
            isActive
              ? "border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
              : "border-transparent text-zinc-500 dark:text-zinc-400",
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
                "transition-colors duration-150 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 disabled:pointer-events-none disabled:opacity-40 dark:hover:bg-zinc-800/50",
              )}
              aria-pressed={isActive}
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

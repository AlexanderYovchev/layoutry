"use client";

import { HelpCircle } from "lucide-react";
import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/Tooltip";
import { InspectorPropertyStateDot } from "@/features/inspector/components/InspectorPropertyStateDot";
import type { PropertyState } from "@/features/inspector/types/propertyState";

interface InspectorSegmentedRowProps {
  label: string;
  options: string[];
  activeOption: string;
  /** Makes each option a real clickable control instead of a plain display span (Checkpoint 3.4.4) — omitted for the CSS Inspector's still-static demo scaffold in InspectorContent.tsx, which stays purely presentational. */
  onSelect?: (option: string) => void;
  disabled?: boolean;
  /** Per-option tooltip text — mainly for a future icon-only variant, where the label alone wouldn't be visible. */
  optionTooltips?: Record<string, string>;
  /**
   * Renders the given icon in place of the option's visible text (the text
   * still contributes the option's accessible name via sr-only content,
   * and via `title` for a native mouse tooltip) — for a compact row like
   * Text Alignment where icons read faster than words. An option with no
   * entry here still renders as plain text, so a segmented row can mix
   * icon and text options if a future property needs to.
   */
  optionIcons?: Record<string, ReactNode>;
  /** Short plain-language guidance shown via a small help icon next to the label — same affordance as InspectorPropertyRow's help, for a segmented control used outside a property row. */
  help?: string;
  /** Property-state dot next to the label (Checkpoint 4.2) — for a segmented property (e.g. Font Weight) that isn't wrapped in InspectorPropertyRow. */
  state?: PropertyState;
  /** Reset affordance rendered after the option group — typically an InspectorResetButton. */
  reset?: ReactNode;
}

export function InspectorSegmentedRow({
  label,
  options,
  activeOption,
  onSelect,
  disabled = false,
  optionTooltips,
  optionIcons,
  help,
  state,
  reset,
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
      {help || state ? (
        // Only introduces the extra wrapper when help/state is actually
        // present — several existing tests locate a segmented row's button
        // group via `getByText(label).closest("div")`, which depends on the
        // label being a direct child of the outer row otherwise.
        <div className="flex min-w-0 items-center gap-1 text-fg-secondary">
          <span className="truncate">{label}</span>
          {state && <InspectorPropertyStateDot state={state} />}
          {help && (
            <Tooltip label={help}>
              <button type="button" aria-label={help} className="rounded-full text-fg-muted transition-colors duration-150 hover:text-fg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
                <HelpCircle aria-hidden="true" className="size-3" />
              </button>
            </Tooltip>
          )}
        </div>
      ) : (
        <span className="text-fg-secondary">{label}</span>
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
        className="flex flex-wrap justify-end gap-0.5 rounded-control border border-line bg-surface-panel-secondary p-0.5"
      >
        {options.map((option, index) => {
          const isActive = option === activeOption;
          const icon = optionIcons?.[option];
          const className = cn(
            "flex h-6 items-center justify-center rounded-control-sm border",
            icon ? "w-6 shrink-0" : "px-2",
            // Active: raised white option with an accent ring. Text stays
            // fg-primary for contrast; only icons take the accent color.
            isActive
              ? "border-accent/40 bg-surface-panel font-medium text-fg-primary shadow-panel [&_svg]:text-accent"
              : "border-transparent text-fg-secondary",
          );
          // The icon is aria-hidden and the option's own text moves to
          // sr-only rather than disappearing — it still contributes the
          // accessible name, and `title` covers the mouse-hover case.
          const content = icon ? (
            <>
              <span aria-hidden="true">{icon}</span>
              <span className="sr-only">{option}</span>
            </>
          ) : (
            option
          );

          if (!onSelect) {
            return (
              <span key={option} className={className} title={optionTooltips?.[option] ?? (icon ? option : undefined)}>
                {content}
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
              title={optionTooltips?.[option] ?? (icon ? option : undefined)}
              className={cn(
                className,
                "transition-[background-color,color,border-color,box-shadow] duration-150 ease-studio focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-40",
                !isActive && "hover:bg-surface-hover hover:text-fg-primary",
              )}
              aria-pressed={isActive}
              onClick={() => onSelect(option)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              {content}
            </button>
          );
        })}
      </div>
      {reset}
    </div>
  );
}

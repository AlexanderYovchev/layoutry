"use client";

import { HelpCircle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/Tooltip";
import { PROPERTY_STATE_DESCRIPTIONS, type PropertyState } from "@/features/inspector/types/propertyState";

interface InspectorPropertyRowProps {
  label: string;
  /** Associates the label with a single control's id (only meaningful when the row wraps exactly one focusable control). */
  labelHtmlFor?: string;
  /** Short plain-language guidance shown via a small help icon — kept optional so the panel never fills permanently with prose. */
  help?: string;
  state?: PropertyState;
  /** Validation message — implies an invalid state and renders beneath the row. */
  error?: string;
  disabled?: boolean;
  /** A secondary control shown next to the main one (e.g. a unit selector, or a link/unlink toggle). */
  secondary?: ReactNode;
  /** The row's reset affordance — typically an InspectorResetButton. */
  reset?: ReactNode;
  /**
   * "row" (default) keeps label and control on one line for simple
   * controls. "stack" lets the control area expand vertically beneath the
   * label — for compound controls (e.g. four independent edge fields)
   * that must not be forced into a single horizontal row.
   */
  variant?: "row" | "stack";
  children: ReactNode;
}

/**
 * The standard label + control(s) layout every future CSS property control
 * should render inside (Checkpoint 4.1). Purely presentational — it never
 * reads or writes the document model itself; callers own all state and
 * commands, this only lays them out consistently and renders the shared
 * state/error/disabled affordances.
 */
export function InspectorPropertyRow({
  label,
  labelHtmlFor,
  help,
  state,
  error,
  disabled = false,
  secondary,
  reset,
  variant = "row",
  children,
}: InspectorPropertyRowProps) {
  const effectiveState = error ? "invalid" : state;

  const labelRow = (
    <div className="flex min-w-0 items-center gap-1 text-zinc-500 dark:text-zinc-400">
      <label htmlFor={labelHtmlFor} className="truncate">
        {label}
      </label>
      {effectiveState && effectiveState !== "unset" && (
        <>
          <span
            aria-hidden="true"
            title={PROPERTY_STATE_DESCRIPTIONS[effectiveState]}
            className={cn("size-1.5 shrink-0 rounded-full", stateDotClassName(effectiveState))}
          />
          <span className="sr-only">{PROPERTY_STATE_DESCRIPTIONS[effectiveState]}</span>
        </>
      )}
      {help && (
        <Tooltip label={help}>
          <button type="button" aria-label={help} className="text-zinc-400 dark:text-zinc-500">
            <HelpCircle aria-hidden="true" className="size-3" />
          </button>
        </Tooltip>
      )}
    </div>
  );

  return (
    <div className={cn("flex flex-col gap-1", disabled && "opacity-50")}>
      {variant === "row" ? (
        <div className="flex items-center justify-between gap-2 text-xs">
          {labelRow}
          <div className="flex items-center gap-1">
            {children}
            {secondary}
            {reset}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 text-xs">
          {/* The label shares its row with secondary/reset (e.g. Link toggle) — the control area below is free to stack full-width without squeezing them off the panel's edge. */}
          <div className="flex items-center justify-between gap-2">
            {labelRow}
            <div className="flex shrink-0 items-center gap-1">
              {secondary}
              {reset}
            </div>
          </div>
          {children}
        </div>
      )}
      {error && (
        <p role="alert" className="text-[11px] text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

function stateDotClassName(state: PropertyState): string {
  switch (state) {
    case "set":
      return "bg-blue-500";
    case "invalid":
      return "bg-red-500";
    case "mixed":
      return "bg-amber-500";
    case "inherited":
      return "bg-zinc-400 dark:bg-zinc-500";
    case "not-applicable":
    case "overridden":
      return "bg-zinc-300 dark:bg-zinc-700";
    case "unset":
    default:
      return "hidden";
  }
}

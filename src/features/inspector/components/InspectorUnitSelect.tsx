"use client";

import { cn } from "@/lib/utils";
import type { CssUnit } from "@/features/editor/types/typography";

export type { CssUnit };

interface InspectorUnitSelectProps {
  unit: CssUnit;
  /** The units that make sense for the specific property this is attached to — never a single hardcoded list shared by every control. */
  allowedUnits: readonly CssUnit[];
  onChange: (unit: CssUnit) => void;
  disabled?: boolean;
  /** Accessible name, e.g. "Width unit". */
  label: string;
}

/** "unitless" is a real, selectable unit (e.g. line-height: 1.5 has no CSS suffix) but reads poorly as literal option text — shown as an em dash instead. Every other unit displays as its own literal CSS suffix. */
function unitDisplayLabel(unit: CssUnit): string {
  return unit === "unitless" ? "—" : unit;
}

/**
 * A property-scoped unit selector (Checkpoint 4.1). Changing the unit
 * never converts the underlying number — see InspectorNumericValueControl,
 * which the caller wires this to — because no property currently has a
 * real cross-unit conversion implemented; this is deliberately an honest
 * "unit changed" action, not a silent (and often wrong) recalculation.
 * Renders as plain text when only one unit is allowed, rather than a
 * single-option dropdown with nothing to choose.
 */
export function InspectorUnitSelect({ unit, allowedUnits, onChange, disabled = false, label }: InspectorUnitSelectProps) {
  if (allowedUnits.length <= 1) {
    return (
      <span className="flex h-6 w-9 shrink-0 items-center justify-end text-[11px] text-zinc-400 dark:text-zinc-500">
        {unitDisplayLabel(allowedUnits[0] ?? unit)}
      </span>
    );
  }

  return (
    <select
      aria-label={label}
      value={unit}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value as CssUnit)}
      className={cn(
        "h-6 w-14 shrink-0 rounded-md border border-zinc-200 bg-zinc-50 px-1 text-right text-[11px] text-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300",
      )}
    >
      {allowedUnits.map((option) => (
        <option key={option} value={option}>
          {unitDisplayLabel(option)}
        </option>
      ))}
    </select>
  );
}

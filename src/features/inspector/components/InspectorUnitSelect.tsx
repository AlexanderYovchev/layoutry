"use client";

import { cn } from "@/lib/utils";
import type { CssUnit } from "@/features/editor/types/typography";
import { inspectorFieldClassName } from "@/features/inspector/components/inspectorFieldClassName";

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
      <span className="flex h-7 w-9 shrink-0 items-center justify-end text-[11px] text-fg-secondary">
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
        inspectorFieldClassName,
        "w-14 shrink-0 px-1 text-right text-[11px]",
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

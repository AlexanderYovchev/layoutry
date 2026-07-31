"use client";

import { useState } from "react";
import { InspectorNumericValueControl, type NumericOrAuto } from "@/features/inspector/components/InspectorNumericValueControl";
import { InspectorPropertyRow } from "@/features/inspector/components/InspectorPropertyRow";
import { InspectorResetButton } from "@/features/inspector/components/InspectorResetButton";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import {
  getFilterSettings,
  isValidBlurValue,
  isValidBrightnessValue,
  isValidContrastValue,
  isValidGrayscaleValue,
  isValidInvertValue,
  isValidOpacityValue,
  isValidSaturateValue,
  isValidSepiaValue,
  normalizeHueRotateValue,
  withFilterField,
  FILTER_BLUR_UNITS,
  type FilterSettings,
} from "@/features/editor/types/filters";
import type { CssUnit } from "@/features/editor/types/typography";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorFiltersSectionProps {
  node: EditorElementNode;
}

type PercentField = "opacity" | "brightness" | "contrast" | "saturate" | "grayscale" | "invert" | "sepia";

interface PercentFieldConfig {
  field: PercentField;
  label: string;
  isValid: (value: number) => boolean;
  errorMessage: string;
}

/**
 * Every plain-percentage filter field, grouped exactly the way the
 * Inspector renders them (Checkpoint 4.7's #4: Transparency, then the
 * Color-adjustment knobs, then Special Effects) — driven by one config
 * array + a single generic commit/reset pair rather than seven near-
 * identical JSX blocks, since InspectorPropertyRow +
 * InspectorNumericValueControl already do all the real work; only the
 * label, validator, and error message differ per field.
 */
const TRANSPARENCY_FIELDS: readonly PercentFieldConfig[] = [
  { field: "opacity", label: "Opacity", isValid: isValidOpacityValue, errorMessage: "Enter a value between 0 and 100." },
];

const COLOR_PERCENT_FIELDS: readonly PercentFieldConfig[] = [
  { field: "brightness", label: "Brightness", isValid: isValidBrightnessValue, errorMessage: "Brightness can't be negative." },
  { field: "contrast", label: "Contrast", isValid: isValidContrastValue, errorMessage: "Contrast can't be negative." },
  { field: "saturate", label: "Saturation", isValid: isValidSaturateValue, errorMessage: "Saturation can't be negative." },
];

const SPECIAL_EFFECTS_FIELDS: readonly PercentFieldConfig[] = [
  { field: "grayscale", label: "Grayscale", isValid: isValidGrayscaleValue, errorMessage: "Enter a value between 0 and 100." },
  { field: "invert", label: "Invert", isValid: isValidInvertValue, errorMessage: "Enter a value between 0 and 100." },
  { field: "sepia", label: "Sepia", isValid: isValidSepiaValue, errorMessage: "Enter a value between 0 and 100." },
];

/**
 * The Visual Effects Foundation section (Checkpoint 4.7) — the first
 * checkpoint to establish CSS filters as a reusable effects system.
 * Every field commits through the same setElementFilters store action
 * (one pushHistory per commit — no continuous-drag field exists here, so
 * unlike Gradient/Box Shadow there is no Live/transaction variant),
 * reads its current value via getFilterSettings (never synthesizes a
 * default, matching Typography/Border/BoxShadow), and resets via
 * withFilterField, which collapses back to a genuinely absent `filters`
 * once every field has been cleared.
 *
 * Grouped into four beginner-friendly sub-sections, in this order:
 * Transparency (Opacity), Color (Brightness/Contrast/Saturation/Hue
 * Rotate — tonal *adjustments*), Blur, and Special Effects (Grayscale/
 * Invert/Sepia — the more dramatic, stylized transforms). Blur sits on
 * its own per the brief's own explicit grouping; Hue Rotate is grouped
 * with Color rather than Special Effects since it's still a tonal
 * *adjustment* (rotating around the existing hue wheel) rather than a
 * stylistic transform.
 */
export function InspectorFiltersSection({ node }: InspectorFiltersSectionProps) {
  const setElementFilters = useEditorStore((state) => state.setElementFilters);
  const filters = getFilterSettings(node);

  const [errors, setErrors] = useState<Partial<Record<PercentField | "blur", string>>>({});

  const [lastNodeId, setLastNodeId] = useState(node.id);
  if (node.id !== lastNodeId) {
    setLastNodeId(node.id);
    setErrors({});
  }

  function setError(field: PercentField | "blur", message: string | undefined) {
    setErrors((previous) => {
      if (message === undefined) {
        if (!(field in previous)) return previous;
        const next = { ...previous };
        delete next[field];
        return next;
      }
      return { ...previous, [field]: message };
    });
  }

  function commitField<K extends keyof FilterSettings>(field: K, value: FilterSettings[K]) {
    setElementFilters(node.id, withFilterField(filters, field, value));
  }

  function resetField(field: PercentField | "blur" | "hueRotate") {
    if (field !== "hueRotate") setError(field, undefined);
    commitField(field, undefined);
  }

  function handlePercentCommit(config: PercentFieldConfig, next: NumericOrAuto) {
    if (typeof next !== "number") return;
    if (!config.isValid(next)) {
      setError(config.field, config.errorMessage);
      return;
    }
    setError(config.field, undefined);
    commitField(config.field, next);
  }

  function handleBlurCommit(next: NumericOrAuto) {
    if (typeof next !== "number") return;
    if (!isValidBlurValue(next)) {
      setError("blur", "Blur can't be negative.");
      return;
    }
    setError("blur", undefined);
    commitField("blur", { value: next, unit: filters.blur?.unit ?? "px" });
  }

  function handleBlurUnitChange(unit: CssUnit) {
    if (!filters.blur) return;
    commitField("blur", { ...filters.blur, unit });
  }

  function handleHueRotateCommit(next: NumericOrAuto) {
    if (typeof next !== "number") return;
    commitField("hueRotate", normalizeHueRotateValue(next));
  }

  function handleResetEffects() {
    setElementFilters(node.id, undefined);
    setErrors({});
  }

  function renderPercentRow(config: PercentFieldConfig) {
    const value = filters[config.field];
    const error = errors[config.field];
    return (
      <InspectorPropertyRow
        key={config.field}
        label={config.label}
        variant="stack"
        state={error ? "invalid" : value !== undefined ? "set" : "unset"}
        error={error}
        reset={
          <InspectorResetButton
            onReset={() => resetField(config.field)}
            disabled={value === undefined}
            label={`Reset ${config.label.toLowerCase()}`}
          />
        }
      >
        <InspectorNumericValueControl
          ariaLabel={config.label}
          value={value ?? 0}
          unit="%"
          allowedUnits={["%"]}
          onCommit={(next) => handlePercentCommit(config, next)}
        />
      </InspectorPropertyRow>
    );
  }

  const hasAnyFilter = Object.keys(filters).length > 0;

  return (
    <InspectorSection
      label="Visual Effects"
      defaultOpen
      actions={<InspectorResetButton onReset={handleResetEffects} disabled={!hasAnyFilter} label="Reset effects" />}
    >
      <div className="flex flex-col gap-1.5 text-xs">
        <span className="text-zinc-500 dark:text-zinc-400">Transparency</span>
        {TRANSPARENCY_FIELDS.map(renderPercentRow)}
      </div>

      <div className="flex flex-col gap-1.5 border-t border-zinc-200 pt-2 text-xs dark:border-zinc-800">
        <span className="text-zinc-500 dark:text-zinc-400">Color</span>
        {COLOR_PERCENT_FIELDS.map(renderPercentRow)}
        <InspectorPropertyRow
          label="Hue Rotate"
          variant="stack"
          help="0° leaves hue unchanged; 360° is a full rotation back to the start."
          state={filters.hueRotate !== undefined ? "set" : "unset"}
          reset={
            <InspectorResetButton
              onReset={() => resetField("hueRotate")}
              disabled={filters.hueRotate === undefined}
              label="Reset hue rotate"
            />
          }
        >
          <InspectorNumericValueControl
            ariaLabel="Hue Rotate"
            value={filters.hueRotate ?? 0}
            unit="deg"
            allowedUnits={["deg"]}
            onCommit={handleHueRotateCommit}
          />
        </InspectorPropertyRow>
      </div>

      <div className="flex flex-col gap-1.5 border-t border-zinc-200 pt-2 text-xs dark:border-zinc-800">
        <span className="text-zinc-500 dark:text-zinc-400">Blur</span>
        <InspectorPropertyRow
          label="Blur"
          variant="stack"
          state={errors.blur ? "invalid" : filters.blur ? "set" : "unset"}
          error={errors.blur}
          reset={<InspectorResetButton onReset={() => resetField("blur")} disabled={!filters.blur} label="Reset blur" />}
        >
          <InspectorNumericValueControl
            ariaLabel="Blur"
            value={filters.blur?.value ?? 0}
            unit={filters.blur?.unit ?? "px"}
            allowedUnits={FILTER_BLUR_UNITS}
            onUnitChange={handleBlurUnitChange}
            onCommit={handleBlurCommit}
          />
        </InspectorPropertyRow>
      </div>

      <div className="flex flex-col gap-1.5 border-t border-zinc-200 pt-2 text-xs dark:border-zinc-800">
        <span className="text-zinc-500 dark:text-zinc-400">Special Effects</span>
        {SPECIAL_EFFECTS_FIELDS.map(renderPercentRow)}
      </div>
    </InspectorSection>
  );
}

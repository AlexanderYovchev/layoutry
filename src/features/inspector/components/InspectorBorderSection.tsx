"use client";

import { useState } from "react";
import { InspectorBorderVisualSideSelector } from "@/features/inspector/components/InspectorBorderVisualSideSelector";
import { InspectorColorFieldShell } from "@/features/inspector/components/InspectorColorFieldShell";
import { InspectorNumericValueControl, type NumericOrAuto } from "@/features/inspector/components/InspectorNumericValueControl";
import { InspectorPropertyRow } from "@/features/inspector/components/InspectorPropertyRow";
import { InspectorResetButton } from "@/features/inspector/components/InspectorResetButton";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { InspectorSegmentedRow } from "@/features/inspector/components/InspectorSegmentedRow";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { isValidCssColor } from "@/features/editor/utils/cssColor";
import {
  applyBorderPreset,
  borderSidesEqual,
  getBorderSettings,
  getBorderSide,
  isValidBorderWidthValue,
  withBorderAllSidesField,
  withBorderSide,
  withBorderSideField,
  BORDER_SIDES,
  BORDER_STYLE_VALUES,
  type BorderPreset,
  type BorderSide,
  type BorderSideSettings,
  type BorderSettings,
  type BorderStyleValue,
} from "@/features/editor/types/border";
import type { CssUnit } from "@/features/editor/types/typography";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorBorderSectionProps {
  node: EditorElementNode;
}

type BorderMode = "unified" | "individual";

const WIDTH_UNITS: readonly CssUnit[] = ["px", "rem", "em"];

const STYLE_OPTIONS = BORDER_STYLE_VALUES.map((style) => style[0].toUpperCase() + style.slice(1));
const STYLE_LABEL_TO_VALUE: Record<string, BorderStyleValue> = Object.fromEntries(
  BORDER_STYLE_VALUES.map((style) => [style[0].toUpperCase() + style.slice(1), style]),
);
const STYLE_VALUE_TO_LABEL: Record<BorderStyleValue, string> = Object.fromEntries(
  BORDER_STYLE_VALUES.map((style) => [style, style[0].toUpperCase() + style.slice(1)]),
) as Record<BorderStyleValue, string>;
/** Matches no real option — same "don't falsely highlight an unset property" convention InspectorTypographySection established. */
const NO_ACTIVE_STYLE = "";

const MODE_OPTIONS = ["All Sides", "Individual Sides"];
const MODE_LABEL_TO_VALUE: Record<string, BorderMode> = { "All Sides": "unified", "Individual Sides": "individual" };
const MODE_VALUE_TO_LABEL: Record<BorderMode, string> = { unified: "All Sides", individual: "Individual Sides" };

const PRESETS: { preset: BorderPreset; label: string }[] = [
  { preset: "none", label: "None" },
  { preset: "thin", label: "Thin" },
  { preset: "medium", label: "Medium" },
  { preset: "thick", label: "Thick" },
  { preset: "outline", label: "Outline" },
];

/**
 * The Border Foundation section (Checkpoint 4.4) — built entirely on the
 * Checkpoint 4.1/4.1.5 shared primitives, same as Typography/Background.
 *
 * Field order deliberately follows the brief's own "Width / Style / Color
 * / Sides / Presets" — Width/Style/Color always act on a single "current
 * target" (either all four sides at once, or whichever one side is
 * selected below) so a beginner can style a border without ever touching
 * the Sides control at all (this checkpoint's explicit "default
 * experience should be editing one border for all sides"); Sides (the
 * All Sides/Individual Sides mode toggle plus the visual selector) and
 * Presets are progressive-disclosure controls further down for anyone who
 * needs them.
 *
 * `mode` and `selectedSide` are both purely local Inspector UI state —
 * never written to the document model, never part of Undo/Redo history —
 * exactly like InspectorGradientSection's selectedStopId. `mode` defaults
 * to whichever the current data already looks like (borderSidesEqual),
 * the same heuristic InspectorSpacingSection's EdgeGroup uses for its own
 * linked/unlinked toggle, and only re-derives on a genuine *selection*
 * change (not on every border update) — switching to Unified after
 * editing sides independently is a deliberate choice that must survive
 * the sides subsequently becoming equal by coincidence.
 */
export function InspectorBorderSection({ node }: InspectorBorderSectionProps) {
  const setElementBorder = useEditorStore((state) => state.setElementBorder);
  const border = getBorderSettings(node);

  const [mode, setMode] = useState<BorderMode>(() => (borderSidesEqual(border) ? "unified" : "individual"));
  const [selectedSide, setSelectedSide] = useState<BorderSide>("top");
  const [widthError, setWidthError] = useState<string | undefined>(undefined);
  const [colorError, setColorError] = useState<string | undefined>(undefined);

  const [lastNodeId, setLastNodeId] = useState(node.id);
  if (node.id !== lastNodeId) {
    setLastNodeId(node.id);
    setMode(borderSidesEqual(border) ? "unified" : "individual");
    setSelectedSide("top");
    setWidthError(undefined);
    setColorError(undefined);
  }

  const target = mode === "unified" ? getBorderSide(border, "top") : getBorderSide(border, selectedSide);
  const configuredSides = new Set(BORDER_SIDES.filter((side) => Object.keys(getBorderSide(border, side)).length > 0));
  const hasAnyBorder = configuredSides.size > 0;

  function commitSideField<K extends keyof BorderSideSettings>(field: K, value: BorderSideSettings[K]) {
    const next: BorderSettings | undefined =
      mode === "unified"
        ? withBorderAllSidesField(border, field, value)
        : withBorderSide(border, selectedSide, withBorderSideField(getBorderSide(border, selectedSide), field, value));
    setElementBorder(node.id, next);
  }

  function handleWidthCommit(next: NumericOrAuto) {
    if (typeof next !== "number") return;
    if (!isValidBorderWidthValue(next)) {
      setWidthError("Border width can't be negative.");
      return;
    }
    setWidthError(undefined);
    commitSideField("width", { value: next, unit: target.width?.unit ?? "px" });
  }

  function handleWidthUnitChange(unit: CssUnit) {
    if (!target.width) return;
    commitSideField("width", { ...target.width, unit });
  }

  function handleStyleSelect(label: string) {
    commitSideField("style", STYLE_LABEL_TO_VALUE[label]);
  }

  function handleColorCommit(text: string) {
    if (!isValidCssColor(text)) {
      setColorError("Enter a hex color (#RRGGBB) or an rgb()/rgba() value.");
      return;
    }
    setColorError(undefined);
    commitSideField("color", text);
  }

  function handleModeSelect(label: string) {
    setMode(MODE_LABEL_TO_VALUE[label]);
  }

  function handlePresetSelect(preset: BorderPreset) {
    setElementBorder(node.id, applyBorderPreset(border, preset));
  }

  return (
    <InspectorSection label="Border" defaultOpen>
      <InspectorPropertyRow
        label="Border width"
        variant="stack"
        state={widthError ? "invalid" : target.width ? "set" : "unset"}
        error={widthError}
        reset={
          <InspectorResetButton
            onReset={() => commitSideField("width", undefined)}
            disabled={!target.width}
            label="Reset border width"
          />
        }
      >
        <InspectorNumericValueControl
          ariaLabel="Border width"
          value={target.width?.value ?? 0}
          unit={target.width?.unit ?? "px"}
          allowedUnits={WIDTH_UNITS}
          onUnitChange={handleWidthUnitChange}
          onCommit={handleWidthCommit}
          onEditCancel={() => setWidthError(undefined)}
        />
      </InspectorPropertyRow>

      <InspectorSegmentedRow
        label="Style"
        state={target.style ? "set" : "unset"}
        options={STYLE_OPTIONS}
        activeOption={target.style ? STYLE_VALUE_TO_LABEL[target.style] : NO_ACTIVE_STYLE}
        onSelect={handleStyleSelect}
        reset={
          <InspectorResetButton
            onReset={() => commitSideField("style", undefined)}
            disabled={!target.style}
            label="Reset border style"
          />
        }
      />

      <InspectorPropertyRow label="Color" state={colorError ? "invalid" : target.color ? "set" : "unset"} error={colorError}>
        <InspectorColorFieldShell
          label="Border color"
          value={target.color ?? null}
          onCommit={handleColorCommit}
          onEditCancel={() => setColorError(undefined)}
          onReset={() => {
            setColorError(undefined);
            commitSideField("color", undefined);
          }}
          error={colorError}
        />
      </InspectorPropertyRow>

      <InspectorSegmentedRow label="Sides" options={MODE_OPTIONS} activeOption={MODE_VALUE_TO_LABEL[mode]} onSelect={handleModeSelect} />

      {mode === "individual" && (
        <InspectorPropertyRow label="Selected side" variant="stack">
          <InspectorBorderVisualSideSelector value={selectedSide} onSelect={setSelectedSide} configuredSides={configuredSides} />
        </InspectorPropertyRow>
      )}

      <div className="flex flex-col gap-1.5 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="text-zinc-500 dark:text-zinc-400">Presets</span>
          <InspectorResetButton
            onReset={() => setElementBorder(node.id, undefined)}
            disabled={!hasAnyBorder}
            label="Reset border"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {PRESETS.map(({ preset, label }) => (
            <button
              key={preset}
              type="button"
              onClick={() => handlePresetSelect(preset)}
              // aria-label disambiguates from the "None"/"Solid"/etc. Style
              // options above, which share some of these same words as
              // their own accessible names — the visible text stays short.
              aria-label={`${label} preset`}
              title={`${label} preset`}
              className="flex h-6 items-center justify-center rounded-md border border-transparent px-2 text-zinc-500 transition-colors duration-150 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 dark:text-zinc-400 dark:hover:bg-zinc-800/50"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </InspectorSection>
  );
}

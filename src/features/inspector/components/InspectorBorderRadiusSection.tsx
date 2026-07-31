"use client";

import { useState } from "react";
import { InspectorBorderRadiusCornerSelector } from "@/features/inspector/components/InspectorBorderRadiusCornerSelector";
import { InspectorNumericValueControl, type NumericOrAuto } from "@/features/inspector/components/InspectorNumericValueControl";
import { InspectorPropertyRow } from "@/features/inspector/components/InspectorPropertyRow";
import { InspectorResetButton } from "@/features/inspector/components/InspectorResetButton";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { InspectorSegmentedRow } from "@/features/inspector/components/InspectorSegmentedRow";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import {
  applyBorderRadiusPreset,
  borderRadiusCornersEqual,
  getBorderRadiusCorner,
  getBorderRadiusSettings,
  isValidBorderRadiusValue,
  withBorderRadiusAllCorners,
  withBorderRadiusCorner,
  BORDER_RADIUS_CORNERS,
  BORDER_RADIUS_UNITS,
  type BorderRadiusCorner,
  type BorderRadiusPreset,
} from "@/features/editor/types/borderRadius";
import type { CssLengthValue, CssUnit } from "@/features/editor/types/typography";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorBorderRadiusSectionProps {
  node: EditorElementNode;
}

type RadiusMode = "unified" | "individual";

const MODE_OPTIONS = ["Unified", "Individual Corners"];
const MODE_LABEL_TO_VALUE: Record<string, RadiusMode> = { Unified: "unified", "Individual Corners": "individual" };
const MODE_VALUE_TO_LABEL: Record<RadiusMode, string> = { unified: "Unified", individual: "Individual Corners" };

const PRESETS: { preset: BorderRadiusPreset; label: string }[] = [
  { preset: "none", label: "None" },
  { preset: "small", label: "Small" },
  { preset: "medium", label: "Medium" },
  { preset: "large", label: "Large" },
  { preset: "pill", label: "Pill" },
  { preset: "circle", label: "Circle" },
];

/**
 * The Border Radius Foundation section (Checkpoint 4.5) — exactly
 * follows InspectorBorderSection's own architecture (Checkpoint 4.4):
 * "Radius" always acts on a single current target (all four corners at
 * once by default, or whichever one corner is selected below), "Corners"
 * (the Unified/Individual mode toggle plus the visual corner selector)
 * and "Presets" are progressive-disclosure controls beneath it. `mode`
 * and `selectedCorner` are purely local Inspector UI state — never
 * written to the document model, never part of Undo/Redo — derived
 * fresh per selection via `borderRadiusCornersEqual`, the exact corner
 * counterpart of border.ts's borderSidesEqual.
 */
export function InspectorBorderRadiusSection({ node }: InspectorBorderRadiusSectionProps) {
  const setElementBorderRadius = useEditorStore((state) => state.setElementBorderRadius);
  const radius = getBorderRadiusSettings(node);

  const [mode, setMode] = useState<RadiusMode>(() => (borderRadiusCornersEqual(radius) ? "unified" : "individual"));
  const [selectedCorner, setSelectedCorner] = useState<BorderRadiusCorner>("topLeft");
  const [radiusError, setRadiusError] = useState<string | undefined>(undefined);

  const [lastNodeId, setLastNodeId] = useState(node.id);
  if (node.id !== lastNodeId) {
    setLastNodeId(node.id);
    setMode(borderRadiusCornersEqual(radius) ? "unified" : "individual");
    setSelectedCorner("topLeft");
    setRadiusError(undefined);
  }

  const targetValue = mode === "unified" ? getBorderRadiusCorner(radius, "topLeft") : getBorderRadiusCorner(radius, selectedCorner);
  const configuredCorners = new Set(BORDER_RADIUS_CORNERS.filter((corner) => radius[corner] !== undefined));
  const hasAnyRadius = configuredCorners.size > 0;

  function commitCornerValue(value: CssLengthValue | undefined) {
    const next = mode === "unified" ? withBorderRadiusAllCorners(value) : withBorderRadiusCorner(radius, selectedCorner, value);
    setElementBorderRadius(node.id, next);
  }

  function handleRadiusCommit(next: NumericOrAuto) {
    if (typeof next !== "number") return;
    if (!isValidBorderRadiusValue(next)) {
      setRadiusError("Border radius can't be negative.");
      return;
    }
    setRadiusError(undefined);
    commitCornerValue({ value: next, unit: targetValue?.unit ?? "px" });
  }

  function handleUnitChange(unit: CssUnit) {
    if (!targetValue) return;
    commitCornerValue({ ...targetValue, unit });
  }

  function handleModeSelect(label: string) {
    setMode(MODE_LABEL_TO_VALUE[label]);
  }

  function handlePresetSelect(preset: BorderRadiusPreset) {
    setElementBorderRadius(node.id, applyBorderRadiusPreset(preset));
  }

  return (
    <InspectorSection label="Border Radius" defaultOpen>
      <InspectorPropertyRow
        label="Radius"
        variant="stack"
        state={radiusError ? "invalid" : targetValue ? "set" : "unset"}
        error={radiusError}
        reset={
          <InspectorResetButton
            onReset={() => commitCornerValue(undefined)}
            disabled={!targetValue}
            label="Reset radius"
          />
        }
      >
        <InspectorNumericValueControl
          ariaLabel="Border radius"
          value={targetValue?.value ?? 0}
          unit={targetValue?.unit ?? "px"}
          allowedUnits={BORDER_RADIUS_UNITS}
          onUnitChange={handleUnitChange}
          onCommit={handleRadiusCommit}
        />
      </InspectorPropertyRow>

      <InspectorSegmentedRow label="Corners" options={MODE_OPTIONS} activeOption={MODE_VALUE_TO_LABEL[mode]} onSelect={handleModeSelect} />

      {mode === "individual" && (
        <InspectorPropertyRow label="Selected corner" variant="stack">
          <InspectorBorderRadiusCornerSelector value={selectedCorner} onSelect={setSelectedCorner} configuredCorners={configuredCorners} />
        </InspectorPropertyRow>
      )}

      <div className="flex flex-col gap-1.5 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="text-zinc-500 dark:text-zinc-400">Presets</span>
          <InspectorResetButton
            onReset={() => setElementBorderRadius(node.id, undefined)}
            disabled={!hasAnyRadius}
            label="Reset border radius"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {PRESETS.map(({ preset, label }) => (
            <button
              key={preset}
              type="button"
              onClick={() => handlePresetSelect(preset)}
              // "radius preset" disambiguates both from the Corners mode
              // options above and from Border's own "<label> preset"
              // buttons (Checkpoint 4.4), which share several of the
              // same words ("None", "Thin"/"Small", ...) as their own
              // accessible names — the visible text stays short.
              aria-label={`${label} radius preset`}
              title={`${label} radius preset`}
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

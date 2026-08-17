"use client";

import { InspectorNumericValueControl } from "@/features/inspector/components/InspectorNumericValueControl";
import { InspectorObjectPositionGrid } from "@/features/inspector/components/InspectorObjectPositionGrid";
import { InspectorPropertyRow } from "@/features/inspector/components/InspectorPropertyRow";
import { InspectorResetButton } from "@/features/inspector/components/InspectorResetButton";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { InspectorSegmentedRow } from "@/features/inspector/components/InspectorSegmentedRow";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import {
  DEFAULT_OBJECT_FIT,
  DEFAULT_OBJECT_POSITION_AXIS,
  OBJECT_FIT_PRESETS,
  clearMediaFitPosition,
  detectObjectPositionPreset,
  getMediaFitSettings,
  isValidObjectFitValue,
  isValidObjectPositionAxis,
  withMediaFitField,
  withMediaFitPosition,
  type ObjectFitValue,
} from "@/features/editor/types/mediaFit";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorMediaSectionProps {
  /** The selected node — rendered only for a media-fit-capable tag (see InspectorNodeSummary, gated on getElementCapabilities().supportsMediaFit — Checkpoint 5.6 split this off from supportsIntrinsicAspectRatio). */
  node: EditorElementNode;
}

const FIT_OPTIONS = OBJECT_FIT_PRESETS.map((preset) => preset.label);
const FIT_LABEL_TO_VALUE: Record<string, ObjectFitValue> = Object.fromEntries(
  OBJECT_FIT_PRESETS.map((preset) => [preset.label, preset.value]),
);
const FIT_VALUE_TO_LABEL: Record<ObjectFitValue, string> = Object.fromEntries(
  OBJECT_FIT_PRESETS.map((preset) => [preset.value, preset.label]),
) as Record<ObjectFitValue, string>;
const FIT_TOOLTIPS = Object.fromEntries(OBJECT_FIT_PRESETS.map((preset) => [preset.label, preset.description]));

/** Object Position axis fields have no min/max clamp — CSS permits values outside 0–100% on purpose (deliberate cropping/overflow), so this control never imposes an artificial visual-builder limit (Checkpoint 5.6). */
const POSITION_AXIS_UNITS = ["%"] as const;

/**
 * Object Fit + Object Position for a media-fit-capable node's own visual
 * content (Checkpoint 3.5.1, upgraded to a production-grade system in
 * Checkpoint 5.6 — see types/mediaFit.ts's own doc comment for the full
 * model evolution). Deliberately just these two controls, not a full
 * media inspector (asset picker, crop, etc. are out of scope).
 *
 * The 3x3 grid and the custom X/Y fields both derive their displayed
 * state directly from the node's own document data on every render —
 * there is no local "mode" state to go stale after Undo/Redo (unlike
 * Checkpoint 5.5's InspectorAspectRatioSection, which needed one because
 * its Custom view could be entered without yet writing a document value;
 * here, X/Y are always-visible plain numeric fields, so there's nothing
 * to desync). This is a deliberate, simpler design than Aspect Ratio's,
 * chosen specifically to avoid that bug class rather than reproduce it.
 */
export function InspectorMediaSection({ node }: InspectorMediaSectionProps) {
  const setMediaFitSettings = useEditorStore((state) => state.setMediaFitSettings);
  const settings = getMediaFitSettings(node);

  const hasFit = settings.objectFit !== undefined && isValidObjectFitValue(settings.objectFit);
  const effectiveFit = hasFit ? settings.objectFit! : DEFAULT_OBJECT_FIT;

  const hasX = settings.objectPositionX !== undefined && isValidObjectPositionAxis(settings.objectPositionX);
  const hasY = settings.objectPositionY !== undefined && isValidObjectPositionAxis(settings.objectPositionY);
  const hasPosition = hasX || hasY;
  const effectiveX = hasX ? settings.objectPositionX!.value : DEFAULT_OBJECT_POSITION_AXIS.value;
  const effectiveY = hasY ? settings.objectPositionY!.value : DEFAULT_OBJECT_POSITION_AXIS.value;

  const activePresetKey = detectObjectPositionPreset(effectiveX, effectiveY);

  function handleFitSelect(label: string) {
    const value = FIT_LABEL_TO_VALUE[label];
    setMediaFitSettings(node.id, withMediaFitField(settings, "objectFit", value));
  }

  function resetFit() {
    setMediaFitSettings(node.id, withMediaFitField(settings, "objectFit", undefined));
  }

  function handlePresetSelect({ x, y }: { x: number; y: number }) {
    setMediaFitSettings(node.id, withMediaFitPosition(settings, { value: x, unit: "%" }, { value: y, unit: "%" }));
  }

  function commitX(next: number | "auto") {
    if (typeof next !== "number") return;
    setMediaFitSettings(node.id, withMediaFitField(settings, "objectPositionX", { value: next, unit: "%" }));
  }

  function commitY(next: number | "auto") {
    if (typeof next !== "number") return;
    setMediaFitSettings(node.id, withMediaFitField(settings, "objectPositionY", { value: next, unit: "%" }));
  }

  function resetPosition() {
    setMediaFitSettings(node.id, clearMediaFitPosition(settings));
  }

  return (
    <InspectorSection label="Media" defaultOpen>
      <InspectorSegmentedRow
        label="Fit"
        help="Controls how the media fills its box: keep its shape, crop to fill, stretch, or stay at its natural size."
        options={FIT_OPTIONS}
        activeOption={FIT_VALUE_TO_LABEL[effectiveFit]}
        onSelect={handleFitSelect}
        optionTooltips={FIT_TOOLTIPS}
        state={hasFit ? "set" : "unset"}
        reset={<InspectorResetButton onReset={resetFit} disabled={!hasFit} label="Reset object fit" />}
      />

      <InspectorObjectPositionGrid
        activeKey={activePresetKey}
        onSelect={handlePresetSelect}
        state={hasPosition ? "set" : "unset"}
        reset={<InspectorResetButton onReset={resetPosition} disabled={!hasPosition} label="Reset object position" />}
      />

      <div className="flex flex-col gap-1.5 pl-2">
        <InspectorPropertyRow label="X" variant="row">
          <InspectorNumericValueControl
            ariaLabel="Object position X"
            value={effectiveX}
            step={1}
            unit="%"
            allowedUnits={POSITION_AXIS_UNITS}
            onCommit={commitX}
          />
        </InspectorPropertyRow>
        <InspectorPropertyRow label="Y" variant="row">
          <InspectorNumericValueControl
            ariaLabel="Object position Y"
            value={effectiveY}
            step={1}
            unit="%"
            allowedUnits={POSITION_AXIS_UNITS}
            onCommit={commitY}
          />
        </InspectorPropertyRow>
      </div>
    </InspectorSection>
  );
}

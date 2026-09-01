"use client";

import { InspectorBulkNumberField } from "@/features/inspector/components/InspectorBulkNumberField";
import { InspectorBulkTextField } from "@/features/inspector/components/InspectorBulkTextField";
import { InspectorPropertyRow } from "@/features/inspector/components/InspectorPropertyRow";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { InspectorSegmentedRow } from "@/features/inspector/components/InspectorSegmentedRow";
import { resolveSharedValue, withSharedFallback, type SharedValue } from "@/features/inspector/types/sharedValue";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { getTypographySettings, isValidCssColor, isValidFontSize, type FontWeight } from "@/features/editor/types/typography";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorBulkTypographySectionProps {
  nodes: readonly EditorElementNode[];
}

const NO_ACTIVE_OPTION = "";

const FONT_WEIGHT_OPTIONS: { value: FontWeight; label: string }[] = [
  { value: 100, label: "Thin" },
  { value: 200, label: "Extra Light" },
  { value: 300, label: "Light" },
  { value: 400, label: "Regular" },
  { value: 500, label: "Medium" },
  { value: 600, label: "Semi Bold" },
  { value: 700, label: "Bold" },
  { value: 800, label: "Extra Bold" },
  { value: 900, label: "Black" },
];
const FONT_WEIGHT_LABELS = FONT_WEIGHT_OPTIONS.map((option) => option.label);
const FONT_WEIGHT_LABEL_TO_VALUE = Object.fromEntries(FONT_WEIGHT_OPTIONS.map((option) => [option.label, option.value])) as Record<string, FontWeight>;
const FONT_WEIGHT_VALUE_TO_LABEL = Object.fromEntries(FONT_WEIGHT_OPTIONS.map((option) => [option.value, option.label])) as Record<FontWeight, string>;

function stateFor(shared: SharedValue<unknown>, error?: string): "invalid" | "mixed" | "set" | "unset" {
  if (error) return "invalid";
  if (shared.kind === "mixed") return "mixed";
  return shared.value !== undefined ? "set" : "unset";
}

/**
 * The multi-selection Typography surface (Checkpoint 1.15.2) — three
 * representative fields (Font Size, Weight, Color), not full field-for-
 * field parity with the single-selection InspectorTypographySection (see
 * this checkpoint's own report, section J, for why a smaller
 * representative surface was chosen for this first bulk-editing
 * foundation). Rendered only once InspectorMultiNodeSummary has already
 * confirmed every selected node supports Typography via
 * intersectElementCapabilities — this component itself does no
 * capability gating of its own.
 */
export function InspectorBulkTypographySection({ nodes }: InspectorBulkTypographySectionProps) {
  const setElementsTypographyField = useEditorStore((state) => state.setElementsTypographyField);
  const ids = nodes.map((node) => node.id);

  const fontSize = resolveSharedValue(nodes, (node) => getTypographySettings(node).fontSize?.value);
  const fontWeight = resolveSharedValue(nodes, (node) => getTypographySettings(node).fontWeight);
  const color = resolveSharedValue(nodes, (node) => getTypographySettings(node).color);

  return (
    <InspectorSection label="Typography">
      <InspectorPropertyRow label="Font size" variant="stack" state={stateFor(fontSize)}>
        <InspectorBulkNumberField
          ariaLabel="Font size"
          shared={withSharedFallback(fontSize, 16)}
          min={1}
          onCommit={(value) => {
            if (!isValidFontSize(value)) return;
            setElementsTypographyField(ids, "fontSize", { value, unit: "px" });
          }}
        />
      </InspectorPropertyRow>

      <InspectorSegmentedRow
        label="Weight"
        state={stateFor(fontWeight)}
        options={FONT_WEIGHT_LABELS}
        activeOption={fontWeight.kind === "same" && fontWeight.value ? FONT_WEIGHT_VALUE_TO_LABEL[fontWeight.value] : NO_ACTIVE_OPTION}
        onSelect={(option) => setElementsTypographyField(ids, "fontWeight", FONT_WEIGHT_LABEL_TO_VALUE[option])}
      />

      <InspectorPropertyRow label="Color" state={stateFor(color)}>
        <InspectorBulkTextField
          ariaLabel="Text color"
          shared={withSharedFallback(color, "")}
          placeholder="#000000"
          onCommit={(value) => {
            if (!isValidCssColor(value)) return;
            setElementsTypographyField(ids, "color", value);
          }}
        />
      </InspectorPropertyRow>
    </InspectorSection>
  );
}

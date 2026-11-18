"use client";

import { InspectorBulkNumberField } from "@/features/inspector/components/InspectorBulkNumberField";
import { InspectorBulkTextField } from "@/features/inspector/components/InspectorBulkTextField";
import { InspectorPropertyRow } from "@/features/inspector/components/InspectorPropertyRow";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { InspectorSegmentedRow } from "@/features/inspector/components/InspectorSegmentedRow";
import { InspectorSharedValueNote } from "@/features/inspector/components/InspectorSharedValueNote";
import { useRenderedStyles } from "@/features/inspector/hooks/useRenderedStyles";
import {
  absoluteAuthoredColor,
  colorFieldValue,
  commonAuthored,
  effectiveRowState,
  effectiveValueOf,
  pxFieldValue,
  resolveSharedEffective,
} from "@/features/inspector/utils/effectiveCss";
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

const MEASURED = ["font-size", "font-weight", "color"] as const;
const FONT_SIZE = { cssProperties: ["font-size"], kind: "length" } as const;
const FONT_WEIGHT = { cssProperties: ["font-weight"], kind: "number" } as const;
const COLOR = { cssProperties: ["color"], kind: "color" } as const;

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

  // BC-10.3: effective values (rendered on the Canvas: tag defaults,
  // inheritance, relative units), not just what was typed. An unset h1
  // (32px, bold) and an unset p (16px, regular) read Mixed.
  const measured = useRenderedStyles(ids, MEASURED);
  const typography = nodes.map((node) => getTypographySettings(node));
  const fontSize = resolveSharedEffective(
    nodes.map((node, index) => effectiveValueOf(node.id, FONT_SIZE, measured, () => {
      const size = typography[index].fontSize;
      return size && size.unit === "px" ? [`${size.value}px`] : undefined;
    })),
    pxFieldValue,
  );
  const fontWeight = resolveSharedEffective(
    nodes.map((node, index) => effectiveValueOf(node.id, FONT_WEIGHT, measured, () => {
      const weight = typography[index].fontWeight;
      return weight === undefined ? undefined : [String(weight)];
    })),
    (normalized) => FONT_WEIGHT_OPTIONS.find((option) => String(option.value) === normalized)?.value,
  );
  const authoredColors = typography.map((settings) => absoluteAuthoredColor(settings.color));
  const color = resolveSharedEffective(
    nodes.map((node, index) => effectiveValueOf(node.id, COLOR, measured, () => {
      const authored = authoredColors[index];
      return authored === undefined ? undefined : [authored];
    })),
    (normalized) => commonAuthored(authoredColors) ?? colorFieldValue(normalized),
  );
  const authored = {
    fontSize: typography.some((settings) => settings.fontSize !== undefined),
    fontWeight: typography.some((settings) => settings.fontWeight !== undefined),
    color: typography.some((settings) => settings.color !== undefined),
  };

  return (
    <InspectorSection label="Typography">
      <InspectorPropertyRow label="Font size" variant="stack" state={effectiveRowState(fontSize, authored.fontSize)}>
        <InspectorBulkNumberField
          ariaLabel="Font size"
          shared={fontSize}
          min={1}
          onCommit={(value) => {
            if (!isValidFontSize(value)) return;
            setElementsTypographyField(ids, "fontSize", { value, unit: "px" });
          }}
        />
      </InspectorPropertyRow>

      <InspectorSegmentedRow
        label="Weight"
        state={effectiveRowState(fontWeight, authored.fontWeight)}
        options={FONT_WEIGHT_LABELS}
        activeOption={fontWeight.kind === "same" ? FONT_WEIGHT_VALUE_TO_LABEL[fontWeight.value] : NO_ACTIVE_OPTION}
        onSelect={(option) => setElementsTypographyField(ids, "fontWeight", FONT_WEIGHT_LABEL_TO_VALUE[option])}
      />

      <InspectorSharedValueNote shared={fontWeight} />

      <InspectorPropertyRow label="Color" state={effectiveRowState(color, authored.color)}>
        <InspectorBulkTextField
          ariaLabel="Text color"
          shared={color}
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

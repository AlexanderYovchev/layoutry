"use client";

import { InspectorBulkNumberField } from "@/features/inspector/components/InspectorBulkNumberField";
import { InspectorBulkTextField } from "@/features/inspector/components/InspectorBulkTextField";
import { InspectorPropertyRow } from "@/features/inspector/components/InspectorPropertyRow";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { InspectorSegmentedRow } from "@/features/inspector/components/InspectorSegmentedRow";
import { resolveSharedValue, withSharedFallback } from "@/features/inspector/types/sharedValue";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { getBorderSettings, getBorderSide, isValidBorderStyleValue, isValidBorderWidthValue, type BorderStyleValue } from "@/features/editor/types/border";
import { isValidCssColor } from "@/features/editor/utils/cssColor";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorBulkBorderSectionProps {
  nodes: readonly EditorElementNode[];
}

const NO_ACTIVE_OPTION = "";
const STYLE_OPTIONS: BorderStyleValue[] = ["solid", "dashed", "dotted", "double", "groove", "ridge", "inset", "outset"];
const STYLE_LABELS = STYLE_OPTIONS.map((value) => value[0].toUpperCase() + value.slice(1));
const STYLE_LABEL_TO_VALUE = Object.fromEntries(STYLE_OPTIONS.map((value, index) => [STYLE_LABELS[index], value])) as Record<string, BorderStyleValue>;
const STYLE_VALUE_TO_LABEL = Object.fromEntries(STYLE_OPTIONS.map((value, index) => [value, STYLE_LABELS[index]])) as Record<BorderStyleValue, string>;

/**
 * The multi-selection Border surface (Checkpoint 1.15.2) — "All Sides"
 * mode only (writes the same width/style/color to top/right/bottom/left
 * on every targeted node in one commit); per-individual-side bulk editing
 * is deferred (see this checkpoint's report, section J). Each field's own
 * "same vs. mixed" read uses each node's own top side as representative
 * — a node whose four sides already differ from each other reads by its
 * top side alone here, a deliberate simplification for this first bulk
 * foundation (also documented in the report).
 */
export function InspectorBulkBorderSection({ nodes }: InspectorBulkBorderSectionProps) {
  const setElementsBorderAllSidesField = useEditorStore((state) => state.setElementsBorderAllSidesField);
  const ids = nodes.map((node) => node.id);

  const width = resolveSharedValue(nodes, (node) => getBorderSide(getBorderSettings(node), "top").width?.value);
  const style = resolveSharedValue(nodes, (node) => getBorderSide(getBorderSettings(node), "top").style);
  const color = resolveSharedValue(nodes, (node) => getBorderSide(getBorderSettings(node), "top").color);

  return (
    <InspectorSection label="Border">
      <InspectorPropertyRow label="Width" variant="stack" state={width.kind === "mixed" ? "mixed" : width.value !== undefined ? "set" : "unset"}>
        <InspectorBulkNumberField
          ariaLabel="Border width"
          shared={withSharedFallback(width, 0)}
          min={0}
          onCommit={(value) => {
            if (!isValidBorderWidthValue(value)) return;
            setElementsBorderAllSidesField(ids, "width", { value, unit: "px" });
          }}
        />
      </InspectorPropertyRow>

      <InspectorSegmentedRow
        label="Style"
        state={style.kind === "mixed" ? "mixed" : style.value ? "set" : "unset"}
        options={STYLE_LABELS}
        activeOption={style.kind === "same" && style.value ? STYLE_VALUE_TO_LABEL[style.value] : NO_ACTIVE_OPTION}
        onSelect={(option) => {
          const value = STYLE_LABEL_TO_VALUE[option];
          if (!isValidBorderStyleValue(value)) return;
          setElementsBorderAllSidesField(ids, "style", value);
        }}
      />

      <InspectorPropertyRow label="Color" state={color.kind === "mixed" ? "mixed" : color.value ? "set" : "unset"}>
        <InspectorBulkTextField
          ariaLabel="Border color"
          shared={withSharedFallback(color, "")}
          placeholder="#000000"
          onCommit={(value) => {
            if (!isValidCssColor(value)) return;
            setElementsBorderAllSidesField(ids, "color", value);
          }}
        />
      </InspectorPropertyRow>
    </InspectorSection>
  );
}

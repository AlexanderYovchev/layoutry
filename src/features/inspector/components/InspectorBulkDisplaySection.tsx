"use client";

import { InspectorPropertyRow } from "@/features/inspector/components/InspectorPropertyRow";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { InspectorSegmentedRow } from "@/features/inspector/components/InspectorSegmentedRow";
import { resolveSharedValue } from "@/features/inspector/types/sharedValue";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { getDisplaySettings, isValidDisplayValue, isValidVisibilityValue, type DisplayValue, type VisibilityValue } from "@/features/editor/types/display";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorBulkDisplaySectionProps {
  nodes: readonly EditorElementNode[];
}

const NO_ACTIVE_OPTION = "";
const DISPLAY_OPTIONS = ["Block", "Inline", "Inline Block", "None"];
const DISPLAY_LABEL_TO_VALUE: Record<string, DisplayValue> = { Block: "block", Inline: "inline", "Inline Block": "inline-block", None: "none" };
const DISPLAY_VALUE_TO_LABEL: Record<DisplayValue, string> = { block: "Block", inline: "Inline", "inline-block": "Inline Block", none: "None" };

const VISIBILITY_OPTIONS = ["Visible", "Hidden"];
const VISIBILITY_LABEL_TO_VALUE: Record<string, VisibilityValue> = { Visible: "visible", Hidden: "hidden" };
const VISIBILITY_VALUE_TO_LABEL: Record<VisibilityValue, string> = { visible: "Visible", hidden: "Hidden" };

/** The multi-selection Display surface (Checkpoint 1.15.2) — Display + Visibility, both single-choice segmented controls. */
export function InspectorBulkDisplaySection({ nodes }: InspectorBulkDisplaySectionProps) {
  const setElementsDisplayField = useEditorStore((state) => state.setElementsDisplayField);
  const ids = nodes.map((node) => node.id);

  const display = resolveSharedValue(nodes, (node) => getDisplaySettings(node).display);
  const visibility = resolveSharedValue(nodes, (node) => getDisplaySettings(node).visibility);

  return (
    <InspectorSection label="Display">
      <InspectorPropertyRow label="Display" state={display.kind === "mixed" ? "mixed" : display.value ? "set" : "unset"}>
        <InspectorSegmentedRow
          label="Display"
          options={DISPLAY_OPTIONS}
          activeOption={display.kind === "same" && display.value ? DISPLAY_VALUE_TO_LABEL[display.value] : NO_ACTIVE_OPTION}
          onSelect={(option) => {
            const value = DISPLAY_LABEL_TO_VALUE[option];
            if (!isValidDisplayValue(value)) return;
            setElementsDisplayField(ids, "display", value);
          }}
        />
      </InspectorPropertyRow>

      <InspectorPropertyRow label="Visibility" state={visibility.kind === "mixed" ? "mixed" : visibility.value ? "set" : "unset"}>
        <InspectorSegmentedRow
          label="Visibility"
          options={VISIBILITY_OPTIONS}
          activeOption={visibility.kind === "same" && visibility.value ? VISIBILITY_VALUE_TO_LABEL[visibility.value] : NO_ACTIVE_OPTION}
          onSelect={(option) => {
            const value = VISIBILITY_LABEL_TO_VALUE[option];
            if (!isValidVisibilityValue(value)) return;
            setElementsDisplayField(ids, "visibility", value);
          }}
        />
      </InspectorPropertyRow>
    </InspectorSection>
  );
}

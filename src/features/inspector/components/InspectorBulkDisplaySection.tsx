"use client";

import { InspectorPropertyRow } from "@/features/inspector/components/InspectorPropertyRow";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { InspectorSegmentedRow } from "@/features/inspector/components/InspectorSegmentedRow";
import { InspectorSharedValueNote } from "@/features/inspector/components/InspectorSharedValueNote";
import { useRenderedStyles } from "@/features/inspector/hooks/useRenderedStyles";
import { effectiveRowState, effectiveValueOf, resolveSharedEffective } from "@/features/inspector/utils/effectiveCss";
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

const DISPLAY_MEASURED = ["display", "visibility"] as const;
const DISPLAY = { cssProperties: ["display"], kind: "keyword" } as const;
const VISIBILITY = { cssProperties: ["visibility"], kind: "keyword" } as const;

/** The multi-selection Display surface (Checkpoint 1.15.2) — Display + Visibility, both single-choice segmented controls. */
export function InspectorBulkDisplaySection({ nodes }: InspectorBulkDisplaySectionProps) {
  const setElementsDisplayField = useEditorStore((state) => state.setElementsDisplayField);
  const ids = nodes.map((node) => node.id);

  // BC-10.3: effective values. A Button is inline-flex and a Link inline-block by default, and
  // visibility is inherited, so the typed values alone can't say whether they agree.
  const measured = useRenderedStyles(ids, DISPLAY_MEASURED);
  const settings = nodes.map((node) => getDisplaySettings(node));
  const display = resolveSharedEffective(
    nodes.map((node, index) => effectiveValueOf(node.id, DISPLAY, measured, () => (settings[index].display === undefined ? undefined : [settings[index].display]))),
    (normalized) => (isValidDisplayValue(normalized) ? normalized : undefined),
  );
  const visibility = resolveSharedEffective(
    nodes.map((node, index) => effectiveValueOf(node.id, VISIBILITY, measured, () => (settings[index].visibility === undefined ? undefined : [settings[index].visibility]))),
    (normalized) => (isValidVisibilityValue(normalized) ? normalized : undefined),
  );

  return (
    <InspectorSection label="Display">
      <InspectorPropertyRow label="Display" state={effectiveRowState(display, settings.some((value) => value.display !== undefined))}>
        <InspectorSegmentedRow
          label="Display"
          options={DISPLAY_OPTIONS}
          activeOption={display.kind === "same" ? DISPLAY_VALUE_TO_LABEL[display.value] : NO_ACTIVE_OPTION}
          onSelect={(option) => {
            const value = DISPLAY_LABEL_TO_VALUE[option];
            if (!isValidDisplayValue(value)) return;
            setElementsDisplayField(ids, "display", value);
          }}
        />
      </InspectorPropertyRow>

      <InspectorSharedValueNote shared={display} />

      <InspectorPropertyRow label="Visibility" state={effectiveRowState(visibility, settings.some((value) => value.visibility !== undefined))}>
        <InspectorSegmentedRow
          label="Visibility"
          options={VISIBILITY_OPTIONS}
          activeOption={visibility.kind === "same" ? VISIBILITY_VALUE_TO_LABEL[visibility.value] : NO_ACTIVE_OPTION}
          onSelect={(option) => {
            const value = VISIBILITY_LABEL_TO_VALUE[option];
            if (!isValidVisibilityValue(value)) return;
            setElementsDisplayField(ids, "visibility", value);
          }}
        />
      </InspectorPropertyRow>
      <InspectorSharedValueNote shared={visibility} />
    </InspectorSection>
  );
}

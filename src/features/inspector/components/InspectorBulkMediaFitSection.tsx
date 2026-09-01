"use client";

import { InspectorPropertyRow } from "@/features/inspector/components/InspectorPropertyRow";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { InspectorSegmentedRow } from "@/features/inspector/components/InspectorSegmentedRow";
import { resolveSharedValue } from "@/features/inspector/types/sharedValue";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { getMediaFitSettings, isValidObjectFitValue, OBJECT_FIT_PRESETS, type ObjectFitValue } from "@/features/editor/types/mediaFit";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorBulkMediaFitSectionProps {
  nodes: readonly EditorElementNode[];
}

const NO_ACTIVE_OPTION = "";
const OBJECT_FIT_OPTIONS = OBJECT_FIT_PRESETS.map((preset) => preset.label);
const LABEL_TO_VALUE = Object.fromEntries(OBJECT_FIT_PRESETS.map((preset) => [preset.label, preset.value])) as Record<string, ObjectFitValue>;
const VALUE_TO_LABEL = Object.fromEntries(OBJECT_FIT_PRESETS.map((preset) => [preset.value, preset.label])) as Record<ObjectFitValue, string>;

/**
 * The multi-selection Media Fit surface (Checkpoint 1.15.2) — Object Fit
 * only; Object Position (a 2D grid picker) is deferred the same way
 * Position's own offsets are. Rendered only once every selected tag's
 * own supportsMediaFit capability has already been confirmed true (e.g.
 * Image + Video, never Image + Iframe) via intersectElementCapabilities.
 */
export function InspectorBulkMediaFitSection({ nodes }: InspectorBulkMediaFitSectionProps) {
  const setElementsMediaFitField = useEditorStore((state) => state.setElementsMediaFitField);
  const ids = nodes.map((node) => node.id);

  const objectFit = resolveSharedValue(nodes, (node) => getMediaFitSettings(node).objectFit);

  return (
    <InspectorSection label="Media">
      <InspectorPropertyRow label="Object Fit" state={objectFit.kind === "mixed" ? "mixed" : objectFit.value ? "set" : "unset"}>
        <InspectorSegmentedRow
          label="Object Fit"
          options={OBJECT_FIT_OPTIONS}
          activeOption={objectFit.kind === "same" && objectFit.value ? VALUE_TO_LABEL[objectFit.value] : NO_ACTIVE_OPTION}
          onSelect={(option) => {
            const value = LABEL_TO_VALUE[option];
            if (!isValidObjectFitValue(value)) return;
            setElementsMediaFitField(ids, "objectFit", value);
          }}
        />
      </InspectorPropertyRow>
    </InspectorSection>
  );
}

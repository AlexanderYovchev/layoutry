"use client";

import { InspectorPropertyRow } from "@/features/inspector/components/InspectorPropertyRow";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { InspectorSegmentedRow } from "@/features/inspector/components/InspectorSegmentedRow";
import { resolveSharedValue } from "@/features/inspector/types/sharedValue";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { getPositionSettings, isValidPositionValue, type PositionValue } from "@/features/editor/types/position";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorBulkPositionSectionProps {
  nodes: readonly EditorElementNode[];
}

const NO_ACTIVE_OPTION = "";
const POSITION_OPTIONS = ["Static", "Relative", "Absolute", "Fixed", "Sticky"];
const POSITION_LABEL_TO_VALUE: Record<string, PositionValue> = {
  Static: "static",
  Relative: "relative",
  Absolute: "absolute",
  Fixed: "fixed",
  Sticky: "sticky",
};
const POSITION_VALUE_TO_LABEL: Record<PositionValue, string> = {
  static: "Static",
  relative: "Relative",
  absolute: "Absolute",
  fixed: "Fixed",
  sticky: "Sticky",
};

/**
 * The multi-selection Position surface (Checkpoint 1.15.2) — the
 * `position` value only, deliberately not top/right/bottom/left: bulk-
 * applying one absolute offset to several differently-placed elements is
 * a group-move/distribute concern, not a plain shared-CSS-value one, and
 * this checkpoint's own brief explicitly defers that (see this
 * checkpoint's report, section J).
 */
export function InspectorBulkPositionSection({ nodes }: InspectorBulkPositionSectionProps) {
  const setElementsPositionField = useEditorStore((state) => state.setElementsPositionField);
  const ids = nodes.map((node) => node.id);

  const position = resolveSharedValue(nodes, (node) => getPositionSettings(node).position);

  return (
    <InspectorSection label="Position">
      <InspectorPropertyRow label="Position" state={position.kind === "mixed" ? "mixed" : position.value ? "set" : "unset"}>
        <InspectorSegmentedRow
          label="Position"
          options={POSITION_OPTIONS}
          activeOption={position.kind === "same" && position.value ? POSITION_VALUE_TO_LABEL[position.value] : NO_ACTIVE_OPTION}
          onSelect={(option) => {
            const value = POSITION_LABEL_TO_VALUE[option];
            if (!isValidPositionValue(value)) return;
            setElementsPositionField(ids, "position", value);
          }}
        />
      </InspectorPropertyRow>
    </InspectorSection>
  );
}

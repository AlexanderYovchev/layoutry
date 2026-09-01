"use client";

import { InspectorBulkNumberField } from "@/features/inspector/components/InspectorBulkNumberField";
import { InspectorPropertyRow } from "@/features/inspector/components/InspectorPropertyRow";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { resolveSharedValue, withSharedFallback } from "@/features/inspector/types/sharedValue";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { getBorderRadiusSettings, isValidBorderRadiusValue } from "@/features/editor/types/borderRadius";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorBulkBorderRadiusSectionProps {
  nodes: readonly EditorElementNode[];
}

/** The multi-selection Border Radius surface (Checkpoint 1.15.2) — one uniform radius applied to all four corners of every targeted node, mirroring Border's own "All Sides" bulk simplification. */
export function InspectorBulkBorderRadiusSection({ nodes }: InspectorBulkBorderRadiusSectionProps) {
  const setElementsBorderRadiusAllCorners = useEditorStore((state) => state.setElementsBorderRadiusAllCorners);
  const ids = nodes.map((node) => node.id);

  const radius = resolveSharedValue(nodes, (node) => getBorderRadiusSettings(node).topLeft?.value);

  return (
    <InspectorSection label="Border Radius">
      <InspectorPropertyRow label="Radius" variant="stack" state={radius.kind === "mixed" ? "mixed" : radius.value !== undefined ? "set" : "unset"}>
        <InspectorBulkNumberField
          ariaLabel="Border radius"
          shared={withSharedFallback(radius, 0)}
          min={0}
          onCommit={(value) => {
            if (!isValidBorderRadiusValue(value)) return;
            setElementsBorderRadiusAllCorners(ids, { value, unit: "px" });
          }}
        />
      </InspectorPropertyRow>
    </InspectorSection>
  );
}

"use client";

import { InspectorBulkNumberField } from "@/features/inspector/components/InspectorBulkNumberField";
import { InspectorPropertyRow } from "@/features/inspector/components/InspectorPropertyRow";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { resolveSharedValue, withSharedFallback } from "@/features/inspector/types/sharedValue";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { getFilterSettings, isValidOpacityValue } from "@/features/editor/types/filters";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorBulkFiltersSectionProps {
  nodes: readonly EditorElementNode[];
}

/** The multi-selection Filters surface (Checkpoint 1.15.2) — Opacity and Blur, a representative subset (see this checkpoint's report). */
export function InspectorBulkFiltersSection({ nodes }: InspectorBulkFiltersSectionProps) {
  const setElementsFilterField = useEditorStore((state) => state.setElementsFilterField);
  const ids = nodes.map((node) => node.id);

  const opacity = resolveSharedValue(nodes, (node) => getFilterSettings(node).opacity);
  const blur = resolveSharedValue(nodes, (node) => getFilterSettings(node).blur?.value);

  return (
    <InspectorSection label="Filters">
      <InspectorPropertyRow label="Opacity" state={opacity.kind === "mixed" ? "mixed" : opacity.value !== undefined ? "set" : "unset"}>
        <InspectorBulkNumberField
          ariaLabel="Opacity"
          shared={withSharedFallback(opacity, 100)}
          min={0}
          max={100}
          onCommit={(value) => isValidOpacityValue(value) && setElementsFilterField(ids, "opacity", value)}
        />
      </InspectorPropertyRow>
      <InspectorPropertyRow label="Blur" state={blur.kind === "mixed" ? "mixed" : blur.value !== undefined ? "set" : "unset"}>
        <InspectorBulkNumberField
          ariaLabel="Blur"
          shared={withSharedFallback(blur, 0)}
          min={0}
          onCommit={(value) => setElementsFilterField(ids, "blur", { value, unit: "px" })}
        />
      </InspectorPropertyRow>
    </InspectorSection>
  );
}

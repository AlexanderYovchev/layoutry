"use client";

import { InspectorBulkNumberField } from "@/features/inspector/components/InspectorBulkNumberField";
import { InspectorPropertyRow } from "@/features/inspector/components/InspectorPropertyRow";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { resolveSharedValue } from "@/features/inspector/types/sharedValue";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { getElementSpacing } from "@/features/editor/types/spacing";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorBulkSpacingSectionProps {
  nodes: readonly EditorElementNode[];
}

/**
 * The multi-selection Spacing surface (Checkpoint 1.15.2) — one uniform
 * value per box (Margin, Padding), applied to all four sides of every
 * targeted node in a single commit via setElementsSpacingAllSides. Per-
 * individual-side bulk editing (top/right/bottom/left independently) is
 * deferred, the same scoping choice this checkpoint made for Border.
 * Each field's "same vs. mixed" read uses each node's own top side as
 * representative, matching Border's own simplification.
 */
export function InspectorBulkSpacingSection({ nodes }: InspectorBulkSpacingSectionProps) {
  const setElementsSpacingAllSides = useEditorStore((state) => state.setElementsSpacingAllSides);
  const ids = nodes.map((node) => node.id);

  const margin = resolveSharedValue(nodes, (node) => getElementSpacing(node).margin.top);
  const padding = resolveSharedValue(nodes, (node) => getElementSpacing(node).padding.top);

  return (
    <InspectorSection label="Spacing">
      <InspectorPropertyRow label="Margin" state={margin.kind === "mixed" ? "mixed" : "set"}>
        <InspectorBulkNumberField ariaLabel="Margin" shared={margin} onCommit={(value) => setElementsSpacingAllSides(ids, "margin", value)} />
      </InspectorPropertyRow>
      <InspectorPropertyRow label="Padding" state={padding.kind === "mixed" ? "mixed" : "set"}>
        <InspectorBulkNumberField ariaLabel="Padding" shared={padding} onCommit={(value) => setElementsSpacingAllSides(ids, "padding", value)} />
      </InspectorPropertyRow>
    </InspectorSection>
  );
}

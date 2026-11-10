"use client";

import { InspectorBulkNumberField } from "@/features/inspector/components/InspectorBulkNumberField";
import { InspectorPropertyRow } from "@/features/inspector/components/InspectorPropertyRow";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { resolveSharedValue, withSharedFallback, type SharedValue } from "@/features/inspector/types/sharedValue";
import type { PropertyState } from "@/features/inspector/types/propertyState";
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
 *
 * BC-05.3: the read is the authored side itself, so an unset side and an
 * authored 0 are different values (the selection reads "Mixed"), and the
 * row is "set" only when every node authors that side. A same-but-unset
 * read shows 0, the Layoutry baseline; it does not measure what each
 * element renders (for padding that can differ by element).
 */
function sharedState(shared: SharedValue<number | undefined>): PropertyState {
  if (shared.kind === "mixed") return "mixed";
  return shared.value === undefined ? "unset" : "set";
}

export function InspectorBulkSpacingSection({ nodes }: InspectorBulkSpacingSectionProps) {
  const setElementsSpacingAllSides = useEditorStore((state) => state.setElementsSpacingAllSides);
  const ids = nodes.map((node) => node.id);

  const margin = resolveSharedValue(nodes, (node) => getElementSpacing(node).margin.top);
  const padding = resolveSharedValue(nodes, (node) => getElementSpacing(node).padding.top);
  const marginShown = withSharedFallback(margin, 0);
  const paddingShown = withSharedFallback(padding, 0);

  return (
    <InspectorSection label="Spacing">
      <InspectorPropertyRow label="Margin" state={sharedState(margin)}>
        <InspectorBulkNumberField ariaLabel="Margin" shared={marginShown} onCommit={(value) => setElementsSpacingAllSides(ids, "margin", value)} />
      </InspectorPropertyRow>
      <InspectorPropertyRow label="Padding" state={sharedState(padding)}>
        <InspectorBulkNumberField ariaLabel="Padding" shared={paddingShown} onCommit={(value) => setElementsSpacingAllSides(ids, "padding", value)} />
      </InspectorPropertyRow>
    </InspectorSection>
  );
}

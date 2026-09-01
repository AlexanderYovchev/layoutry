"use client";

import { InspectorBulkNumberField } from "@/features/inspector/components/InspectorBulkNumberField";
import { InspectorPropertyRow } from "@/features/inspector/components/InspectorPropertyRow";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { resolveSharedValue, withSharedFallback } from "@/features/inspector/types/sharedValue";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { getSizeConstraints, isValidSizeConstraintValue } from "@/features/editor/types/sizeConstraints";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorBulkSizeSectionProps {
  nodes: readonly EditorElementNode[];
}

/**
 * The multi-selection Size surface (Checkpoint 1.15.2) — Min/Max only.
 * Bulk Width/Height is deliberately deferred: ElementDimensions is atomic
 * (a node either has an explicit width AND height together, or neither —
 * see ElementDimensions's own doc comment), so a node currently sizing
 * itself naturally has no existing "other axis" to preserve while bulk-
 * writing just one; inventing one (from a live DOM measurement, or a
 * synthesized default) would be exactly the kind of surprising side
 * effect this checkpoint's own brief warns against for Position/Layout.
 * setElementsDimensions/setElementsAspectRatio both already exist at the
 * store layer for a future checkpoint to build a resolved answer on top
 * of — see this checkpoint's report, section J.
 */
export function InspectorBulkSizeSection({ nodes }: InspectorBulkSizeSectionProps) {
  const setElementsSizeConstraintField = useEditorStore((state) => state.setElementsSizeConstraintField);
  const ids = nodes.map((node) => node.id);

  const minWidth = resolveSharedValue(nodes, (node) => getSizeConstraints(node).minWidth);
  const minHeight = resolveSharedValue(nodes, (node) => getSizeConstraints(node).minHeight);
  const maxWidth = resolveSharedValue(nodes, (node) => getSizeConstraints(node).maxWidth);
  const maxHeight = resolveSharedValue(nodes, (node) => getSizeConstraints(node).maxHeight);

  return (
    <InspectorSection label="Size">
      <InspectorPropertyRow label="Min width" state={minWidth.kind === "mixed" ? "mixed" : minWidth.value !== undefined ? "set" : "unset"}>
        <InspectorBulkNumberField
          ariaLabel="Min width"
          shared={withSharedFallback(minWidth, 0)}
          min={0}
          onCommit={(value) => isValidSizeConstraintValue(value) && setElementsSizeConstraintField(ids, "minWidth", value)}
        />
      </InspectorPropertyRow>
      <InspectorPropertyRow label="Min height" state={minHeight.kind === "mixed" ? "mixed" : minHeight.value !== undefined ? "set" : "unset"}>
        <InspectorBulkNumberField
          ariaLabel="Min height"
          shared={withSharedFallback(minHeight, 0)}
          min={0}
          onCommit={(value) => isValidSizeConstraintValue(value) && setElementsSizeConstraintField(ids, "minHeight", value)}
        />
      </InspectorPropertyRow>
      <InspectorPropertyRow label="Max width" state={maxWidth.kind === "mixed" ? "mixed" : maxWidth.value !== undefined ? "set" : "unset"}>
        <InspectorBulkNumberField
          ariaLabel="Max width"
          shared={withSharedFallback(maxWidth, 0)}
          min={0}
          onCommit={(value) => isValidSizeConstraintValue(value) && setElementsSizeConstraintField(ids, "maxWidth", value)}
        />
      </InspectorPropertyRow>
      <InspectorPropertyRow label="Max height" state={maxHeight.kind === "mixed" ? "mixed" : maxHeight.value !== undefined ? "set" : "unset"}>
        <InspectorBulkNumberField
          ariaLabel="Max height"
          shared={withSharedFallback(maxHeight, 0)}
          min={0}
          onCommit={(value) => isValidSizeConstraintValue(value) && setElementsSizeConstraintField(ids, "maxHeight", value)}
        />
      </InspectorPropertyRow>
    </InspectorSection>
  );
}

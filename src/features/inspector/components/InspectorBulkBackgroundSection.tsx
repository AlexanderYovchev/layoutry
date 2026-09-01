"use client";

import { InspectorBulkTextField } from "@/features/inspector/components/InspectorBulkTextField";
import { InspectorPropertyRow } from "@/features/inspector/components/InspectorPropertyRow";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { resolveSharedValue, withSharedFallback } from "@/features/inspector/types/sharedValue";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { getBackgroundSettings } from "@/features/editor/types/background";
import { isValidCssColor } from "@/features/editor/utils/cssColor";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorBulkBackgroundSectionProps {
  nodes: readonly EditorElementNode[];
}

/**
 * The multi-selection Background surface (Checkpoint 1.15.2) — Color
 * only. Image/Gradient source editing stays single-selection-only this
 * checkpoint (see this checkpoint's report, section J) — both are
 * genuinely interactive sub-editors (a URL + size/position/repeat/
 * attachment sub-panel; a draggable multi-stop gradient track), and
 * neither has an obvious "what does editing this mean across N
 * differently-configured nodes" answer the way a flat color value does.
 */
export function InspectorBulkBackgroundSection({ nodes }: InspectorBulkBackgroundSectionProps) {
  const setElementsBackgroundField = useEditorStore((state) => state.setElementsBackgroundField);
  const ids = nodes.map((node) => node.id);

  const color = resolveSharedValue(nodes, (node) => getBackgroundSettings(node).color);

  return (
    <InspectorSection label="Background">
      <InspectorPropertyRow label="Color" state={color.kind === "mixed" ? "mixed" : color.value ? "set" : "unset"}>
        <InspectorBulkTextField
          ariaLabel="Background color"
          shared={withSharedFallback(color, "")}
          placeholder="#000000"
          onCommit={(value) => {
            if (!isValidCssColor(value)) return;
            setElementsBackgroundField(ids, "color", value);
          }}
        />
      </InspectorPropertyRow>
    </InspectorSection>
  );
}

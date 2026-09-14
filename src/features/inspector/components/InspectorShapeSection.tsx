"use client";

import { InspectorResetButton } from "@/features/inspector/components/InspectorResetButton";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { InspectorShapeGrid } from "@/features/inspector/components/InspectorShapeGrid";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { getShapePreset } from "@/features/editor/types/shape";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorShapeSectionProps {
  node: EditorElementNode;
}

/**
 * Advanced Container Shapes (Checkpoint 1.15.4) — a single preset grid,
 * no graphical path editor (the brief's own explicit "do not overbuild"
 * instruction). Rendered only for a shape-capable tag (see
 * getElementCapabilities().supportsShape) inside the same
 * InspectorProtectedStyleGroup every other CSS section already sits in
 * (InspectorNodeSummary) — Shape is an authored CSS mutation like any
 * other, so Parent Style Protection covers it for free with no
 * shape-specific guard logic.
 */
export function InspectorShapeSection({ node }: InspectorShapeSectionProps) {
  const setElementShape = useEditorStore((state) => state.setElementShape);
  const preset = getShapePreset(node);

  return (
    <InspectorSection label="Shape">
      <InspectorShapeGrid
        activePreset={preset}
        state={preset === "none" ? "unset" : "set"}
        onSelect={(next) => setElementShape(node.id, next)}
        reset={
          <InspectorResetButton
            onReset={() => setElementShape(node.id, "none")}
            disabled={preset === "none"}
            label="Reset shape"
          />
        }
      />
      <p className="px-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">
        Shapes use CSS clip-path and may clip child content outside the visible area.
      </p>
    </InspectorSection>
  );
}

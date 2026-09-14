"use client";

import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { InspectorShapeGrid } from "@/features/inspector/components/InspectorShapeGrid";
import { resolveSharedValue } from "@/features/inspector/types/sharedValue";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { getShapePreset } from "@/features/editor/types/shape";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorBulkShapeSectionProps {
  nodes: readonly EditorElementNode[];
}

/** The multi-selection Shape surface (Checkpoint 1.15.4) — same "same"/"mixed" read as every other bulk section (resolveSharedValue), and the exact same InspectorShapeGrid single-selection uses, so both surfaces can never visually drift apart. Selecting any preset applies it to every selected node in one atomic, one-history-entry bulk command (setElementsShape). */
export function InspectorBulkShapeSection({ nodes }: InspectorBulkShapeSectionProps) {
  const setElementsShape = useEditorStore((state) => state.setElementsShape);
  const ids = nodes.map((node) => node.id);

  const shape = resolveSharedValue(nodes, (node) => getShapePreset(node));
  const activePreset = shape.kind === "same" ? shape.value : undefined;
  const hasShape = shape.kind === "same" && shape.value !== "none";

  return (
    <InspectorSection label="Shape">
      <InspectorShapeGrid
        activePreset={activePreset}
        state={shape.kind === "mixed" ? "mixed" : hasShape ? "set" : "unset"}
        onSelect={(next) => setElementsShape(ids, next)}
      />
      <p className="px-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">
        Shapes use CSS clip-path and may clip child content outside the visible area.
      </p>
    </InspectorSection>
  );
}

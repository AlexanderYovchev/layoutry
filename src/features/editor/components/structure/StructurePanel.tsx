"use client";

import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { StructureEmptyState } from "@/features/editor/components/structure/StructureEmptyState";
import { StructureTree } from "@/features/editor/components/structure/StructureTree";

export function StructurePanel() {
  const hasElements = useEditorStore(
    (state) => (state.document.children?.length ?? 0) > 0,
  );

  return (
    <div>
      <p className="text-fg-secondary mb-3 text-xs">
        View and select elements on the canvas.
      </p>
      {hasElements ? <StructureTree /> : <StructureEmptyState />}
    </div>
  );
}

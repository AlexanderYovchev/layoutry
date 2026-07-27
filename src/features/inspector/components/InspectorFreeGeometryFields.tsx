"use client";

import { InspectorNumberFieldRow } from "@/features/inspector/components/InspectorNumberFieldRow";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorFreeGeometryFieldsProps {
  /** The selected node — rendered only when its own parent is a Free container (see InspectorNodeSummary). */
  node: EditorElementNode;
}

/**
 * X/Y/Width/Height for a Free child (Checkpoint 3.4.4), editable and
 * committing through the exact same setFreeChildGeometry store action
 * the drag/resize handles use — the checkpoint's "the Inspector and drag
 * handles must use the same command functions" requirement. Renders
 * nothing if the node has no freeLayout yet (shouldn't normally happen
 * for a Free child, but fails safely rather than showing stale zeros).
 */
export function InspectorFreeGeometryFields({ node }: InspectorFreeGeometryFieldsProps) {
  const setFreeChildGeometry = useEditorStore((state) => state.setFreeChildGeometry);
  const geometry = node.freeLayout;
  if (!geometry) return null;

  return (
    <>
      <InspectorNumberFieldRow
        label="X"
        value={geometry.x}
        onCommit={(x) => setFreeChildGeometry(node.id, { ...geometry, x })}
      />
      <InspectorNumberFieldRow
        label="Y"
        value={geometry.y}
        onCommit={(y) => setFreeChildGeometry(node.id, { ...geometry, y })}
      />
      <InspectorNumberFieldRow
        label="Width"
        value={geometry.width}
        onCommit={(width) => setFreeChildGeometry(node.id, { ...geometry, width })}
      />
      <InspectorNumberFieldRow
        label="Height"
        value={geometry.height}
        onCommit={(height) => setFreeChildGeometry(node.id, { ...geometry, height })}
      />
    </>
  );
}

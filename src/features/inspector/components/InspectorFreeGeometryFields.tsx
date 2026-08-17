"use client";

import { InspectorNumberFieldRow } from "@/features/inspector/components/InspectorNumberFieldRow";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorFreeGeometryFieldsProps {
  /** The selected node — rendered only when its own parent is a Free container (see InspectorNodeSummary). */
  node: EditorElementNode;
}

/**
 * X/Y for a Free child (Checkpoint 3.4.4), editable and committing
 * through the exact same setFreeChildGeometry store action the drag/
 * resize handles use — the checkpoint's "the Inspector and drag handles
 * must use the same command functions" requirement. Renders nothing if
 * the node has no freeLayout yet (shouldn't normally happen for a Free
 * child, but fails safely rather than showing stale zeros).
 *
 * Width/Height moved out to InspectorSizeSection in Checkpoint 5.7 (the
 * consolidated "Size" section, alongside Flow's own Width/Height/Min/
 * Max/Aspect Ratio/Resize Proportions controls — "expand the same
 * section, don't duplicate it") — X/Y are a positioning concern, not a
 * sizing one, so they stay here rather than moving alongside Width/
 * Height purely for having shared this one component historically.
 * Both still ultimately write through the identical setFreeChildGeometry
 * action, merging in whichever fields the other UI location didn't
 * touch, so there is exactly one Free-geometry command boundary
 * regardless of which Inspector location a given edit came from.
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
    </>
  );
}

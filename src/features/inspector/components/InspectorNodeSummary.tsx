import { InspectorElementSummary } from "@/features/inspector/components/InspectorElementSummary";
import { InspectorFieldRow } from "@/features/inspector/components/InspectorFieldRow";
import { canResizeElement } from "@/features/editor/rules/resizeRules";
import { getElementDisplayName } from "@/features/editor/utils/elementDisplayName";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorNodeSummaryProps {
  node: EditorElementNode;
  parentId: string | null;
}

/**
 * Read-only proof of the real selection data flow ahead of the CSS
 * Inspector (M6) — display name, tag, and ids only, no editable controls.
 * Width/Height are the same read-only shape: they mirror node.dimensions
 * live (including mid-drag, since a resize commits to the store every
 * frame) but stay plain text, not inputs — editable size fields are
 * explicitly future scope.
 */
export function InspectorNodeSummary({ node, parentId }: InspectorNodeSummaryProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <InspectorElementSummary name={getElementDisplayName(node)} tag={node.tag} />
      <div className="flex flex-col gap-1.5 px-3 py-2">
        <InspectorFieldRow label="Node ID" value={node.id} />
        {parentId && <InspectorFieldRow label="Parent ID" value={parentId} />}
        {canResizeElement(node.tag) && (
          <>
            <InspectorFieldRow
              label="Width"
              value={node.dimensions ? `${Math.round(node.dimensions.width)}px` : "Auto"}
            />
            <InspectorFieldRow
              label="Height"
              value={node.dimensions ? `${Math.round(node.dimensions.height)}px` : "Auto"}
            />
          </>
        )}
      </div>
    </div>
  );
}

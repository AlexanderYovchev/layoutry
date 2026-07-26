import { InspectorElementSummary } from "@/features/inspector/components/InspectorElementSummary";
import { InspectorFieldRow } from "@/features/inspector/components/InspectorFieldRow";
import { canResizeElement } from "@/features/editor/rules/elementCapabilities";
import { useRenderedNodeSize } from "@/features/editor/hooks/useRenderedNodeSize";
import { getElementDisplayName } from "@/features/editor/utils/elementDisplayName";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorNodeSummaryProps {
  node: EditorElementNode;
  parentId: string | null;
}

// A rendered size within this many pixels of the preferred size counts as
// "not constrained" — guards against reporting a parent constraint from
// harmless subpixel rounding between the stored value and getBoundingClientRect.
const CONSTRAINT_TOLERANCE_PX = 1;

interface DimensionRowsProps {
  label: string;
  preferred: number | undefined;
  rendered: number | undefined;
}

/**
 * One dimension's read-only presentation: a plain "Width: 320px" row when
 * unconstrained (or unset — "Auto"), or, when the parent's usable content
 * box is currently rendering the node smaller than the size the user
 * asked for (see elementDimensionsStyle's maxWidth/maxHeight: "100%"),
 * both the effective and preferred values plus a "Constrained by parent"
 * note — never silently hiding the mismatch, and never implying the
 * user's preferred size was lost.
 */
function DimensionRows({ label, preferred, rendered }: DimensionRowsProps) {
  if (preferred === undefined) {
    return <InspectorFieldRow label={label} value="Auto" />;
  }

  const isConstrained = rendered !== undefined && rendered < preferred - CONSTRAINT_TOLERANCE_PX;
  if (!isConstrained) {
    return <InspectorFieldRow label={label} value={`${Math.round(preferred)}px`} />;
  }

  return (
    <>
      <InspectorFieldRow label={label} value={`${Math.round(rendered)}px`} />
      <InspectorFieldRow label={`Preferred ${label.toLowerCase()}`} value={`${Math.round(preferred)}px`} />
      <InspectorFieldRow label="Constrained" value="By parent" />
    </>
  );
}

/**
 * Read-only proof of the real selection data flow ahead of the CSS
 * Inspector (M6) — display name, tag, and ids only, no editable controls.
 * Width/Height mirror node.dimensions.preferredWidth/preferredHeight live
 * (including mid-drag, since a resize commits to the store every frame),
 * plus the node's actual rendered size (useRenderedNodeSize) whenever a
 * containing parent is currently clamping it smaller — see DimensionRows.
 * Still plain text, not inputs — editable size fields are explicitly
 * future scope.
 */
export function InspectorNodeSummary({ node, parentId }: InspectorNodeSummaryProps) {
  const isResizable = canResizeElement(node.tag);
  const renderedSize = useRenderedNodeSize(isResizable ? node.id : null);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <InspectorElementSummary name={getElementDisplayName(node)} tag={node.tag} />
      <div className="flex flex-col gap-1.5 px-3 py-2">
        <InspectorFieldRow label="Node ID" value={node.id} />
        {parentId && <InspectorFieldRow label="Parent ID" value={parentId} />}
        {isResizable && (
          <>
            <DimensionRows
              label="Width"
              preferred={node.dimensions?.preferredWidth}
              rendered={renderedSize?.width}
            />
            <DimensionRows
              label="Height"
              preferred={node.dimensions?.preferredHeight}
              rendered={renderedSize?.height}
            />
          </>
        )}
      </div>
    </div>
  );
}

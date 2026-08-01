import { InspectorBackgroundSection } from "@/features/inspector/components/InspectorBackgroundSection";
import { InspectorBorderRadiusSection } from "@/features/inspector/components/InspectorBorderRadiusSection";
import { InspectorBorderSection } from "@/features/inspector/components/InspectorBorderSection";
import { InspectorBoxShadowSection } from "@/features/inspector/components/InspectorBoxShadowSection";
import { InspectorDisplaySection } from "@/features/inspector/components/InspectorDisplaySection";
import { InspectorFiltersSection } from "@/features/inspector/components/InspectorFiltersSection";
import { InspectorElementSummary } from "@/features/inspector/components/InspectorElementSummary";
import { InspectorFieldRow } from "@/features/inspector/components/InspectorFieldRow";
import { InspectorFlexChildSection } from "@/features/inspector/components/InspectorFlexChildSection";
import { InspectorFreeGeometryFields } from "@/features/inspector/components/InspectorFreeGeometryFields";
import { InspectorGridChildSection } from "@/features/inspector/components/InspectorGridChildSection";
import { InspectorLayoutSection } from "@/features/inspector/components/InspectorLayoutSection";
import { InspectorMediaSection } from "@/features/inspector/components/InspectorMediaSection";
import { InspectorSpacingSection } from "@/features/inspector/components/InspectorSpacingSection";
import { InspectorTypographySection } from "@/features/inspector/components/InspectorTypographySection";
import { canResizeElement, getElementCapabilities } from "@/features/editor/rules/elementCapabilities";
import { useRenderedNodeSize } from "@/features/editor/hooks/useRenderedNodeSize";
import { canContainChildren } from "@/features/editor/rules/insertionRules";
import { getElementDisplayName } from "@/features/editor/utils/elementDisplayName";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { ContainerLayoutMode } from "@/features/editor/types/layout";
import type { FlowDisplayMode } from "@/features/editor/types/flowLayout";

interface InspectorNodeSummaryProps {
  node: EditorElementNode;
  parentId: string | null;
  /** The selected node's own parent's layoutMode — decides whether Width/Height reads from dimensions (Flow) or the Free geometry fields take over (Checkpoint 3.4.4). */
  parentLayoutMode: ContainerLayoutMode;
  /** The selected node's own parent's resolved flowLayout.display — decides whether the Flex or Grid child section renders (Checkpoint 3.5). Ignored while parentLayoutMode is "free". */
  parentFlowDisplay: FlowDisplayMode;
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
 * Width/Height are still plain text (DimensionRows) for a Flow node —
 * editable size fields there are explicitly future scope. A Free child
 * (Checkpoint 3.4.4) gets real editable X/Y/Width/Height fields instead
 * (see InspectorFreeGeometryFields), since Free geometry has no
 * "constrained by parent" ambiguity to display read-only.
 */
export function InspectorNodeSummary({
  node,
  parentId,
  parentLayoutMode,
  parentFlowDisplay,
}: InspectorNodeSummaryProps) {
  const isResizable = canResizeElement(node.tag);
  const isFreeChild = parentLayoutMode === "free";
  const renderedSize = useRenderedNodeSize(isResizable && !isFreeChild ? node.id : null);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <InspectorElementSummary name={getElementDisplayName(node)} tag={node.tag} />
      <div className="flex flex-col gap-1.5 px-3 py-2">
        <InspectorFieldRow label="Node ID" value={node.id} />
        {parentId && <InspectorFieldRow label="Parent ID" value={parentId} />}
        {isFreeChild ? (
          <InspectorFreeGeometryFields node={node} />
        ) : (
          isResizable && (
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
          )
        )}
      </div>
      {!isFreeChild && parentFlowDisplay === "flex" && <InspectorFlexChildSection node={node} />}
      {!isFreeChild && parentFlowDisplay === "grid" && <InspectorGridChildSection node={node} />}
      {getElementCapabilities(node.tag).supportsIntrinsicAspectRatio && <InspectorMediaSection node={node} />}
      {getElementCapabilities(node.tag).supportsTypography && <InspectorTypographySection node={node} />}
      {getElementCapabilities(node.tag).supportsBackground && <InspectorBackgroundSection node={node} />}
      {getElementCapabilities(node.tag).supportsBorder && <InspectorBorderSection node={node} />}
      {getElementCapabilities(node.tag).supportsBorderRadius && <InspectorBorderRadiusSection node={node} />}
      {getElementCapabilities(node.tag).supportsBoxShadow && <InspectorBoxShadowSection node={node} />}
      {getElementCapabilities(node.tag).supportsFilters && <InspectorFiltersSection node={node} />}
      {getElementCapabilities(node.tag).supportsDisplay && <InspectorDisplaySection node={node} />}
      <InspectorSpacingSection node={node} />
      {canContainChildren(node.tag) && <InspectorLayoutSection node={node} />}
    </div>
  );
}

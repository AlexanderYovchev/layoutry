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
import { InspectorHeadingLevelSection } from "@/features/inspector/components/InspectorHeadingLevelSection";
import { InspectorLayoutSection } from "@/features/inspector/components/InspectorLayoutSection";
import { InspectorLinkSection } from "@/features/inspector/components/InspectorLinkSection";
import { InspectorMediaSection } from "@/features/inspector/components/InspectorMediaSection";
import { InspectorPositionSection } from "@/features/inspector/components/InspectorPositionSection";
import { InspectorSizeSection } from "@/features/inspector/components/InspectorSizeSection";
import { InspectorSpacingSection } from "@/features/inspector/components/InspectorSpacingSection";
import { InspectorTypographySection } from "@/features/inspector/components/InspectorTypographySection";
import { getElementCapabilities } from "@/features/editor/rules/elementCapabilities";
import { canContainChildren } from "@/features/editor/rules/insertionRules";
import { getElementDisplayName } from "@/features/editor/utils/elementDisplayName";
import type { EditorElementNode } from "@/features/editor/types/document";
import { getLayoutMode, type ContainerLayoutMode } from "@/features/editor/types/layout";
import type { FlowDisplayMode } from "@/features/editor/types/flowLayout";

interface InspectorNodeSummaryProps {
  node: EditorElementNode;
  parentId: string | null;
  /** The selected node's own parent's layoutMode — decides whether Width/Height reads from dimensions (Flow) or the Free geometry fields take over (Checkpoint 3.4.4). */
  parentLayoutMode: ContainerLayoutMode;
  /** The selected node's own parent's resolved flowLayout.display — decides whether the Flex or Grid child section renders (Checkpoint 3.5). Ignored while parentLayoutMode is "free". */
  parentFlowDisplay: FlowDisplayMode;
}

/**
 * Read-only proof of the real selection data flow ahead of the CSS
 * Inspector (M6) — display name, tag, and ids only, no editable controls
 * at this level; Width/Height/Min/Max/Aspect Ratio/Resize Proportions
 * are all real, editable controls in InspectorSizeSection (Checkpoint
 * 5.7 consolidated what used to be read-only DimensionRows text plus a
 * separate Aspect-Ratio-only "Size" section into that one section — see
 * its own doc comment for the full architecture). A Free child
 * (Checkpoint 3.4.4) still gets its own X/Y fields here
 * (InspectorFreeGeometryFields) — a positioning concern, not sizing —
 * while its Width/Height live in InspectorSizeSection alongside Flow's.
 *
 * The "Size" section renders directly after Node ID/Parent ID/X/Y
 * regardless of Flow/Free, gated only by
 * getElementCapabilities().supportsAspectRatio — unlike Position, it
 * needs no Free-child/Free-container exclusion: Free's own x/y
 * ownership is untouched by CSS aspect-ratio or Width/Height editing
 * (see InspectorSizeSection/resolveAspectRatioStyle's own doc comments
 * for why the two coexist safely).
 */
export function InspectorNodeSummary({
  node,
  parentId,
  parentLayoutMode,
  parentFlowDisplay,
}: InspectorNodeSummaryProps) {
  const isFreeChild = parentLayoutMode === "free";
  // The Position section (Checkpoint 5.1) never renders for either role
  // the pre-existing Free layout mechanism already owns CSS `position`
  // for — a Free child (forced position: absolute) or a container that
  // hosts its own Free children (forced position: relative) — see
  // types/position.ts's own doc comment for the full ownership conflict.
  const isFreeContainer = getLayoutMode(node) === "free";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <InspectorElementSummary name={getElementDisplayName(node)} tag={node.tag} />
      <div className="flex flex-col gap-1.5 px-3 py-2">
        <InspectorFieldRow label="Node ID" value={node.id} />
        {parentId && <InspectorFieldRow label="Parent ID" value={parentId} />}
        {isFreeChild && <InspectorFreeGeometryFields node={node} />}
      </div>
      {getElementCapabilities(node.tag).supportsAspectRatio && (
        <InspectorSizeSection node={node} isFreeChild={isFreeChild} />
      )}
      {!isFreeChild && parentFlowDisplay === "flex" && <InspectorFlexChildSection node={node} />}
      {!isFreeChild && parentFlowDisplay === "grid" && <InspectorGridChildSection node={node} />}
      {getElementCapabilities(node.tag).supportsMediaFit && <InspectorMediaSection node={node} />}
      {getElementCapabilities(node.tag).supportsHref && <InspectorLinkSection node={node} />}
      {getElementCapabilities(node.tag).supportsHeadingLevel && <InspectorHeadingLevelSection node={node} />}
      {getElementCapabilities(node.tag).supportsTypography && <InspectorTypographySection node={node} />}
      {getElementCapabilities(node.tag).supportsBackground && <InspectorBackgroundSection node={node} />}
      {getElementCapabilities(node.tag).supportsBorder && <InspectorBorderSection node={node} />}
      {getElementCapabilities(node.tag).supportsBorderRadius && <InspectorBorderRadiusSection node={node} />}
      {getElementCapabilities(node.tag).supportsBoxShadow && <InspectorBoxShadowSection node={node} />}
      {getElementCapabilities(node.tag).supportsFilters && <InspectorFiltersSection node={node} />}
      {getElementCapabilities(node.tag).supportsDisplay && <InspectorDisplaySection node={node} />}
      {getElementCapabilities(node.tag).supportsPosition && !isFreeChild && !isFreeContainer && (
        <InspectorPositionSection node={node} />
      )}
      <InspectorSpacingSection node={node} />
      {canContainChildren(node.tag) && <InspectorLayoutSection node={node} />}
    </div>
  );
}

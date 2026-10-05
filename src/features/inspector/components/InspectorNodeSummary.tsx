import { InspectorAudioSection } from "@/features/inspector/components/InspectorAudioSection";
import { InspectorBackgroundSection } from "@/features/inspector/components/InspectorBackgroundSection";
import { InspectorBorderRadiusSection } from "@/features/inspector/components/InspectorBorderRadiusSection";
import { InspectorBorderSection } from "@/features/inspector/components/InspectorBorderSection";
import { InspectorBoxShadowSection } from "@/features/inspector/components/InspectorBoxShadowSection";
import { InspectorDisplaySection } from "@/features/inspector/components/InspectorDisplaySection";
import { InspectorFiltersSection } from "@/features/inspector/components/InspectorFiltersSection";
import { InspectorElementSummary } from "@/features/inspector/components/InspectorElementSummary";
import { InspectorFieldRow } from "@/features/inspector/components/InspectorFieldRow";
import { InspectorFlexChildSection } from "@/features/inspector/components/InspectorFlexChildSection";
import { InspectorFormControlSection } from "@/features/inspector/components/InspectorFormControlSection";
import { InspectorFreeGeometryFields } from "@/features/inspector/components/InspectorFreeGeometryFields";
import { InspectorGridChildSection } from "@/features/inspector/components/InspectorGridChildSection";
import { InspectorHeadingLevelSection } from "@/features/inspector/components/InspectorHeadingLevelSection";
import { InspectorIdentitySection } from "@/features/inspector/components/InspectorIdentitySection";
import { InspectorIframeSection } from "@/features/inspector/components/InspectorIframeSection";
import { InspectorImageSection } from "@/features/inspector/components/InspectorImageSection";
import { InspectorInteractionsSection } from "@/features/inspector/components/InspectorInteractionsSection";
import { InspectorLayoutSection } from "@/features/inspector/components/InspectorLayoutSection";
import { InspectorLinkSection } from "@/features/inspector/components/InspectorLinkSection";
import { InspectorListSection } from "@/features/inspector/components/InspectorListSection";
import { InspectorMediaSection } from "@/features/inspector/components/InspectorMediaSection";
import { InspectorOptionSection } from "@/features/inspector/components/InspectorOptionSection";
import { InspectorPositionSection } from "@/features/inspector/components/InspectorPositionSection";
import { InspectorProtectedStyleGroup } from "@/features/inspector/components/InspectorProtectedStyleGroup";
import { InspectorProtectionSection } from "@/features/inspector/components/InspectorProtectionSection";
import { InspectorSelectOptionsSection } from "@/features/inspector/components/InspectorSelectOptionsSection";
import { InspectorShapeSection } from "@/features/inspector/components/InspectorShapeSection";
import { InspectorSizeSection } from "@/features/inspector/components/InspectorSizeSection";
import { InspectorSpacingSection } from "@/features/inspector/components/InspectorSpacingSection";
import { InspectorStyleProtectionNotice } from "@/features/inspector/components/InspectorStyleProtectionNotice";
import { InspectorSvgDrawingModeSection } from "@/features/inspector/components/InspectorSvgDrawingModeSection";
import { InspectorSvgSection } from "@/features/inspector/components/InspectorSvgSection";
import { InspectorTableSection } from "@/features/inspector/components/InspectorTableSection";
import { InspectorTableSelectionSection } from "@/features/inspector/components/InspectorTableSelectionSection";
import { InspectorTypographySection } from "@/features/inspector/components/InspectorTypographySection";
import { InspectorVectorObjectSection } from "@/features/inspector/components/InspectorVectorObjectSection";
import { InspectorVideoSection } from "@/features/inspector/components/InspectorVideoSection";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { getElementCapabilities } from "@/features/editor/rules/elementCapabilities";
import { canContainChildren } from "@/features/editor/rules/insertionRules";
import { canOwnStyleLock, getStyleProtection } from "@/features/editor/rules/styleProtection";
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

  // Parent Style Protection (Checkpoint 1.15.3) — computed once per render
  // and threaded through every STYLE-only section below via
  // InspectorProtectedStyleGroup (visible-but-disabled, never hidden — see
  // that component's own doc comment). Semantic/structural sections
  // (Identity, Video, Iframe, Link, Heading Level, List, Table, Table
  // Selection, Option, Form Control, Select Options) are deliberately left
  // OUTSIDE any protected group — this is a STYLE lock, not a content lock
  // (section 5).
  const documentModel = useEditorStore((state) => state.document);
  const protection = getStyleProtection(documentModel, node.id);

  // Checkpoint 1.15.6 — SVG Drawing Mode's own Inspector hierarchy
  // (section Q of its own brief): normal SVG selection shows Identity/SVG/
  // CSS as before; entering Drawing Mode swaps InspectorSvgSection for
  // InspectorSvgDrawingModeSection (Primitive/ViewBox/Fill/Stroke/Stroke
  // Width on the OUTER node are moot once a vector scene exists), and
  // selecting a vector object inside it additionally shows Vector Object,
  // hiding the trailing CSS block (Typography through Layout) so a
  // selected object's own Fill/Stroke controls are never shown alongside
  // a second, unrelated set for the outer SVG box at the same time.
  const svgEditingNodeId = useEditorStore((state) => state.svgEditingNodeId);
  const selectedSvgObjectIds = useEditorStore((state) => state.selectedSvgObjectIds);
  const isEditingThisSvg = svgEditingNodeId === node.id;
  const hasVectorObjectSelection = isEditingThisSvg && selectedSvgObjectIds.length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <InspectorElementSummary name={getElementDisplayName(node)} tag={node.tag} />
      <div className="flex flex-col gap-1.5 px-3 py-2">
        <InspectorFieldRow label="Node ID" value={node.id} />
        {parentId && <InspectorFieldRow label="Parent ID" value={parentId} />}
        {isFreeChild && (
          <InspectorProtectedStyleGroup protected={protection.protected}>
            <InspectorFreeGeometryFields node={node} />
          </InspectorProtectedStyleGroup>
        )}
      </div>
      <InspectorIdentitySection node={node} />
      {canOwnStyleLock(node.tag) && <InspectorProtectionSection node={node} />}
      {node.id !== documentModel.id && <InspectorInteractionsSection node={node} />}
      <InspectorStyleProtectionNotice protection={protection} />
      {getElementCapabilities(node.tag).supportsAspectRatio && (
        <InspectorProtectedStyleGroup protected={protection.protected}>
          <InspectorSizeSection node={node} isFreeChild={isFreeChild} />
        </InspectorProtectedStyleGroup>
      )}
      {!isFreeChild && parentFlowDisplay === "flex" && (
        <InspectorProtectedStyleGroup protected={protection.protected}>
          <InspectorFlexChildSection node={node} />
        </InspectorProtectedStyleGroup>
      )}
      {!isFreeChild && parentFlowDisplay === "grid" && (
        <InspectorProtectedStyleGroup protected={protection.protected}>
          <InspectorGridChildSection node={node} />
        </InspectorProtectedStyleGroup>
      )}
      {getElementCapabilities(node.tag).supportsMediaFit && (
        <InspectorProtectedStyleGroup protected={protection.protected}>
          <InspectorMediaSection node={node} />
        </InspectorProtectedStyleGroup>
      )}
      {node.tag === "img" && <InspectorImageSection node={node} />}
      {node.tag === "video" && <InspectorVideoSection node={node} />}
      {node.tag === "audio" && <InspectorAudioSection node={node} />}
      {node.tag === "iframe" && <InspectorIframeSection node={node} />}
      {getElementCapabilities(node.tag).supportsSvgSettings && !isEditingThisSvg && (
        <InspectorSvgSection node={node} protection={protection} />
      )}
      {getElementCapabilities(node.tag).supportsSvgSettings && isEditingThisSvg && <InspectorSvgDrawingModeSection />}
      {hasVectorObjectSelection && (
        <InspectorVectorObjectSection svgNode={node} objectIds={selectedSvgObjectIds} protection={protection} />
      )}
      {getElementCapabilities(node.tag).supportsHref && <InspectorLinkSection node={node} />}
      {getElementCapabilities(node.tag).supportsHeadingLevel && <InspectorHeadingLevelSection node={node} />}
      {(node.tag === "ul" || node.tag === "ol") && <InspectorListSection node={node} />}
      {node.tag === "table" && <InspectorTableSection node={node} />}
      {(node.tag === "table" || node.tag === "tr") && <InspectorTableSelectionSection node={node} />}
      {node.tag === "option" && <InspectorOptionSection node={node} parentId={parentId} />}
      {getElementCapabilities(node.tag).supportsFormControl && <InspectorFormControlSection node={node} />}
      {node.tag === "select" && <InspectorSelectOptionsSection node={node} />}
      {/*
       * Retracted while a vector object is selected inside this SVG
       * (Checkpoint 1.15.6) — every field in here styles the OUTER SVG
       * box, not the selected shape, and showing both at once (e.g. this
       * block's own Background/Border color fields next to Vector
       * Object's Fill/Stroke) is exactly the "confusing users about what
       * they're changing" InspectorVectorObjectSection's own doc comment
       * warns against. Editing this SVG with nothing selected yet still
       * shows the outer box's own CSS normally.
       */}
      {!hasVectorObjectSelection && (
        <InspectorProtectedStyleGroup protected={protection.protected}>
          {getElementCapabilities(node.tag).supportsTypography && <InspectorTypographySection node={node} />}
          {getElementCapabilities(node.tag).supportsBackground && <InspectorBackgroundSection node={node} />}
          {getElementCapabilities(node.tag).supportsBorder && <InspectorBorderSection node={node} />}
          {getElementCapabilities(node.tag).supportsBorderRadius && <InspectorBorderRadiusSection node={node} />}
          {getElementCapabilities(node.tag).supportsShape && <InspectorShapeSection node={node} />}
          {getElementCapabilities(node.tag).supportsBoxShadow && <InspectorBoxShadowSection node={node} />}
          {getElementCapabilities(node.tag).supportsFilters && <InspectorFiltersSection node={node} />}
          {getElementCapabilities(node.tag).supportsDisplay && <InspectorDisplaySection node={node} />}
          {getElementCapabilities(node.tag).supportsPosition && !isFreeChild && !isFreeContainer && (
            <InspectorPositionSection node={node} />
          )}
          <InspectorSpacingSection node={node} />
          {canContainChildren(node.tag) && getElementCapabilities(node.tag).supportsChildLayout && (
            <InspectorLayoutSection node={node} />
          )}
        </InspectorProtectedStyleGroup>
      )}
    </div>
  );
}

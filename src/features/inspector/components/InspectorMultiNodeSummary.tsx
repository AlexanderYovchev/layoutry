import { InspectorBulkBackgroundSection } from "@/features/inspector/components/InspectorBulkBackgroundSection";
import { InspectorBulkBorderRadiusSection } from "@/features/inspector/components/InspectorBulkBorderRadiusSection";
import { InspectorBulkBorderSection } from "@/features/inspector/components/InspectorBulkBorderSection";
import { InspectorBulkDisplaySection } from "@/features/inspector/components/InspectorBulkDisplaySection";
import { InspectorBulkFiltersSection } from "@/features/inspector/components/InspectorBulkFiltersSection";
import { InspectorBulkMediaFitSection } from "@/features/inspector/components/InspectorBulkMediaFitSection";
import { InspectorBulkPositionSection } from "@/features/inspector/components/InspectorBulkPositionSection";
import { InspectorBulkSizeSection } from "@/features/inspector/components/InspectorBulkSizeSection";
import { InspectorBulkShapeSection } from "@/features/inspector/components/InspectorBulkShapeSection";
import { InspectorBulkSpacingSection } from "@/features/inspector/components/InspectorBulkSpacingSection";
import { InspectorBulkSvgSection } from "@/features/inspector/components/InspectorBulkSvgSection";
import { InspectorBulkTransitionSection } from "@/features/inspector/components/InspectorBulkTransitionSection";
import { InspectorBulkTransformSection } from "@/features/inspector/components/InspectorBulkTransformSection";
import { InspectorBulkTypographySection } from "@/features/inspector/components/InspectorBulkTypographySection";
import { InspectorProtectedStyleGroup } from "@/features/inspector/components/InspectorProtectedStyleGroup";
import { InspectorBackgroundSection } from "@/features/inspector/components/InspectorBackgroundSection";
import { InspectorBorderRadiusSection } from "@/features/inspector/components/InspectorBorderRadiusSection";
import { InspectorBorderSection } from "@/features/inspector/components/InspectorBorderSection";
import { InspectorBoxShadowSection } from "@/features/inspector/components/InspectorBoxShadowSection";
import { InspectorBulkBackgroundSourcePanel } from "@/features/inspector/components/InspectorBulkBackgroundSourcePanel";
import { InspectorDisplaySection } from "@/features/inspector/components/InspectorDisplaySection";
import { InspectorFiltersSection } from "@/features/inspector/components/InspectorFiltersSection";
import { InspectorFlexChildSection } from "@/features/inspector/components/InspectorFlexChildSection";
import { InspectorGridChildSection } from "@/features/inspector/components/InspectorGridChildSection";
import { InspectorLayoutSection } from "@/features/inspector/components/InspectorLayoutSection";
import { InspectorMixedSectionPanel } from "@/features/inspector/components/InspectorMixedSectionPanel";
import { InspectorPositionSection } from "@/features/inspector/components/InspectorPositionSection";
import { InspectorSectionFanOut } from "@/features/inspector/components/InspectorSectionFanOut";
import { InspectorSpacingSection } from "@/features/inspector/components/InspectorSpacingSection";
import { InspectorTransformSection } from "@/features/inspector/components/InspectorTransformSection";
import { InspectorTransitionSection } from "@/features/inspector/components/InspectorTransitionSection";
import { InspectorTypographySection } from "@/features/inspector/components/InspectorTypographySection";
import { isSectionUniform, type FanOutSection } from "@/features/inspector/utils/sectionUniformity";
import { getElementCapabilities } from "@/features/editor/rules/elementCapabilities";
import { canContainChildren } from "@/features/editor/rules/insertionRules";
import { getFlexContainerSettings, getFlowLayoutSettings, getGridContainerSettings } from "@/features/editor/types/flowLayout";
import { getLayoutMode } from "@/features/editor/types/layout";
import { findNodeById, findParentId } from "@/features/editor/utils/findNodeById";
import { Fragment, type ReactNode } from "react";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { intersectElementCapabilities } from "@/features/editor/rules/elementCapabilities";
import { describeStyleLockNotice, getStyleProtection } from "@/features/editor/rules/styleProtection";
import { getElementDisplayName } from "@/features/editor/utils/elementDisplayName";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorMultiNodeSummaryProps {
  nodes: readonly EditorElementNode[];
}

/**
 * Builds the "N elements selected" / "N Paragraphs selected" header text
 * (Checkpoint 1.15.2, Part 23) — grouped by TAG alone (a node's own
 * displayName/text override, e.g. a customized Button label or an
 * Option's own "Option — France" text suffix, is deliberately ignored
 * for this purely-informational grouping check), never overcomplicated
 * with sub-variant detection (an Input's inputType, a Heading's level,
 * ...) — the brief's own explicit instruction.
 */
function describeSelection(nodes: readonly EditorElementNode[]): string {
  const firstTag = nodes[0].tag;
  const sameTag = nodes.every((node) => node.tag === firstTag);
  if (!sameTag) return `${nodes.length} elements selected`;
  const baseName = getElementDisplayName({ id: "", tag: firstTag });
  return `${nodes.length} ${baseName}s selected`;
}

/**
 * The multi-selection Inspector view (Checkpoint 1.15.2) — the direct
 * counterpart to InspectorNodeSummary for 2+ selected nodes. Every CSS
 * section here is gated by the SAME capability flag InspectorNodeSummary
 * itself checks per-tag, evaluated once across the whole selection via
 * intersectElementCapabilities (Checkpoint 1.15.2's own centralized
 * intersection helper) — a section only ever appears when EVERY selected
 * node's own tag supports it. Deliberately renders NO semantic sections
 * (Identity, Heading Level, Link, Form Control, Option, Select Options,
 * Table structure, Video, Iframe, List) — see this checkpoint's report,
 * section K, for why bulk semantic authoring is out of scope, HTML
 * Identity above all (a bulk-copied `id` would create invalid HTML
 * duplicates).
 */
/**
 * "Use the primary's layout on all" (BC-10.4): the display mode and its
 * Flex or Grid settings, written as one transaction (one Undo step).
 * Only offered when every container is in Flow layout mode.
 */
function applyPrimaryLayout(ids: readonly string[], primary: EditorElementNode) {
  const store = useEditorStore.getState();
  const flow = getFlowLayoutSettings(primary);
  store.beginTransaction();
  store.setElementsSettings(ids, "flowDisplay", flow.display, { live: true });
  if (flow.display === "flex") store.setElementsSettings(ids, "flexContainer", getFlexContainerSettings(primary), { live: true });
  if (flow.display === "grid") store.setElementsSettings(ids, "gridContainer", getGridContainerSettings(primary), { live: true });
  store.commitTransaction();
}

export function InspectorMultiNodeSummary({ nodes }: InspectorMultiNodeSummaryProps) {
  const primaryId = useEditorStore((state) => state.selection.primaryId);
  const setElementsSettings = useEditorStore((state) => state.setElementsSettings);
  const capabilities = intersectElementCapabilities(nodes.map((node) => node.tag));

  // Parent Style Protection (Checkpoint 1.15.3, sections 17-18, 26) — a
  // SEPARATE concept from capability intersection (section 26's own
  // explicit distinction): capability answers "can this selection
  // conceptually support Typography," protection answers "is Layoutry
  // currently allowing that mutation right now." Sections stay visible
  // and capability-gated exactly as before; only the interactive style
  // controls become disabled when ANY selected node is protected, matching
  // the atomic bulk-guard the store itself already enforces.
  const documentModel = useEditorStore((state) => state.document);
  const protections = nodes.map((node) => getStyleProtection(documentModel, node.id));
  const anyProtected = protections.some((result) => result.protected);
  const protectionMessage = anyProtected ? describeStyleLockNotice(protections, true) : "";

  // Spacing renders unconditionally (matching InspectorNodeSummary's own
  // single-selection behavior — margin/padding are meaningful on
  // literally any tag, no capability gate exists for it there either),
  // so it is deliberately excluded from this "is there anything ELSE
  // shared" check (Checkpoint 1.15.2, Part 39) — otherwise the "no shared
  // style controls" message could never appear at all (Spacing alone
  // would always make the section list non-empty), while simultaneously
  // showing a working Spacing section right underneath it would read as
  // self-contradictory.
  // BC-10.4: each section is either the REAL single-selection editor,
  // fanned out to every selected element (when they share its authored
  // settings and tag, see sectionUniformity.ts), or the field-level bulk
  // section (truthful Mixed/Unknown), or, for list/configuration
  // sections without a field-level model, an explicit Mixed panel.
  const ids = nodes.map((node) => node.id);
  const parents = nodes.map((node) => {
    const parentId = findParentId(documentModel, node.id);
    return parentId ? findNodeById(documentModel, parentId) : undefined;
  });
  const primary = nodes.find((node) => node.id === primaryId) ?? nodes[nodes.length - 1];
  const primaryName = getElementDisplayName(primary);
  const uniform = (section: FanOutSection) => isSectionUniform(section, nodes, parents);
  const fanOut = (key: string, element: ReactNode) => (
    <InspectorSectionFanOut key={key} ids={ids}>
      {element}
    </InspectorSectionFanOut>
  );
  const isFreeChild = parents.map((parent) => parent !== undefined && getLayoutMode(parent) === "free");
  const noneFreeChild = isFreeChild.every((free) => !free);
  const noneFreeContainer = nodes.every((node) => getLayoutMode(node) !== "free");
  const parentDisplays = parents.map((parent) => (parent ? getFlowLayoutSettings(parent).display : undefined));
  const allContainers = nodes.every((node) => canContainChildren(node.tag) && getElementCapabilities(node.tag).supportsChildLayout);

  const capabilityGatedSections = [
    capabilities.supportsTypography &&
      (uniform("typography") ? fanOut("typography", <InspectorTypographySection node={primary} />) : <InspectorBulkTypographySection key="typography" nodes={nodes} />),
    capabilities.supportsBackground &&
      (uniform("background") ? (
        fanOut("background", <InspectorBackgroundSection node={primary} />)
      ) : (
        <Fragment key="background">
          <InspectorBulkBackgroundSection nodes={nodes} />
          <InspectorBulkBackgroundSourcePanel nodes={nodes} primary={primary} primaryName={primaryName} />
        </Fragment>
      )),
    capabilities.supportsBorder &&
      (uniform("border") ? fanOut("border", <InspectorBorderSection node={primary} />) : <InspectorBulkBorderSection key="border" nodes={nodes} />),
    capabilities.supportsBorderRadius &&
      (uniform("borderRadius") ? fanOut("borderRadius", <InspectorBorderRadiusSection node={primary} />) : <InspectorBulkBorderRadiusSection key="borderRadius" nodes={nodes} />),
    capabilities.supportsShape && <InspectorBulkShapeSection key="shape" nodes={nodes} />,
    capabilities.supportsBoxShadow &&
      (uniform("boxShadow") ? (
        fanOut("boxShadow", <InspectorBoxShadowSection node={primary} />)
      ) : (
        <InspectorMixedSectionPanel
          key="boxShadow"
          label="Box Shadow"
          cssGroup="boxShadow"
          description="The selected elements have different box shadows."
          actions={[
            { label: `Use ${primaryName}'s shadows on all`, onSelect: () => setElementsSettings(ids, "boxShadow", primary.boxShadow) },
            { label: "Remove all shadows", onSelect: () => setElementsSettings(ids, "boxShadow", undefined) },
          ]}
          note="Each element keeps its own shadows until you choose one of these. Afterwards they can be edited together."
        />
      )),
    capabilities.supportsMediaFit && <InspectorBulkMediaFitSection key="mediaFit" nodes={nodes} />,
    capabilities.supportsAspectRatio && <InspectorBulkSizeSection key="size" nodes={nodes} />,
    capabilities.supportsDisplay &&
      (uniform("display") ? fanOut("display", <InspectorDisplaySection node={primary} />) : <InspectorBulkDisplaySection key="display" nodes={nodes} />),
    capabilities.supportsPosition &&
      (uniform("position") && noneFreeChild && noneFreeContainer ? (
        fanOut("position", <InspectorPositionSection node={primary} />)
      ) : (
        <InspectorBulkPositionSection key="position" nodes={nodes} />
      )),
    capabilities.supportsFilters &&
      (uniform("filters") ? fanOut("filters", <InspectorFiltersSection node={primary} />) : <InspectorBulkFiltersSection key="filters" nodes={nodes} />),
    capabilities.supportsTransition &&
      (uniform("transition") ? fanOut("transition", <InspectorTransitionSection node={primary} />) : <InspectorBulkTransitionSection key="transition" nodes={nodes} />),
    capabilities.supportsTransform &&
      (uniform("transform") ? fanOut("transform", <InspectorTransformSection node={primary} />) : <InspectorBulkTransformSection key="transform" nodes={nodes} />),
    noneFreeChild &&
      parentDisplays.every((display) => display === "flex") &&
      (uniform("flexChild") ? (
        fanOut("flexChild", <InspectorFlexChildSection node={primary} />)
      ) : (
        <InspectorMixedSectionPanel
          key="flexChild"
          label="Flex Child"
          cssGroup="flexChild"
          description="The selected elements have different Flex child settings, or sit in differently laid out containers."
          actions={[
            { label: `Use ${primaryName}'s Flex child settings on all`, onSelect: () => setElementsSettings(ids, "flexChild", primary.flexChild) },
            { label: "Reset Flex child settings on all", onSelect: () => setElementsSettings(ids, "flexChild", undefined) },
          ]}
        />
      )),
    noneFreeChild &&
      parentDisplays.every((display) => display === "grid") &&
      (uniform("gridChild") ? (
        fanOut("gridChild", <InspectorGridChildSection node={primary} />)
      ) : (
        <InspectorMixedSectionPanel
          key="gridChild"
          label="Grid Child"
          cssGroup="gridChild"
          description="The selected elements have different Grid placement, or sit in differently laid out grids."
          actions={[
            { label: `Use ${primaryName}'s Grid placement on all`, onSelect: () => setElementsSettings(ids, "gridChild", primary.gridChild) },
            { label: "Reset Grid placement on all", onSelect: () => setElementsSettings(ids, "gridChild", undefined) },
          ]}
          note="A placement is clamped to each element's own grid, as for a single element."
        />
      )),
  ].filter(Boolean);

  // Layout (the containers' own Flow/Flex/Grid settings): the real editor
  // when uniform; otherwise an explicit choice to adopt the primary's.
  const layoutSection = allContainers && (uniform("layout") ? (
    fanOut("layout", <InspectorLayoutSection node={primary} />)
  ) : (
    <InspectorMixedSectionPanel
      key="layout"
      label="Content Layout"
      cssGroup="layout"
      description="The selected containers lay out their content differently."
      actions={[
        {
          label: `Use ${primaryName}'s layout on all`,
          disabled: nodes.some((node) => getLayoutMode(node) === "free"),
          onSelect: () => applyPrimaryLayout(ids, primary),
        },
      ]}
      note={
        nodes.some((node) => getLayoutMode(node) === "free")
          ? "Free-layout containers can't adopt a Flow layout together here: convert them one at a time."
          : "Each container keeps its own layout until you choose this. Afterwards they can be edited together."
      }
    />
  ));

  // SVG (Checkpoint 1.15.5) is rendered as its own standalone section,
  // OUTSIDE the shared InspectorProtectedStyleGroup below — unlike every
  // other bulk section here, it needs PARTIAL protection (Primitive
  // stays interactive even when protected; Fill/Stroke/Stroke Width
  // don't), so it owns its own internal protection wrapping instead
  // (see InspectorBulkSvgSection). Included in the "is there anything to
  // show" check below for the same reason Spacing is deliberately
  // excluded from it: SVG DOES have its own capability gate (unlike
  // Spacing), so its presence must count toward suppressing the "no
  // shared style controls" message.
  const hasAnySection = capabilityGatedSections.length > 0 || capabilities.supportsSvgSettings;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="flex flex-col gap-1.5 px-3 py-2">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{describeSelection(nodes)}</p>
      </div>
      {!hasAnySection && (
        <div className="flex flex-col gap-1 px-3 py-4 text-center text-xs text-zinc-500 dark:text-zinc-400">
          <p>No shared style controls are available for this selection.</p>
        </div>
      )}
      {anyProtected && (
        <div
          role="status"
          className="mx-3 mb-2 flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
        >
          <p>{protectionMessage}</p>
        </div>
      )}
      {capabilities.supportsSvgSettings && <InspectorBulkSvgSection nodes={nodes} protections={protections} />}
      <InspectorProtectedStyleGroup protected={anyProtected}>
        {capabilityGatedSections}
        {uniform("spacing") ? fanOut("spacing", <InspectorSpacingSection node={primary} />) : <InspectorBulkSpacingSection nodes={nodes} />}
        {layoutSection}
      </InspectorProtectedStyleGroup>
    </div>
  );
}

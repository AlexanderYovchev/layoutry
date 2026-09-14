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
import { InspectorBulkTypographySection } from "@/features/inspector/components/InspectorBulkTypographySection";
import { InspectorProtectedStyleGroup } from "@/features/inspector/components/InspectorProtectedStyleGroup";
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
export function InspectorMultiNodeSummary({ nodes }: InspectorMultiNodeSummaryProps) {
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
  const capabilityGatedSections = [
    capabilities.supportsTypography && <InspectorBulkTypographySection key="typography" nodes={nodes} />,
    capabilities.supportsBackground && <InspectorBulkBackgroundSection key="background" nodes={nodes} />,
    capabilities.supportsBorder && <InspectorBulkBorderSection key="border" nodes={nodes} />,
    capabilities.supportsBorderRadius && <InspectorBulkBorderRadiusSection key="borderRadius" nodes={nodes} />,
    capabilities.supportsShape && <InspectorBulkShapeSection key="shape" nodes={nodes} />,
    capabilities.supportsMediaFit && <InspectorBulkMediaFitSection key="mediaFit" nodes={nodes} />,
    capabilities.supportsAspectRatio && <InspectorBulkSizeSection key="size" nodes={nodes} />,
    capabilities.supportsDisplay && <InspectorBulkDisplaySection key="display" nodes={nodes} />,
    capabilities.supportsPosition && <InspectorBulkPositionSection key="position" nodes={nodes} />,
    capabilities.supportsFilters && <InspectorBulkFiltersSection key="filters" nodes={nodes} />,
  ].filter(Boolean);

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
        <InspectorBulkSpacingSection nodes={nodes} />
      </InspectorProtectedStyleGroup>
    </div>
  );
}

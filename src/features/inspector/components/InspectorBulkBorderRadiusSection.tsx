"use client";

import { InspectorBulkNumberField } from "@/features/inspector/components/InspectorBulkNumberField";
import { InspectorPropertyRow } from "@/features/inspector/components/InspectorPropertyRow";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { useRenderedStyles } from "@/features/inspector/hooks/useRenderedStyles";
import { effectiveRowState, effectiveValueOf, pxFieldValue, resolveSharedEffective } from "@/features/inspector/utils/effectiveCss";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { getBorderRadiusSettings, isValidBorderRadiusValue } from "@/features/editor/types/borderRadius";
import type { EditorElementNode } from "@/features/editor/types/document";

const CORNERS = {
  cssProperties: ["border-top-left-radius", "border-top-right-radius", "border-bottom-right-radius", "border-bottom-left-radius"],
  kind: "length",
} as const;

interface InspectorBulkBorderRadiusSectionProps {
  nodes: readonly EditorElementNode[];
}

/** The multi-selection Border Radius surface (Checkpoint 1.15.2) — one uniform radius applied to all four corners of every targeted node, mirroring Border's own "All Sides" bulk simplification. */
export function InspectorBulkBorderRadiusSection({ nodes }: InspectorBulkBorderRadiusSectionProps) {
  const setElementsBorderRadiusAllCorners = useEditorStore((state) => state.setElementsBorderRadiusAllCorners);
  const ids = nodes.map((node) => node.id);

  // BC-10.3: all four corners, with their units (50% and 50px are different), as rendered (a Button's default rounding counts).
  const measured = useRenderedStyles(ids, CORNERS.cssProperties);
  const radius = resolveSharedEffective(
    nodes.map((node) =>
      effectiveValueOf(node.id, CORNERS, measured, () => {
        const settings = getBorderRadiusSettings(node);
        const corners = [settings.topLeft, settings.topRight, settings.bottomRight, settings.bottomLeft];
        // Only px and % are context-free here; an unset corner depends on the element's default.
        return corners.every((corner) => corner !== undefined && (corner.unit === "px" || corner.unit === "%"))
          ? corners.map((corner) => `${corner?.value}${corner?.unit}`)
          : undefined;
      }),
    ),
    pxFieldValue,
  );
  const settings = nodes.map((node) => getBorderRadiusSettings(node));
  const anyAuthored = settings.some((value) => value.topLeft !== undefined || value.topRight !== undefined || value.bottomRight !== undefined || value.bottomLeft !== undefined);

  return (
    <InspectorSection label="Border Radius">
      <InspectorPropertyRow label="Radius" variant="stack" state={effectiveRowState(radius, anyAuthored)}>
        <InspectorBulkNumberField
          ariaLabel="Border radius"
          shared={radius}
          min={0}
          onCommit={(value) => {
            if (!isValidBorderRadiusValue(value)) return;
            setElementsBorderRadiusAllCorners(ids, { value, unit: "px" });
          }}
        />
      </InspectorPropertyRow>
    </InspectorSection>
  );
}

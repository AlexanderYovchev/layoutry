"use client";

import { InspectorResetButton } from "@/features/inspector/components/InspectorResetButton";
import { InspectorBulkTextField } from "@/features/inspector/components/InspectorBulkTextField";
import { InspectorPropertyRow } from "@/features/inspector/components/InspectorPropertyRow";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { useRenderedStyles } from "@/features/inspector/hooks/useRenderedStyles";
import { absoluteAuthoredColor, colorFieldValue, commonAuthored, effectiveRowState, effectiveValueOf, resolveSharedEffective } from "@/features/inspector/utils/effectiveCss";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { getBackgroundSettings } from "@/features/editor/types/background";
import { isValidCssColor } from "@/features/editor/utils/cssColor";
import type { EditorElementNode } from "@/features/editor/types/document";

const BACKGROUND_MEASURED = ["background-color"] as const;
const BACKGROUND_COLOR = { cssProperties: ["background-color"], kind: "color" } as const;

interface InspectorBulkBackgroundSectionProps {
  nodes: readonly EditorElementNode[];
}

/**
 * The multi-selection Background surface (Checkpoint 1.15.2) — Color
 * only. Image/Gradient source editing stays single-selection-only this
 * checkpoint (see this checkpoint's report, section J) — both are
 * genuinely interactive sub-editors (a URL + size/position/repeat/
 * attachment sub-panel; a draggable multi-stop gradient track), and
 * neither has an obvious "what does editing this mean across N
 * differently-configured nodes" answer the way a flat color value does.
 */
export function InspectorBulkBackgroundSection({ nodes }: InspectorBulkBackgroundSectionProps) {
  const setElementsBackgroundField = useEditorStore((state) => state.setElementsBackgroundField);
  const ids = nodes.map((node) => node.id);

  // BC-10.3: the effective colour (a Button renders its own dark default), not just what was typed.
  const measured = useRenderedStyles(ids, BACKGROUND_MEASURED);
  const authoredColors = nodes.map((node) => absoluteAuthoredColor(getBackgroundSettings(node).color));
  const color = resolveSharedEffective(
    nodes.map((node, index) => effectiveValueOf(node.id, BACKGROUND_COLOR, measured, () => (authoredColors[index] === undefined ? undefined : [authoredColors[index]]))),
    (normalized) => {
      const common = commonAuthored(authoredColors);
      if (common !== undefined) return common;
      // Transparent everywhere, as nobody set a colour: the empty field, as before.
      return normalized === "rgba(0, 0, 0, 0)" ? "" : colorFieldValue(normalized);
    },
  );
  const anyAuthored = nodes.some((node) => getBackgroundSettings(node).color !== undefined);

  return (
    <InspectorSection label="Background">
      <InspectorPropertyRow label="Color" state={effectiveRowState(color, anyAuthored)} reset={<InspectorResetButton onReset={() => setElementsBackgroundField(ids, "color", undefined)} disabled={!(anyAuthored)} label="Reset background color on all selected elements" />}>
        <InspectorBulkTextField
          ariaLabel="Background color"
          shared={color}
          placeholder="#000000"
          onCommit={(value) => {
            if (!isValidCssColor(value)) return;
            setElementsBackgroundField(ids, "color", value);
          }}
        />
      </InspectorPropertyRow>
    </InspectorSection>
  );
}

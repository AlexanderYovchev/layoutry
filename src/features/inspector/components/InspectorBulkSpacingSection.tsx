"use client";

import { InspectorBulkNumberField } from "@/features/inspector/components/InspectorBulkNumberField";
import { InspectorPropertyRow } from "@/features/inspector/components/InspectorPropertyRow";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { useRenderedPaddings, type RenderedPadding } from "@/features/inspector/hooks/useRenderedPadding";
import type { SharedValue } from "@/features/inspector/types/sharedValue";
import type { PropertyState } from "@/features/inspector/types/propertyState";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { EDGE_SIDES, getElementSpacing, hasAuthoredEdge, type EdgeValues } from "@/features/editor/types/spacing";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorBulkSpacingSectionProps {
  nodes: readonly EditorElementNode[];
}

/**
 * The one number every side of every node in the selection shows for this
 * box, or "mixed". Each side's effective value is its authored value, else
 * what it renders as (`unset`: the measured padding, or 0 for margin).
 */
function sharedEffectiveValue(boxes: readonly EdgeValues[], unset: (index: number) => RenderedPadding): SharedValue<number> {
  let shared: number | null = null;
  for (const [index, box] of boxes.entries()) {
    const fallback = unset(index);
    for (const side of EDGE_SIDES) {
      const value = box[side] ?? fallback[side];
      if (shared === null) shared = value;
      else if (value !== shared) return { kind: "mixed" };
    }
  }
  return shared === null ? { kind: "mixed" } : { kind: "same", value: shared };
}

/** Mixed when the shown values differ; otherwise set when any node authors this box (0 included), else unset. */
function rowState(shown: SharedValue<number>, boxes: readonly EdgeValues[]): PropertyState {
  if (shown.kind === "mixed") return "mixed";
  return boxes.some((box) => hasAuthoredEdge(box)) ? "set" : "unset";
}

const BASELINE: RenderedPadding = { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * The multi-selection Spacing surface (Checkpoint 1.15.2) — one uniform
 * value per box (Margin, Padding), applied to all four sides of every
 * targeted node in a single commit via setElementsSpacingAllSides. Per-
 * individual-side bulk editing (top/right/bottom/left independently) is
 * deferred, the same scoping choice this checkpoint made for Border.
 *
 * Shown values (BC-05.4): each node's EFFECTIVE spacing, the same values
 * a single selection shows — an authored side as authored (0 included),
 * an unset padding side as the Canvas renders it (useRenderedPaddings: a
 * button's own 8 / 16), an unset margin side as the base stylesheet's 0.
 * The field shows one number only when every side of every selected node
 * has it, else "Mixed". So a button (8 / 16) and a heading (0) read Mixed,
 * and two nodes that both render 16 read 16 even if only one authors it.
 * Nothing measured is ever written: typing still writes exactly the typed
 * value to all four sides of every node, one history entry.
 *
 * The row's state follows authored data, never the shown number: "set"
 * when any selected node authors a side of the box (an authored 0
 * counts), "unset" when none does, "mixed" when the shown values differ.
 */
export function InspectorBulkSpacingSection({ nodes }: InspectorBulkSpacingSectionProps) {
  const setElementsSpacingAllSides = useEditorStore((state) => state.setElementsSpacingAllSides);
  const ids = nodes.map((node) => node.id);

  const margins = nodes.map((node) => getElementSpacing(node).margin);
  const paddings = nodes.map((node) => getElementSpacing(node).padding);
  // Measure only nodes with an unset padding side.
  const rendered = useRenderedPaddings(
    nodes.filter((_node, index) => EDGE_SIDES.some((side) => paddings[index][side] === undefined)).map((node) => node.id),
  );

  const margin = sharedEffectiveValue(margins, () => BASELINE);
  const padding = sharedEffectiveValue(paddings, (index) => rendered?.get(nodes[index].id) ?? BASELINE);

  return (
    <InspectorSection label="Spacing">
      <InspectorPropertyRow label="Margin" state={rowState(margin, margins)}>
        <InspectorBulkNumberField ariaLabel="Margin" shared={margin} onCommit={(value) => setElementsSpacingAllSides(ids, "margin", value)} />
      </InspectorPropertyRow>
      <InspectorPropertyRow label="Padding" state={rowState(padding, paddings)}>
        <InspectorBulkNumberField ariaLabel="Padding" shared={padding} onCommit={(value) => setElementsSpacingAllSides(ids, "padding", value)} />
      </InspectorPropertyRow>
    </InspectorSection>
  );
}

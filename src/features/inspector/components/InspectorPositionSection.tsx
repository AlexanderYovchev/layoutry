"use client";

import { InspectorResetButton } from "@/features/inspector/components/InspectorResetButton";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { InspectorSegmentedRow } from "@/features/inspector/components/InspectorSegmentedRow";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { getPositionSettings, withPositionField, POSITION_VALUES, type PositionValue } from "@/features/editor/types/position";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorPositionSectionProps {
  node: EditorElementNode;
}

/**
 * Structured per-value copy (Checkpoint 5.1's own requirement — "should
 * come from structured metadata, not hardcoded into the component"),
 * consumed below via InspectorSegmentedRow's own optionTooltips prop
 * (native `title` per option button) — the same tooltip affordance every
 * other Inspector enum control already uses.
 */
const POSITION_VALUE_METADATA: Record<PositionValue, { label: string; description: string }> = {
  static: { label: "Static", description: "Default document flow. Offsets are ignored." },
  relative: { label: "Relative", description: "Remains in normal flow. Can later be offset." },
  absolute: { label: "Absolute", description: "Removed from normal flow. Positioned relative to its containing block." },
  fixed: { label: "Fixed", description: "Positioned relative to the viewport." },
  sticky: { label: "Sticky", description: "Behaves relatively until a scroll threshold." },
};

const POSITION_OPTIONS = POSITION_VALUES.map((value) => POSITION_VALUE_METADATA[value].label);
const LABEL_TO_VALUE = Object.fromEntries(
  POSITION_VALUES.map((value) => [POSITION_VALUE_METADATA[value].label, value]),
) as Record<string, PositionValue>;
const VALUE_TO_LABEL = Object.fromEntries(
  POSITION_VALUES.map((value) => [value, POSITION_VALUE_METADATA[value].label]),
) as Record<PositionValue, string>;
const OPTION_TOOLTIPS = Object.fromEntries(
  POSITION_VALUES.map((value) => [POSITION_VALUE_METADATA[value].label, POSITION_VALUE_METADATA[value].description]),
);

/** Matches no real option — same "don't falsely highlight an unset property" convention InspectorDisplaySection/InspectorBorderSection established (Checkpoint 4.2 caught a real bug from skipping this). */
const NO_ACTIVE_OPTION = "";

/**
 * The Position Foundation section (Checkpoint 5.1) — built entirely on
 * the Checkpoint 4.1 shared primitives, same as Display. A single enum
 * field (no free-text entry, so no UI-level validation error state is
 * needed — invalid *documents* are still handled defensively by
 * resolvePositionStyle, never by this component). Commits through the
 * single setElementPosition store action (one pushHistory per commit,
 * matching Display — no continuous-drag field exists here), reads its
 * current value via getPositionSettings (never synthesizes a default),
 * and resets via withPositionField(..., undefined), which clears the
 * field back to genuinely absent — the brief's own "Reset returns
 * Position to: static" is exactly what an absent field already renders
 * as (resolvePositionStyle emits no `position` CSS at all, so the
 * browser's own static default governs), matching every other section's
 * "absent, not a synthesized explicit default" reset philosophy.
 *
 * This section deliberately renders no Top/Left/Inset/Z-index controls —
 * out of scope for this checkpoint (see the brief's own Non-goals) and
 * left for 5.2/5.3 to add as new fields on this same PositionSettings
 * object.
 *
 * Callers must not render this section for a Free-layout child or a
 * Free-hosting container — see InspectorNodeSummary, which owns that
 * gating, and types/position.ts's own doc comment for why: Free layout
 * already owns the CSS `position` property on those specific nodes.
 */
export function InspectorPositionSection({ node }: InspectorPositionSectionProps) {
  const setElementPosition = useEditorStore((state) => state.setElementPosition);
  const position = getPositionSettings(node);
  const isSet = position.position !== undefined;

  function handleSelect(label: string) {
    setElementPosition(node.id, withPositionField(position, "position", LABEL_TO_VALUE[label]));
  }

  function handleReset() {
    setElementPosition(node.id, withPositionField(position, "position", undefined));
  }

  return (
    <InspectorSection label="Position" defaultOpen>
      <InspectorSegmentedRow
        label="Position"
        options={POSITION_OPTIONS}
        activeOption={isSet ? VALUE_TO_LABEL[position.position as PositionValue] : NO_ACTIVE_OPTION}
        onSelect={handleSelect}
        optionTooltips={OPTION_TOOLTIPS}
        state={isSet ? "set" : "unset"}
        reset={<InspectorResetButton onReset={handleReset} disabled={!isSet} label="Reset position" />}
      />
    </InspectorSection>
  );
}

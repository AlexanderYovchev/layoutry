"use client";

import { useState } from "react";
import { InspectorBooleanToggle } from "@/features/inspector/components/InspectorBooleanToggle";
import { InspectorLinkToggle } from "@/features/inspector/components/InspectorLinkToggle";
import { InspectorNumberFieldRow } from "@/features/inspector/components/InspectorNumberFieldRow";
import { InspectorPropertyRow } from "@/features/inspector/components/InspectorPropertyRow";
import { InspectorSliderField } from "@/features/inspector/components/InspectorSliderField";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { InspectorSegmentedRow } from "@/features/inspector/components/InspectorSegmentedRow";
import { useConvertContainerToFreeLayout } from "@/features/editor/hooks/useConvertContainerToFreeLayout";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { getLayoutMode, resolveChildResizePolicy } from "@/features/editor/types/layout";
import {
  getFlexContainerSettings,
  getFlowLayoutSettings,
  getGridContainerSettings,
} from "@/features/editor/types/flowLayout";
import type {
  AlignItems,
  FlexDirection,
  FlexWrap,
  FlowDisplayMode,
  GridTrackPreset,
  JustifyContent,
} from "@/features/editor/types/flowLayout";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorLayoutSectionProps {
  /** The selected node — rendered only when it can contain children (see InspectorNodeSummary). */
  node: EditorElementNode;
}

const LAYOUT_MODE_OPTIONS = ["Flow", "Free"];
const RESIZE_POLICY_OPTIONS = ["Scale", "Clamp"];
const DISPLAY_OPTIONS = ["Block", "Flex", "Grid"];
const DIRECTION_OPTIONS = ["Row", "Column"];
const WRAP_OPTIONS = ["No wrap", "Wrap"];
const JUSTIFY_OPTIONS = ["Start", "Center", "End", "Space between", "Space around", "Space evenly"];
const ALIGN_OPTIONS = ["Start", "Center", "End", "Stretch"];
const GRID_COLUMN_OPTIONS = ["1", "2", "3", "4"];
const GRID_ROW_OPTIONS = ["Auto", "1", "2", "3", "4"];

const DISPLAY_LABEL_TO_VALUE: Record<string, FlowDisplayMode> = { Block: "block", Flex: "flex", Grid: "grid" };
const DISPLAY_VALUE_TO_LABEL: Record<FlowDisplayMode, string> = { block: "Block", flex: "Flex", grid: "Grid" };

const DIRECTION_LABEL_TO_VALUE: Record<string, FlexDirection> = { Row: "row", Column: "column" };
const WRAP_LABEL_TO_VALUE: Record<string, FlexWrap> = { "No wrap": "nowrap", Wrap: "wrap" };
const JUSTIFY_LABEL_TO_VALUE: Record<string, JustifyContent> = {
  Start: "start",
  Center: "center",
  End: "end",
  "Space between": "space-between",
  "Space around": "space-around",
  "Space evenly": "space-evenly",
};
const JUSTIFY_VALUE_TO_LABEL: Record<JustifyContent, string> = {
  start: "Start",
  center: "Center",
  end: "End",
  "space-between": "Space between",
  "space-around": "Space around",
  "space-evenly": "Space evenly",
};
const ALIGN_LABEL_TO_VALUE: Record<string, AlignItems> = { Start: "start", Center: "center", End: "end", Stretch: "stretch" };
const ALIGN_VALUE_TO_LABEL: Record<AlignItems, string> = { start: "Start", center: "Center", end: "End", stretch: "Stretch" };

/**
 * Layout mode (Flow/Free) — and, depending on mode, either Free's
 * Resize-contents policy, or Flow's Display (Block/Flex/Grid) plus that
 * display's own controls (Checkpoint 3.5). Switching to Free goes
 * through useConvertContainerToFreeLayout (one atomic, one-history-entry
 * measurement + write); every other control here is an already-atomic
 * discrete store action. Free and Flow controls are mutually exclusive,
 * matching the spec's explicit "do not show active Flex/Grid controls in
 * Free mode" requirement.
 */
export function InspectorLayoutSection({ node }: InspectorLayoutSectionProps) {
  const convertToFreeLayout = useConvertContainerToFreeLayout();
  const convertToFlowLayout = useEditorStore((state) => state.convertToFlowLayout);
  const setChildResizePolicy = useEditorStore((state) => state.setChildResizePolicy);
  const setFlowDisplayMode = useEditorStore((state) => state.setFlowDisplayMode);
  const setFlexContainerSettings = useEditorStore((state) => state.setFlexContainerSettings);
  const setGridContainerSettings = useEditorStore((state) => state.setGridContainerSettings);
  const snapEnabled = useEditorStore((state) => state.snapEnabled);
  const setSnapEnabled = useEditorStore((state) => state.setSnapEnabled);

  const isFree = getLayoutMode(node) === "free";

  function handleLayoutModeSelect(option: string) {
    if (option === "Free" && !isFree) convertToFreeLayout(node.id);
    if (option === "Flow" && isFree) convertToFlowLayout(node.id);
  }

  function handlePolicySelect(option: string) {
    setChildResizePolicy(node.id, option === "Clamp" ? "clamp" : "scale");
  }

  const display = getFlowLayoutSettings(node).display;

  function handleDisplaySelect(option: string) {
    setFlowDisplayMode(node.id, DISPLAY_LABEL_TO_VALUE[option]);
  }

  return (
    <InspectorSection label="Content Layout" defaultOpen>
      <InspectorSegmentedRow
        label="Layout mode"
        help="Flow keeps elements in reading order and respects this checkpoint's own child-containment rules. Free lets you position elements freely, like on a canvas — overlap becomes possible here, deliberately."
        options={LAYOUT_MODE_OPTIONS}
        activeOption={isFree ? "Free" : "Flow"}
        onSelect={handleLayoutModeSelect}
      />
      {isFree ? (
        <>
          <InspectorSegmentedRow
            label="Resize contents"
            options={RESIZE_POLICY_OPTIONS}
            activeOption={resolveChildResizePolicy(node) === "clamp" ? "Clamp" : "Scale"}
            onSelect={handlePolicySelect}
          />
          <InspectorPropertyRow
            label="Snap"
            help="Helps align freely positioned children to the parent's edges/center and to sibling edges/centers while dragging. Editor assistance only — it never changes what's stored, only where a drag lands."
          >
            <InspectorBooleanToggle checked={snapEnabled} onChange={setSnapEnabled} label="Snap" />
          </InspectorPropertyRow>
        </>
      ) : (
        <>
          <InspectorSegmentedRow
            label="Display"
            options={DISPLAY_OPTIONS}
            activeOption={DISPLAY_VALUE_TO_LABEL[display]}
            onSelect={handleDisplaySelect}
          />
          {display === "block" && (
            <p className="px-0.5 text-[11px] text-fg-secondary">
              Block keeps children stacked in reading order. Switch Display to Flex for horizontal
              layout and alignment/distribution controls.
            </p>
          )}
          {display === "flex" && (
            <FlexContainerControls
              node={node}
              onChange={(settings) => setFlexContainerSettings(node.id, settings)}
            />
          )}
          {display === "grid" && (
            <GridContainerControls
              node={node}
              onChange={(settings) => setGridContainerSettings(node.id, settings)}
            />
          )}
        </>
      )}
    </InspectorSection>
  );
}

interface FlexContainerControlsProps {
  node: EditorElementNode;
  onChange: (settings: ReturnType<typeof getFlexContainerSettings>) => void;
}

function FlexContainerControls({ node, onChange }: FlexContainerControlsProps) {
  const setFlexContainerSettingsLive = useEditorStore((state) => state.setFlexContainerSettingsLive);
  const flex = getFlexContainerSettings(node);
  const [gapLinked, setGapLinked] = useState(() => flex.rowGap === flex.columnGap);

  // Re-derives the Gap linked/unlinked toggle only when the *selection*
  // itself changes — see InspectorGridChildSection/InspectorFlexChildSection/
  // InspectorSpacingSection's identical fix for why a plain useState
  // initializer alone leaves this stuck at whichever Flex container was
  // selected first (this component stays mounted at the same tree
  // position across selections of different Flex containers).
  const [lastNodeId, setLastNodeId] = useState(node.id);
  if (node.id !== lastNodeId) {
    setLastNodeId(node.id);
    setGapLinked(flex.rowGap === flex.columnGap);
  }

  return (
    <>
      <InspectorSegmentedRow
        label="Direction"
        options={DIRECTION_OPTIONS}
        activeOption={flex.direction === "column" ? "Column" : "Row"}
        onSelect={(option) => onChange({ ...flex, direction: DIRECTION_LABEL_TO_VALUE[option] })}
      />
      <InspectorSegmentedRow
        label="Wrap"
        options={WRAP_OPTIONS}
        activeOption={flex.wrap === "wrap" ? "Wrap" : "No wrap"}
        onSelect={(option) => onChange({ ...flex, wrap: WRAP_LABEL_TO_VALUE[option] })}
      />
      <InspectorSegmentedRow
        label="Justify content"
        help="Controls how children are spaced along the container's main direction."
        options={JUSTIFY_OPTIONS}
        activeOption={JUSTIFY_VALUE_TO_LABEL[flex.justifyContent]}
        onSelect={(option) => onChange({ ...flex, justifyContent: JUSTIFY_LABEL_TO_VALUE[option] })}
      />
      <InspectorSegmentedRow
        label="Align items"
        help="Controls how children line up across the container, perpendicular to its main direction."
        options={ALIGN_OPTIONS}
        activeOption={ALIGN_VALUE_TO_LABEL[flex.alignItems]}
        onSelect={(option) => onChange({ ...flex, alignItems: ALIGN_LABEL_TO_VALUE[option] })}
      />
      <InspectorPropertyRow
        label="Gap"
        variant="stack"
        secondary={<InspectorLinkToggle linked={gapLinked} onToggle={() => setGapLinked((prev) => !prev)} />}
      >
        {gapLinked ? (
          <InspectorSliderField
            label="Gap (all)"
            value={flex.rowGap}
            min={0}
            max={128}
            unit="px"
            onLiveChange={(value) => setFlexContainerSettingsLive(node.id, { ...flex, rowGap: value, columnGap: value })}
            onCommit={(value) => onChange({ ...flex, rowGap: Math.max(0, value), columnGap: Math.max(0, value) })}
          />
        ) : (
          <div className="flex w-full flex-col gap-1.5">
            <InspectorNumberFieldRow
              live
              label="Row gap"
              value={flex.rowGap}
              onCommit={(value) => onChange({ ...flex, rowGap: Math.max(0, value) })}
            />
            <InspectorNumberFieldRow
              live
              label="Column gap"
              value={flex.columnGap}
              onCommit={(value) => onChange({ ...flex, columnGap: Math.max(0, value) })}
            />
          </div>
        )}
      </InspectorPropertyRow>
    </>
  );
}

interface GridContainerControlsProps {
  node: EditorElementNode;
  onChange: (settings: ReturnType<typeof getGridContainerSettings>) => void;
}

function GridContainerControls({ node, onChange }: GridContainerControlsProps) {
  const grid = getGridContainerSettings(node);

  return (
    <>
      <InspectorSegmentedRow
        label="Columns"
        options={GRID_COLUMN_OPTIONS}
        activeOption={String(grid.columns)}
        onSelect={(option) => onChange({ ...grid, columns: Number(option) as GridTrackPreset })}
      />
      <InspectorSegmentedRow
        label="Rows"
        options={GRID_ROW_OPTIONS}
        activeOption={grid.rows === "auto" ? "Auto" : String(grid.rows)}
        onSelect={(option) =>
          onChange({ ...grid, rows: option === "Auto" ? "auto" : (Number(option) as GridTrackPreset) })
        }
      />
      <InspectorNumberFieldRow
        live
        label="Row gap"
        value={grid.rowGap}
        onCommit={(value) => onChange({ ...grid, rowGap: Math.max(0, value) })}
      />
      <InspectorNumberFieldRow
        live
        label="Column gap"
        value={grid.columnGap}
        onCommit={(value) => onChange({ ...grid, columnGap: Math.max(0, value) })}
      />
    </>
  );
}

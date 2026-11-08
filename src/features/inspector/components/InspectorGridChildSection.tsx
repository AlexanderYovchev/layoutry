"use client";

import { useState } from "react";
import { InspectorNumberFieldRow } from "@/features/inspector/components/InspectorNumberFieldRow";
import { InspectorResetButton } from "@/features/inspector/components/InspectorResetButton";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { InspectorSegmentedRow } from "@/features/inspector/components/InspectorSegmentedRow";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { DEFAULT_GRID_CHILD_SETTINGS, getGridChildSettings } from "@/features/editor/types/flowLayout";
import type { GridChildSettings } from "@/features/editor/types/flowLayout";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorGridChildSectionProps {
  /** The selected node — rendered only when its own parent's resolved flowLayout.display is "grid" (see InspectorNodeSummary). */
  node: EditorElementNode;
}

const START_MODE_OPTIONS = ["Auto", "Fixed"];

/**
 * A Grid child's own column/row placement (Checkpoint 3.5) — mutually
 * exclusive with InspectorFreeGeometryFields and InspectorFlexChildSection
 * (see InspectorNodeSummary). Column/row start toggle between "Auto" (grid
 * auto-placement) and a fixed track number; the store action clamps the
 * committed value against the parent's current track count, so this UI
 * stays permissive rather than duplicating that bounds logic.
 */
export function InspectorGridChildSection({ node }: InspectorGridChildSectionProps) {
  const setGridChildSettings = useEditorStore((state) => state.setGridChildSettings);
  const gridChild = getGridChildSettings(node);
  const [columnStartFixed, setColumnStartFixed] = useState(() => gridChild.columnStart !== "auto");
  const [rowStartFixed, setRowStartFixed] = useState(() => gridChild.rowStart !== "auto");

  // Re-derives both Fixed/Auto toggles from the newly-selected node's own
  // gridChild the moment the *selection itself* changes (not on every
  // re-render — e.g. a live commit to the same node must not stomp the
  // user's just-clicked toggle). Selecting a different sibling under the
  // same Grid parent keeps this component mounted at the same tree
  // position (same node type, same props shape), so plain useState
  // initializers only run once and would otherwise leave these toggles
  // permanently stuck at whichever child was selected first — this is
  // React's documented "adjusting state when a prop changes" pattern
  // (reset during render, not in a useEffect), the same one
  // InspectorNumberFieldRow already uses for its own external-sync case.
  const [lastNodeId, setLastNodeId] = useState(node.id);
  if (node.id !== lastNodeId) {
    setLastNodeId(node.id);
    setColumnStartFixed(gridChild.columnStart !== "auto");
    setRowStartFixed(gridChild.rowStart !== "auto");
  }

  function commit(patch: Partial<GridChildSettings>) {
    setGridChildSettings(node.id, { ...gridChild, ...patch });
  }

  // BC-05.2 reset, as in InspectorFlexChildSection: a field is authored when
  // the record exists and differs from the model default; resetting writes
  // the default back, and the record is removed once nothing differs.
  const isAuthored = (field: keyof GridChildSettings) => node.gridChild !== undefined && node.gridChild[field] !== DEFAULT_GRID_CHILD_SETTINGS[field];
  const stateOf = (field: keyof GridChildSettings) => (isAuthored(field) ? "set" : "unset");

  function resetField(field: keyof GridChildSettings) {
    const next: GridChildSettings = { ...gridChild, [field]: DEFAULT_GRID_CHILD_SETTINGS[field] };
    const allDefault = (Object.keys(DEFAULT_GRID_CHILD_SETTINGS) as (keyof GridChildSettings)[]).every((key) => next[key] === DEFAULT_GRID_CHILD_SETTINGS[key]);
    if (field === "columnStart") setColumnStartFixed(false);
    if (field === "rowStart") setRowStartFixed(false);
    setGridChildSettings(node.id, allDefault ? undefined : next);
  }

  function resetAll() {
    setColumnStartFixed(false);
    setRowStartFixed(false);
    setGridChildSettings(node.id, undefined);
  }

  const fieldReset = (field: keyof GridChildSettings, label: string) => (
    <InspectorResetButton onReset={() => resetField(field)} disabled={!isAuthored(field)} label={`Reset ${label}`} />
  );

  return (
    <InspectorSection
      label="Grid item"
      defaultOpen
      actions={<InspectorResetButton onReset={resetAll} disabled={node.gridChild === undefined} label="Reset grid item" />}
    >
      <InspectorSegmentedRow
        label="Column start"
        state={stateOf("columnStart")}
        reset={fieldReset("columnStart", "column start")}
        options={START_MODE_OPTIONS}
        activeOption={columnStartFixed ? "Fixed" : "Auto"}
        onSelect={(option) => {
          const fixed = option === "Fixed";
          setColumnStartFixed(fixed);
          commit({ columnStart: fixed ? (gridChild.columnStart === "auto" ? 1 : gridChild.columnStart) : "auto" });
        }}
      />
      {columnStartFixed && (
        <InspectorNumberFieldRow
          live
          label="Column start value"
          value={typeof gridChild.columnStart === "number" ? gridChild.columnStart : 1}
          onCommit={(value) => commit({ columnStart: Math.max(1, Math.round(value)) })}
        />
      )}
      <InspectorNumberFieldRow
        live
        label="Column span"
        state={stateOf("columnSpan")}
        reset={fieldReset("columnSpan", "column span")}
        value={gridChild.columnSpan}
        onCommit={(value) => commit({ columnSpan: Math.max(1, Math.round(value)) })}
      />
      <InspectorSegmentedRow
        label="Row start"
        state={stateOf("rowStart")}
        reset={fieldReset("rowStart", "row start")}
        options={START_MODE_OPTIONS}
        activeOption={rowStartFixed ? "Fixed" : "Auto"}
        onSelect={(option) => {
          const fixed = option === "Fixed";
          setRowStartFixed(fixed);
          commit({ rowStart: fixed ? (gridChild.rowStart === "auto" ? 1 : gridChild.rowStart) : "auto" });
        }}
      />
      {rowStartFixed && (
        <InspectorNumberFieldRow
          live
          label="Row start value"
          value={typeof gridChild.rowStart === "number" ? gridChild.rowStart : 1}
          onCommit={(value) => commit({ rowStart: Math.max(1, Math.round(value)) })}
        />
      )}
      <InspectorNumberFieldRow
        live
        label="Row span"
        state={stateOf("rowSpan")}
        reset={fieldReset("rowSpan", "row span")}
        value={gridChild.rowSpan}
        onCommit={(value) => commit({ rowSpan: Math.max(1, Math.round(value)) })}
      />
    </InspectorSection>
  );
}

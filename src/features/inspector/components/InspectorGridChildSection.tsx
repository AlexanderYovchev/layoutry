"use client";

import { useState } from "react";
import { InspectorNumberFieldRow } from "@/features/inspector/components/InspectorNumberFieldRow";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { InspectorSegmentedRow } from "@/features/inspector/components/InspectorSegmentedRow";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { getGridChildSettings } from "@/features/editor/types/flowLayout";
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

  return (
    <InspectorSection label="Grid item" defaultOpen>
      <InspectorSegmentedRow
        label="Column start"
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
          label="Column start value"
          value={typeof gridChild.columnStart === "number" ? gridChild.columnStart : 1}
          onCommit={(value) => commit({ columnStart: Math.max(1, Math.round(value)) })}
        />
      )}
      <InspectorNumberFieldRow
        label="Column span"
        value={gridChild.columnSpan}
        onCommit={(value) => commit({ columnSpan: Math.max(1, Math.round(value)) })}
      />
      <InspectorSegmentedRow
        label="Row start"
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
          label="Row start value"
          value={typeof gridChild.rowStart === "number" ? gridChild.rowStart : 1}
          onCommit={(value) => commit({ rowStart: Math.max(1, Math.round(value)) })}
        />
      )}
      <InspectorNumberFieldRow
        label="Row span"
        value={gridChild.rowSpan}
        onCommit={(value) => commit({ rowSpan: Math.max(1, Math.round(value)) })}
      />
    </InspectorSection>
  );
}

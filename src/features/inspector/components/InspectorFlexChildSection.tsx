"use client";

import { useState } from "react";
import { InspectorNumberFieldRow } from "@/features/inspector/components/InspectorNumberFieldRow";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { InspectorSegmentedRow } from "@/features/inspector/components/InspectorSegmentedRow";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { getFlexChildSettings } from "@/features/editor/types/flowLayout";
import type { AlignSelf, FlexChildSettings } from "@/features/editor/types/flowLayout";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorFlexChildSectionProps {
  /** The selected node — rendered only when its own parent's resolved flowLayout.display is "flex" (see InspectorNodeSummary). */
  node: EditorElementNode;
}

const BASIS_MODE_OPTIONS = ["Auto", "Fixed"];
const ALIGN_SELF_OPTIONS = ["Auto", "Start", "Center", "End", "Stretch"];
const ALIGN_SELF_LABEL_TO_VALUE: Record<string, AlignSelf> = {
  Auto: "auto",
  Start: "start",
  Center: "center",
  End: "end",
  Stretch: "stretch",
};
const ALIGN_SELF_VALUE_TO_LABEL: Record<AlignSelf, string> = {
  auto: "Auto",
  start: "Start",
  center: "Center",
  end: "End",
  stretch: "Stretch",
};

/**
 * A Flex child's own grow/shrink/basis/align-self (Checkpoint 3.5) —
 * mutually exclusive with InspectorFreeGeometryFields and
 * InspectorGridChildSection (see InspectorNodeSummary, gated on the
 * parent's resolved flowLayout.display). Basis toggles between "Auto"
 * and a fixed pixel value rather than exposing raw CSS flex-basis syntax.
 */
export function InspectorFlexChildSection({ node }: InspectorFlexChildSectionProps) {
  const setFlexChildSettings = useEditorStore((state) => state.setFlexChildSettings);
  const flexChild = getFlexChildSettings(node);
  const [basisFixed, setBasisFixed] = useState(() => flexChild.basis !== "auto");

  // Re-derives the Basis Fixed/Auto toggle from the newly-selected node's
  // own flexChild the moment the *selection itself* changes — see
  // InspectorGridChildSection's identical fix for why a plain useState
  // initializer alone leaves this stuck at whichever sibling was
  // selected first (this component stays mounted at the same tree
  // position across sibling selections).
  const [lastNodeId, setLastNodeId] = useState(node.id);
  if (node.id !== lastNodeId) {
    setLastNodeId(node.id);
    setBasisFixed(flexChild.basis !== "auto");
  }

  function commit(patch: Partial<FlexChildSettings>) {
    setFlexChildSettings(node.id, { ...flexChild, ...patch });
  }

  return (
    <InspectorSection label="Flex item" defaultOpen>
      <InspectorNumberFieldRow
        live
        label="Grow"
        value={flexChild.grow}
        onCommit={(value) => commit({ grow: Math.max(0, value) })}
      />
      <InspectorNumberFieldRow
        live
        label="Shrink"
        value={flexChild.shrink}
        onCommit={(value) => commit({ shrink: Math.max(0, value) })}
      />
      <InspectorSegmentedRow
        label="Basis"
        options={BASIS_MODE_OPTIONS}
        activeOption={basisFixed ? "Fixed" : "Auto"}
        onSelect={(option) => {
          const fixed = option === "Fixed";
          setBasisFixed(fixed);
          commit({ basis: fixed ? (flexChild.basis === "auto" ? 0 : flexChild.basis) : "auto" });
        }}
      />
      {basisFixed && (
        <InspectorNumberFieldRow
          live
          label="Basis (px)"
          value={typeof flexChild.basis === "number" ? flexChild.basis : 0}
          onCommit={(value) => commit({ basis: Math.max(0, value) })}
        />
      )}
      <InspectorSegmentedRow
        label="Align self"
        options={ALIGN_SELF_OPTIONS}
        activeOption={ALIGN_SELF_VALUE_TO_LABEL[flexChild.alignSelf]}
        onSelect={(option) => commit({ alignSelf: ALIGN_SELF_LABEL_TO_VALUE[option] })}
      />
    </InspectorSection>
  );
}

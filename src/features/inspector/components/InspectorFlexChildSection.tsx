"use client";

import { useState } from "react";
import { InspectorNumberFieldRow } from "@/features/inspector/components/InspectorNumberFieldRow";
import { InspectorResetButton } from "@/features/inspector/components/InspectorResetButton";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { InspectorSegmentedRow } from "@/features/inspector/components/InspectorSegmentedRow";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { DEFAULT_FLEX_CHILD_SETTINGS, getFlexChildSettings } from "@/features/editor/types/flowLayout";
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

  // BC-05.2 reset: a field is authored when the record exists and the field
  // differs from the model default. Resetting writes the default back; once
  // every field is at its default the record is removed, because an absent
  // record is what the element had before any edit (a resized element only
  // stops shrinking without one — see resolveFlexOrGridChildStyle).
  const isAuthored = (field: keyof FlexChildSettings) => node.flexChild !== undefined && node.flexChild[field] !== DEFAULT_FLEX_CHILD_SETTINGS[field];
  const stateOf = (field: keyof FlexChildSettings) => (isAuthored(field) ? "set" : "unset");

  function resetField(field: keyof FlexChildSettings) {
    const next: FlexChildSettings = { ...flexChild, [field]: DEFAULT_FLEX_CHILD_SETTINGS[field] };
    const allDefault = (Object.keys(DEFAULT_FLEX_CHILD_SETTINGS) as (keyof FlexChildSettings)[]).every((key) => next[key] === DEFAULT_FLEX_CHILD_SETTINGS[key]);
    if (field === "basis") setBasisFixed(false);
    setFlexChildSettings(node.id, allDefault ? undefined : next);
  }

  function resetAll() {
    setBasisFixed(false);
    setFlexChildSettings(node.id, undefined);
  }

  const fieldReset = (field: keyof FlexChildSettings, label: string) => (
    <InspectorResetButton onReset={() => resetField(field)} disabled={!isAuthored(field)} label={`Reset ${label}`} />
  );

  return (
    <InspectorSection
      label="Flex item"
      defaultOpen
      actions={<InspectorResetButton onReset={resetAll} disabled={node.flexChild === undefined} label="Reset flex item" />}
    >
      <InspectorNumberFieldRow
        live
        label="Grow"
        state={stateOf("grow")}
        reset={fieldReset("grow", "grow")}
        value={flexChild.grow}
        onCommit={(value) => commit({ grow: Math.max(0, value) })}
      />
      <InspectorNumberFieldRow
        live
        label="Shrink"
        state={stateOf("shrink")}
        reset={fieldReset("shrink", "shrink")}
        value={flexChild.shrink}
        onCommit={(value) => commit({ shrink: Math.max(0, value) })}
      />
      <InspectorSegmentedRow
        label="Basis"
        state={stateOf("basis")}
        reset={fieldReset("basis", "basis")}
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
        state={stateOf("alignSelf")}
        reset={fieldReset("alignSelf", "align self")}
        options={ALIGN_SELF_OPTIONS}
        activeOption={ALIGN_SELF_VALUE_TO_LABEL[flexChild.alignSelf]}
        onSelect={(option) => commit({ alignSelf: ALIGN_SELF_LABEL_TO_VALUE[option] })}
      />
    </InspectorSection>
  );
}

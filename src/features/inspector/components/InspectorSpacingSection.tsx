"use client";

import { useState } from "react";
import { InspectorLinkToggle } from "@/features/inspector/components/InspectorLinkToggle";
import { InspectorNumericValueControl } from "@/features/inspector/components/InspectorNumericValueControl";
import { InspectorPropertyRow } from "@/features/inspector/components/InspectorPropertyRow";
import { InspectorResetButton } from "@/features/inspector/components/InspectorResetButton";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { clampEdgeValues, getElementSpacing, SPACING_MAX_PX, SPACING_MIN_PX, ZERO_EDGES } from "@/features/editor/types/spacing";
import type { EdgeValues } from "@/features/editor/types/spacing";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorSpacingSectionProps {
  node: EditorElementNode;
}

interface EdgeGroupProps {
  label: string;
  values: EdgeValues;
  onCommit: (edges: EdgeValues) => void;
  /** The owning node's id, used only to detect a *selection* change (see the reset below) — never read for any other purpose. */
  nodeId: string;
}

const EDGE_SIDES = ["top", "right", "bottom", "left"] as const;
const EDGE_SIDE_LABELS: Record<(typeof EDGE_SIDES)[number], string> = {
  top: "Top",
  right: "Right",
  bottom: "Bottom",
  left: "Left",
};

function allSidesEqual(values: EdgeValues): boolean {
  return values.top === values.right && values.right === values.bottom && values.bottom === values.left;
}

/**
 * One margin or padding group — a link/unlink toggle over either a single
 * "all sides" field (linked, the common case) or four independent
 * Top/Right/Bottom/Left fields (unlinked). Built on the Checkpoint 4.1
 * shared primitives (InspectorPropertyRow's "stack" variant, which is
 * exactly the "labelled control group expanding vertically beneath its
 * label" case that primitive was designed for, InspectorNumericValueControl,
 * InspectorLinkToggle, InspectorResetButton) as this checkpoint's proof
 * integration — same setElementMargin/setElementPadding commands, same
 * clampEdgeValues validation, and the same accessible names
 * ("Margin (all sides)"/"Top"/"Right"/"Bottom"/"Left") the previous
 * hand-rolled implementation used, so existing behavior is unchanged.
 * "Set" vs "unset" is a value-based heuristic (all-zero counts as unset,
 * matching the spacing model's own documented zero default — see
 * ZERO_EDGES) rather than a genuine per-property explicit flag, since the
 * document model stores margin/padding as one required EdgeValues object,
 * not an optional-per-side value; see the checkpoint report's Known
 * Limitations for why a real flag is a domain-model change out of scope
 * here.
 */
function EdgeGroup({ label, values, onCommit, nodeId }: EdgeGroupProps) {
  const [linked, setLinked] = useState(() => allSidesEqual(values));

  // Re-derives the linked/unlinked toggle only when the *selection*
  // itself changes, not on every values update (a user unlinking and
  // editing just one side must not snap back to "linked" just because
  // that edit made the four sides differ). Selecting a different
  // sibling keeps this component mounted at the same tree position, so
  // a plain useState initializer alone would leave this toggle stuck at
  // whichever node was selected first — same fix as
  // InspectorGridChildSection/InspectorFlexChildSection.
  const [lastNodeId, setLastNodeId] = useState(nodeId);
  if (nodeId !== lastNodeId) {
    setLastNodeId(nodeId);
    setLinked(allSidesEqual(values));
  }

  const isSet = values.top !== 0 || values.right !== 0 || values.bottom !== 0 || values.left !== 0;

  function commitLinked(next: number | "auto") {
    if (typeof next !== "number") return;
    const clamped = clampEdgeValues({ top: next, right: next, bottom: next, left: next });
    if (clamped) onCommit(clamped);
  }

  function commitSide(side: keyof EdgeValues, next: number | "auto") {
    if (typeof next !== "number") return;
    const clamped = clampEdgeValues({ ...values, [side]: next });
    if (clamped) onCommit(clamped);
  }

  return (
    <InspectorPropertyRow
      label={label}
      variant="stack"
      state={isSet ? "set" : "unset"}
      secondary={<InspectorLinkToggle linked={linked} onToggle={() => setLinked((prev) => !prev)} />}
      reset={<InspectorResetButton onReset={() => onCommit(ZERO_EDGES)} disabled={!isSet} label={`Reset ${label.toLowerCase()}`} />}
    >
      {linked ? (
        <InspectorNumericValueControl
          ariaLabel={`${label} (all sides)`}
          value={values.top}
          min={SPACING_MIN_PX}
          max={SPACING_MAX_PX}
          unit="px"
          allowedUnits={["px"]}
          onCommit={commitLinked}
        />
      ) : (
        <div className="flex w-full flex-col gap-1.5">
          {EDGE_SIDES.map((side) => (
            <div key={side} className="flex items-center justify-between gap-2 text-xs">
              <span className="text-zinc-500 dark:text-zinc-400">{EDGE_SIDE_LABELS[side]}</span>
              <InspectorNumericValueControl
                ariaLabel={EDGE_SIDE_LABELS[side]}
                value={values[side]}
                min={SPACING_MIN_PX}
                max={SPACING_MAX_PX}
                unit="px"
                allowedUnits={["px"]}
                onCommit={(next) => commitSide(side, next)}
              />
            </div>
          ))}
        </div>
      )}
    </InspectorPropertyRow>
  );
}

/**
 * A simple nested-box illustration of the margin/padding/content
 * relationship — not an interactive graphical editor (explicitly out of
 * scope for this checkpoint), just enough to make the relationship
 * unambiguous alongside the numeric fields below it.
 */
function BoxModelDiagram() {
  return (
    <div
      aria-hidden="true"
      className="rounded border border-dashed border-zinc-300 p-3 text-center text-[9px] font-medium tracking-wide text-zinc-400 uppercase dark:border-zinc-700 dark:text-zinc-500"
    >
      Margin
      <div className="mt-1 rounded border border-zinc-300 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900">
        Padding
        <div className="mt-1 rounded bg-white p-2 normal-case text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
          Content
        </div>
      </div>
    </div>
  );
}

/**
 * Margin + padding controls for any selected element (Checkpoint 3.5) —
 * not just containers, matching "the architecture should safely support
 * padding on any rendered box." Padding changes on a Free container are
 * the containment-critical path: see useEditorStore.setElementPadding,
 * which re-normalizes every direct child into the new content bounds in
 * the same atomic write this section's commit triggers.
 */
export function InspectorSpacingSection({ node }: InspectorSpacingSectionProps) {
  const setElementMargin = useEditorStore((state) => state.setElementMargin);
  const setElementPadding = useEditorStore((state) => state.setElementPadding);
  const spacing = getElementSpacing(node);

  return (
    <InspectorSection label="Spacing" defaultOpen>
      <BoxModelDiagram />
      <EdgeGroup label="Margin" values={spacing.margin} nodeId={node.id} onCommit={(edges) => setElementMargin(node.id, edges)} />
      <EdgeGroup label="Padding" values={spacing.padding} nodeId={node.id} onCommit={(edges) => setElementPadding(node.id, edges)} />
    </InspectorSection>
  );
}

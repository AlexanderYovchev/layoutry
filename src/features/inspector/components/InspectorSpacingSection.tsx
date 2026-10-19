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
  help: string;
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
function EdgeGroup({ label, help, values, onCommit, nodeId }: EdgeGroupProps) {
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
      help={help}
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
              <span className="text-fg-secondary">{EDGE_SIDE_LABELS[side]}</span>
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

interface BoxLayerProps {
  label: string;
  values: EdgeValues;
  className: string;
  children: React.ReactNode;
}

// One ring of the box-model diagram: its four values sit on its four
// sides, around whatever is nested inside it.
function BoxLayer({ label, values, className, children }: BoxLayerProps) {
  return (
    <div className={`relative grid grid-cols-[1.75rem_minmax(0,1fr)_1.75rem] grid-rows-[1.25rem_auto_1.25rem] items-center rounded-control text-center tabular-nums ${className}`}>
      <span className="absolute top-1 left-1.5 text-[9px] font-semibold tracking-wider uppercase opacity-80">{label}</span>
      <span className="col-start-2 row-start-1">{String(values.top)}</span>
      <span className="col-start-1 row-start-2">{String(values.left)}</span>
      <div className="col-start-2 row-start-2 min-w-0">{children}</div>
      <span className="col-start-3 row-start-2">{String(values.right)}</span>
      <span className="col-start-2 row-start-3">{String(values.bottom)}</span>
    </div>
  );
}

/**
 * A compact CSS box-model illustration of this element's current margin
 * and padding (UI-1.5) — a read-only presentation of the same values the
 * numeric fields below edit, never a second source of state or an
 * alternative editing path. aria-hidden: the labeled fields below are
 * the accessible representation of these values.
 */
function BoxModelDiagram({ margin, padding }: { margin: EdgeValues; padding: EdgeValues }) {
  return (
    <div aria-hidden="true" className="text-[11px] font-medium text-fg-secondary">
      <BoxLayer label="Margin" values={margin} className="border border-dashed border-line-strong bg-surface-panel-secondary">
        <BoxLayer label="Padding" values={padding} className="border border-accent/30 bg-surface-selected text-fg-primary">
          <div className="mx-auto flex h-6 max-w-24 items-center justify-center rounded-control-sm border border-line bg-surface-panel text-[10px] font-normal text-fg-secondary">
            Content
          </div>
        </BoxLayer>
      </BoxLayer>
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
      <BoxModelDiagram margin={spacing.margin} padding={spacing.padding} />
      <EdgeGroup
        label="Margin"
        help="The space outside this element, between it and its neighbors."
        values={spacing.margin}
        nodeId={node.id}
        onCommit={(edges) => setElementMargin(node.id, edges)}
      />
      <EdgeGroup
        label="Padding"
        help="The space inside this element, between its edge and its content."
        values={spacing.padding}
        nodeId={node.id}
        onCommit={(edges) => setElementPadding(node.id, edges)}
      />
    </InspectorSection>
  );
}

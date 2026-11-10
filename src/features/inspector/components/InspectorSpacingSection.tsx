"use client";

import { useState } from "react";
import { InspectorLinkToggle } from "@/features/inspector/components/InspectorLinkToggle";
import { InspectorNumericValueControl } from "@/features/inspector/components/InspectorNumericValueControl";
import { InspectorPropertyRow } from "@/features/inspector/components/InspectorPropertyRow";
import { InspectorPropertyStateDot } from "@/features/inspector/components/InspectorPropertyStateDot";
import { InspectorResetButton } from "@/features/inspector/components/InspectorResetButton";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { useRenderedPadding } from "@/features/inspector/hooks/useRenderedPadding";
import { resetScopeProps } from "@/features/inspector/utils/inspectorResetScope";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import {
  clampSpacingValue,
  EDGE_SIDES,
  getElementSpacing,
  hasAuthoredEdge,
  SPACING_MAX_PX,
  SPACING_MIN_PX,
  uniformEdges,
  withEdgeSide,
  type EdgeSide,
  type EdgeValues,
} from "@/features/editor/types/spacing";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorSpacingSectionProps {
  node: EditorElementNode;
}

/** A value for every side: what each field and the diagram show. */
type DisplayedEdges = Record<EdgeSide, number>;

interface EdgeGroupProps {
  label: string;
  help: string;
  /** The authored sides, straight from the model. Absent = unset; 0 is authored. */
  authored: EdgeValues;
  /** What an unset side shows: the rendered value (padding) or the base stylesheet's 0 (margin). */
  displayed: DisplayedEdges;
  /** The whole box; undefined removes it. */
  onCommit: (edges: EdgeValues | undefined) => void;
  /**
   * Changes when the linked/unlinked toggle should be re-derived: a new
   * selection, or the first time an unset side's rendered value is known.
   * Never read for any other purpose.
   */
  syncKey: string;
}

const EDGE_SIDE_LABELS: Record<EdgeSide, string> = {
  top: "Top",
  right: "Right",
  bottom: "Bottom",
  left: "Left",
};

function allSidesEqual(values: DisplayedEdges): boolean {
  return values.top === values.right && values.right === values.bottom && values.bottom === values.left;
}

/** Each side's authored value, else what it renders as. */
function displayedEdges(authored: EdgeValues, fallback: DisplayedEdges): DisplayedEdges {
  return {
    top: authored.top ?? fallback.top,
    right: authored.right ?? fallback.right,
    bottom: authored.bottom ?? fallback.bottom,
    left: authored.left ?? fallback.left,
  };
}

/**
 * One margin or padding group — a link/unlink toggle over either a single
 * "all sides" field (linked, the common case) or four independent
 * Top/Right/Bottom/Left fields (unlinked), on the Checkpoint 4.1 shared
 * primitives.
 *
 * Authored vs unset (BC-05.3): every side is independently optional in
 * the model, and 0 is an authored value. The row's state and its "Reset
 * margin/padding" follow whether any side is authored — never whether a
 * value happens to be 0. An unset side shows what it renders as, not a
 * stored value, so a button's unset padding reads 8 / 16 rather than 0.
 * Typing writes only the side being edited (or all four, linked); in the
 * unlinked view each side has its own state dot and reset, so resetting
 * one side never touches the others. Linked/unlinked is Inspector-local
 * only, never stored.
 */
function EdgeGroup({ label, help, authored, displayed, onCommit, syncKey }: EdgeGroupProps) {
  const [linked, setLinked] = useState(() => allSidesEqual(displayed));

  // Re-derives the linked/unlinked toggle only when the *selection*
  // itself changes, not on every values update (a user unlinking and
  // editing just one side must not snap back to "linked" just because
  // that edit made the four sides differ). Selecting a different
  // sibling keeps this component mounted at the same tree position, so
  // a plain useState initializer alone would leave this toggle stuck at
  // whichever node was selected first — same fix as
  // InspectorGridChildSection/InspectorFlexChildSection. Also re-derived
  // once an unset padding side has been measured (BC-05.3): before that it
  // shows 0, and a button's 8 / 16 padding must open unlinked.
  const [lastSyncKey, setLastSyncKey] = useState(syncKey);
  if (syncKey !== lastSyncKey) {
    setLastSyncKey(syncKey);
    setLinked(allSidesEqual(displayed));
  }

  const isSet = hasAuthoredEdge(authored);
  const lowerLabel = label.toLowerCase();

  function commitLinked(next: number | "auto") {
    if (typeof next !== "number") return;
    const clamped = clampSpacingValue(next);
    if (clamped !== null) onCommit(uniformEdges(clamped));
  }

  function commitSide(side: EdgeSide, next: number | "auto") {
    if (typeof next !== "number") return;
    const clamped = clampSpacingValue(next);
    if (clamped !== null) onCommit(withEdgeSide(authored, side, clamped));
  }

  return (
    <InspectorPropertyRow
      label={label}
      help={help}
      variant="stack"
      state={isSet ? "set" : "unset"}
      secondary={<InspectorLinkToggle linked={linked} onToggle={() => setLinked((prev) => !prev)} />}
      reset={<InspectorResetButton onReset={() => onCommit(undefined)} disabled={!isSet} label={`Reset ${lowerLabel}`} />}
    >
      {linked ? (
        <InspectorNumericValueControl
          ariaLabel={`${label} (all sides)`}
          value={displayed.top}
          min={SPACING_MIN_PX}
          max={SPACING_MAX_PX}
          unit="px"
          allowedUnits={["px"]}
          onCommit={commitLinked}
        />
      ) : (
        <div className="flex w-full flex-col gap-1.5">
          {EDGE_SIDES.map((side) => {
            const sideSet = authored[side] !== undefined;
            return (
              // Label | field | reset. The field's column is the one that
              // gives way (minmax(0, 1fr), down to the field's own minimum
              // width), so the row never runs past a narrow Inspector.
              <div key={side} {...resetScopeProps} className="grid grid-cols-[3.75rem_minmax(0,1fr)_auto] items-center gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <span className="text-fg-secondary">{EDGE_SIDE_LABELS[side]}</span>
                  <InspectorPropertyStateDot state={sideSet ? "set" : "unset"} />
                </div>
                <InspectorNumericValueControl
                  ariaLabel={EDGE_SIDE_LABELS[side]}
                  value={displayed[side]}
                  min={SPACING_MIN_PX}
                  max={SPACING_MAX_PX}
                  unit="px"
                  allowedUnits={["px"]}
                  onCommit={(next) => commitSide(side, next)}
                />
                <InspectorResetButton
                  onReset={() => onCommit(withEdgeSide(authored, side, undefined))}
                  disabled={!sideSet}
                  label={`Reset ${lowerLabel} ${side}`}
                />
              </div>
            );
          })}
        </div>
      )}
    </InspectorPropertyRow>
  );
}

interface BoxLayerProps {
  label: string;
  values: DisplayedEdges;
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
 * numeric fields below show, never a second source of state or an
 * alternative editing path. aria-hidden: the labeled fields below are
 * the accessible representation of these values.
 */
function BoxModelDiagram({ margin, padding }: { margin: DisplayedEdges; padding: DisplayedEdges }) {
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
 * An unset margin side renders 0: the base stylesheet every Canvas,
 * Preview and Export page starts from sets `margin: 0` on every element,
 * and no Layoutry default presentation adds margin. (Measuring it would
 * also pick up the resize-anchor offset, which is not margin the user
 * set.) Unset padding varies by element — a button has its own — so it is
 * measured from the Canvas instead (useRenderedPadding).
 */
const UNSET_MARGIN: DisplayedEdges = { top: 0, right: 0, bottom: 0, left: 0 };

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
  const allPaddingAuthored = EDGE_SIDES.every((side) => spacing.padding[side] !== undefined);
  // 0 only until the first measurement (one layout effect), or for a node that isn't rendered.
  const measuredPadding = useRenderedPadding(allPaddingAuthored ? null : node.id);
  const renderedPadding = measuredPadding ?? UNSET_MARGIN;
  const paddingKnown = allPaddingAuthored || measuredPadding !== null;
  const margin = displayedEdges(spacing.margin, UNSET_MARGIN);
  const padding = displayedEdges(spacing.padding, renderedPadding);

  return (
    <InspectorSection label="Spacing" defaultOpen>
      <BoxModelDiagram margin={margin} padding={padding} />
      <EdgeGroup
        label="Margin"
        help="The space outside this element, between it and its neighbors."
        authored={spacing.margin}
        displayed={margin}
        syncKey={node.id}
        onCommit={(edges) => setElementMargin(node.id, edges)}
      />
      <EdgeGroup
        label="Padding"
        help="The space inside this element, between its edge and its content."
        authored={spacing.padding}
        displayed={padding}
        syncKey={`${node.id}:${paddingKnown}`}
        onCommit={(edges) => setElementPadding(node.id, edges)}
      />
    </InspectorSection>
  );
}

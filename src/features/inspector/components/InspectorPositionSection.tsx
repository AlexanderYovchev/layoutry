"use client";

import { useState } from "react";
import { InspectorLinkToggle } from "@/features/inspector/components/InspectorLinkToggle";
import { InspectorNumericValueControl, type NumericOrAuto } from "@/features/inspector/components/InspectorNumericValueControl";
import { InspectorPropertyRow } from "@/features/inspector/components/InspectorPropertyRow";
import { InspectorResetButton } from "@/features/inspector/components/InspectorResetButton";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { InspectorSegmentedRow } from "@/features/inspector/components/InspectorSegmentedRow";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import {
  getPositionSettings,
  offsetSidesEqual,
  offsetsApply,
  withAllOffsets,
  withPositionField,
  OFFSET_SIDES,
  OFFSET_UNITS,
  POSITION_VALUES,
  type OffsetSide,
  type OffsetValue,
  type PositionSettings,
  type PositionValue,
  type ZIndexValue,
} from "@/features/editor/types/position";
import { ancestorEstablishesStackingContext, establishesStackingContext } from "@/features/editor/utils/stackingContext";
import type { CssUnit } from "@/features/editor/types/typography";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorPositionSectionProps {
  node: EditorElementNode;
}

const OFFSET_SIDE_LABELS: Record<OffsetSide, string> = {
  top: "Top",
  right: "Right",
  bottom: "Bottom",
  left: "Left",
};

/** The number field's displayed value for a given offset — an unset side (undefined) displays as 0, communicated as "unset" separately via the property-state dot/reset-button-disabled affordance rather than by the raw number itself, matching InspectorBorderRadiusSection's targetValue?.value ?? 0 precedent. */
function offsetValueFor(value: OffsetValue | undefined): NumericOrAuto {
  if (value === undefined) return 0;
  return value === "auto" ? "auto" : value.value;
}

/** The unit selector's displayed unit for a given offset — "px" is an arbitrary placeholder while the offset is unset or "auto" (there's no real unit to show yet); matches InspectorBackgroundImageControls' axisUnit precedent exactly, including the same "changing the unit while the value is auto is a no-op" behavior below. */
function offsetUnitFor(value: OffsetValue | undefined): CssUnit {
  if (value === undefined || value === "auto") return "px";
  return value.unit;
}

interface OffsetFieldProps {
  label: string;
  value: OffsetValue | undefined;
  onCommit: (next: NumericOrAuto) => void;
  onUnitChange: (unit: CssUnit) => void;
  onReset: () => void;
}

/** One offset's numeric input + unit selector + reset — the atomic unit both the Linked ("All sides") and Unlinked (Top/Right/Bottom/Left) layouts below are built from, so there is exactly one place this trio of controls is wired together. */
function OffsetField({ label, value, onCommit, onUnitChange, onReset }: OffsetFieldProps) {
  const isSet = value !== undefined;
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] font-medium tracking-wide uppercase text-fg-secondary">{label}</span>
      <div className="flex items-center gap-1">
        <InspectorNumericValueControl
          ariaLabel={label}
          value={offsetValueFor(value)}
          allowAuto
          unit={offsetUnitFor(value)}
          allowedUnits={OFFSET_UNITS}
          onUnitChange={onUnitChange}
          onCommit={onCommit}
        />
        <InspectorResetButton onReset={onReset} disabled={!isSet} label={`Reset ${label.toLowerCase()}`} />
      </div>
    </div>
  );
}

interface OffsetsSubsectionProps {
  offsets: PositionSettings;
  nodeId: string;
  onCommit: (next: PositionSettings | undefined) => void;
}

/**
 * The Offsets subsection (Checkpoint 5.2) — a visual four-side editor in
 * the brief's own directional cross layout (Top above, Left/Right
 * flanking a middle row, Bottom below) rather than EdgeGroup's stacked
 * list, since a top/right/bottom/left cross reads far more directly as
 * "which edge does this number move" than a vertical Top/Right/Bottom/
 * Left list would. Built from the exact same primitives EdgeGroup
 * (Spacing, Checkpoint 3.5) already proved for a linked/unlinked
 * four-side group: InspectorLinkToggle, InspectorPropertyRow's "stack"
 * variant, and a single header-level reset that clears all four sides
 * regardless of the current mode — which is simultaneously this
 * checkpoint's own "linked reset" and "section reset" (they are the same
 * underlying operation, reached from two conceptual angles; EdgeGroup
 * never needed two separate buttons for it, and neither does this).
 * "Individual reset" is the one true addition: a Reset button on each of
 * the four fields, visible only in Unlinked mode.
 *
 * Linked/Unlinked is local Inspector UI state (never written to the
 * document, never part of Undo/Redo) — re-derived via offsetSidesEqual
 * only when the *selection* changes, the same lastNodeId pattern
 * EdgeGroup/InspectorBorderRadiusSection already use, so unlinking and
 * editing just one side never snaps back to Linked just because that
 * edit made the four sides differ.
 */
function OffsetsSubsection({ offsets, nodeId, onCommit }: OffsetsSubsectionProps) {
  const [linked, setLinked] = useState(() => offsetSidesEqual(offsets));

  const [lastNodeId, setLastNodeId] = useState(nodeId);
  if (nodeId !== lastNodeId) {
    setLastNodeId(nodeId);
    setLinked(offsetSidesEqual(offsets));
  }

  const hasAnyOffset = OFFSET_SIDES.some((side) => offsets[side] !== undefined);

  function commitSide(side: OffsetSide, next: NumericOrAuto) {
    const unit = offsetUnitFor(offsets[side]);
    const value: OffsetValue = next === "auto" ? "auto" : { value: next, unit };
    onCommit(withPositionField(offsets, side, value));
  }

  function changeSideUnit(side: OffsetSide, unit: CssUnit) {
    const current = offsets[side];
    if (current === undefined || current === "auto") return;
    onCommit(withPositionField(offsets, side, { value: current.value, unit }));
  }

  const linkedValue = offsets.top;

  function commitLinked(next: NumericOrAuto) {
    const unit = offsetUnitFor(linkedValue);
    const value: OffsetValue = next === "auto" ? "auto" : { value: next, unit };
    onCommit(withAllOffsets(offsets, value));
  }

  function changeLinkedUnit(unit: CssUnit) {
    if (linkedValue === undefined || linkedValue === "auto") return;
    onCommit(withAllOffsets(offsets, { value: linkedValue.value, unit }));
  }

  return (
    <InspectorPropertyRow
      label="Offsets"
      help="How far this element shifts from its normal position, on each edge."
      variant="stack"
      state={hasAnyOffset ? "set" : "unset"}
      secondary={<InspectorLinkToggle linked={linked} onToggle={() => setLinked((prev) => !prev)} />}
      reset={<InspectorResetButton onReset={() => onCommit(withAllOffsets(offsets, undefined))} disabled={!hasAnyOffset} label="Reset offsets" />}
    >
      {linked ? (
        <div className="flex justify-center">
          <OffsetField label="All sides" value={linkedValue} onCommit={commitLinked} onUnitChange={changeLinkedUnit} onReset={() => onCommit(withAllOffsets(offsets, undefined))} />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <OffsetField
            label={OFFSET_SIDE_LABELS.top}
            value={offsets.top}
            onCommit={(next) => commitSide("top", next)}
            onUnitChange={(unit) => changeSideUnit("top", unit)}
            onReset={() => onCommit(withPositionField(offsets, "top", undefined))}
          />
          {/*
           * flex-wrap + justify-center, not justify-between (regression
           * caught live, Checkpoint 5.2): each OffsetField is a real
           * number input + unit select + reset button, wide enough that
           * two of them together exceed the Inspector panel's own default
           * content width. justify-between still anchors the second field
           * to the row's far edge even when it doesn't fit, pushing it
           * visibly off the right edge of the panel (and the browser
           * window) instead of wrapping — the exact same class of bug
           * InspectorSegmentedRow's own flex-wrap fix (Checkpoint 4.1.5)
           * addressed for Justify Content's six options. Left/Right render
           * side by side once the panel is wide enough, and wrap onto
           * their own lines otherwise — never clipped either way.
           */}
          <div className="flex w-full flex-wrap items-center justify-center gap-3">
            <OffsetField
              label={OFFSET_SIDE_LABELS.left}
              value={offsets.left}
              onCommit={(next) => commitSide("left", next)}
              onUnitChange={(unit) => changeSideUnit("left", unit)}
              onReset={() => onCommit(withPositionField(offsets, "left", undefined))}
            />
            <OffsetField
              label={OFFSET_SIDE_LABELS.right}
              value={offsets.right}
              onCommit={(next) => commitSide("right", next)}
              onUnitChange={(unit) => changeSideUnit("right", unit)}
              onReset={() => onCommit(withPositionField(offsets, "right", undefined))}
            />
          </div>
          <OffsetField
            label={OFFSET_SIDE_LABELS.bottom}
            value={offsets.bottom}
            onCommit={(next) => commitSide("bottom", next)}
            onUnitChange={(unit) => changeSideUnit("bottom", unit)}
            onReset={() => onCommit(withPositionField(offsets, "bottom", undefined))}
          />
        </div>
      )}
    </InspectorPropertyRow>
  );
}

type ZIndexMode = "auto" | "custom";

/**
 * Structured per-value copy for the Z-index mode toggle (Checkpoint
 * 5.3's own requirement, mirroring 5.1's identical one for Position
 * itself — "must come from structured metadata... not scattered inline
 * JSX prose"), consumed via InspectorSegmentedRow's optionTooltips.
 * Deliberately avoids the incorrect "higher z-index always appears on
 * top" claim the brief explicitly warns against — "usually" and "when
 * elements participate in the same stacking context" are load-bearing
 * words, not hedging.
 */
const ZINDEX_MODE_METADATA: Record<ZIndexMode, { label: string; description: string }> = {
  auto: { label: "Auto", description: "Uses the browser's normal stacking order." },
  custom: {
    label: "Custom",
    description: "Higher values usually appear in front of lower values when elements participate in the same stacking context.",
  },
};
const ZINDEX_MODE_OPTIONS = (["auto", "custom"] as const).map((mode) => ZINDEX_MODE_METADATA[mode].label);
const ZINDEX_MODE_LABEL_TO_MODE: Record<string, ZIndexMode> = { Auto: "auto", Custom: "custom" };
const ZINDEX_MODE_TOOLTIPS = Object.fromEntries(
  (["auto", "custom"] as const).map((mode) => [ZINDEX_MODE_METADATA[mode].label, ZINDEX_MODE_METADATA[mode].description]),
);

/** Row-level help (Checkpoint 5.3's own required caveat) — always visible via the row's help-icon tooltip, distinct from the *conditional* nearby-stacking-context note below, which only appears when it's actually relevant to the selected node. */
const ZINDEX_HELP = "Z-index only compares elements within the same stacking context — it isn't one single global front-to-back ranking.";

/**
 * Shown only when establishesStackingContext(node) ||
 * ancestorEstablishesStackingContext(document, node.id) is true (see
 * StackingSubsection) — lightweight stacking-context *awareness*, not a
 * diagnostic engine: it names the general categories of cause (per the
 * brief's own wording) without attempting to compute or guarantee the
 * actual resulting stacking order, which types/stackingContext.ts's own
 * doc comment explains is deliberately out of scope.
 */
const NEARBY_STACKING_CONTEXT_NOTE =
  "This element or a nearby ancestor already starts its own stacking context (for example: reduced opacity, a visual effect, or fixed/sticky position) — z-index here only competes within that scope.";

interface StackingSubsectionProps {
  node: EditorElementNode;
  position: PositionSettings;
  onCommit: (next: PositionSettings | undefined) => void;
}

/**
 * The Stacking subsection (Checkpoint 5.3) — one property, Z-index, with
 * a compact Auto/Custom mode toggle (InspectorSegmentedRow, the same
 * primitive Checkpoint 3.5's InspectorGridChildSection already uses for
 * an identical "number | auto" field shape — see its own Column/Row
 * Start controls) plus a plain integer InspectorNumericValueControl
 * (no unit — z-index has none — and no `allowAuto`: Auto/Custom is
 * handled by the segmented toggle above, not the numeric field's own
 * built-in "empty commits auto" mechanism, so there is exactly one way
 * to reach Auto, not two competing ones).
 *
 * `mode` is fully derived from `position.zIndex`'s own type on every
 * render (`typeof zIndex === "number" ? "custom" : "auto"`) — unlike
 * Offsets' Linked/Unlinked, there is no separate local React state to
 * re-derive on selection change, since the document itself is already
 * the single source of truth for which mode is active.
 *
 * Selecting Auto commits the literal `"auto"` (a real, deliberate
 * choice — see ZIndexValue's own doc comment); a separate Reset action
 * clears the field back to genuinely absent. Selecting Custom commits 0
 * unless a number is already stored (matching InspectorGridChildSection's
 * identical `columnStart === "auto" ? 1 : columnStart` precedent) — it
 * never tries to "remember" a prior custom value across an Auto detour,
 * since by the time you're back on the toggle, if the value round-
 * tripped through "auto", the prior number is genuinely gone from the
 * data (the single `zIndex` field held one or the other, never both).
 *
 * Unlike Offsets, this subsection is NOT gated on
 * offsetsApply(position.position)/Position being non-Static — see
 * InspectorPositionSection's own doc comment for why: modern CSS lets
 * z-index affect flex/grid items regardless of their own position value
 * (this app already models Flex/Grid items — see flowLayout.ts), so
 * hiding it for Static would incorrectly imply z-index is universally
 * meaningless there.
 */
function StackingSubsection({ node, position, onCommit }: StackingSubsectionProps) {
  const document = useEditorStore((state) => state.document);
  const zIndex = position.zIndex;
  const isSet = zIndex !== undefined;
  const mode: ZIndexMode = typeof zIndex === "number" ? "custom" : "auto";
  const nearbyStackingContext =
    establishesStackingContext(node) || ancestorEstablishesStackingContext(document, node.id);

  function handleModeSelect(label: string) {
    const nextMode = ZINDEX_MODE_LABEL_TO_MODE[label];
    const nextValue: ZIndexValue = nextMode === "auto" ? "auto" : typeof zIndex === "number" ? zIndex : 0;
    onCommit(withPositionField(position, "zIndex", nextValue));
  }

  function handleValueCommit(next: NumericOrAuto) {
    if (typeof next !== "number") return;
    onCommit(withPositionField(position, "zIndex", Math.round(next)));
  }

  function handleReset() {
    onCommit(withPositionField(position, "zIndex", undefined));
  }

  return (
    <div className="border-t border-zinc-200 pt-2 dark:border-zinc-800">
      <span className="text-[10px] font-medium tracking-wide uppercase text-fg-secondary">Stacking</span>
      <InspectorPropertyRow
        label="Z-index"
        help={ZINDEX_HELP}
        variant="stack"
        state={isSet ? "set" : "unset"}
        reset={<InspectorResetButton onReset={handleReset} disabled={!isSet} label="Reset z-index" />}
      >
        <div className="flex flex-col gap-1.5">
          <InspectorSegmentedRow
            label="Mode"
            options={ZINDEX_MODE_OPTIONS}
            activeOption={ZINDEX_MODE_METADATA[mode].label}
            onSelect={handleModeSelect}
            optionTooltips={ZINDEX_MODE_TOOLTIPS}
          />
          {mode === "custom" && (
            <InspectorNumericValueControl
              ariaLabel="Z-index value"
              value={typeof zIndex === "number" ? zIndex : 0}
              onCommit={handleValueCommit}
            />
          )}
        </div>
      </InspectorPropertyRow>
      {nearbyStackingContext && (
        <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">{NEARBY_STACKING_CONTEXT_NOTE}</p>
      )}
    </div>
  );
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
 * The Position Foundation section (Checkpoint 5.1), extended in
 * Checkpoint 5.2 with the Offsets subsection — built entirely on the
 * Checkpoint 4.1 shared primitives, same as Display/Spacing. The
 * `position` field is a single enum (no free-text entry, so no UI-level
 * validation error state is needed there — invalid *documents* are still
 * handled defensively by resolvePositionStyle, never by this component).
 * Commits through the single setElementPosition store action (one
 * pushHistory per commit, matching Display — no continuous-drag field
 * exists here), reads its current value via getPositionSettings (never
 * synthesizes a default), and resets via withPositionField(...,
 * undefined), which clears the field back to genuinely absent — the
 * brief's own "Reset returns Position to: static" is exactly what an
 * absent field already renders as (resolvePositionStyle emits no
 * `position` CSS at all, so the browser's own static default governs),
 * matching every other section's "absent, not a synthesized explicit
 * default" reset philosophy.
 *
 * The Offsets subsection (top/right/bottom/left) only renders while
 * `offsetsApply(position.position)` is true — Static offsets are ignored
 * by CSS itself, and Checkpoint 5.2's own brief explicitly asked that
 * beginners never see a control with no effect. This section still
 * renders no Inset-shorthand/logical-inset controls — out of scope for
 * this checkpoint (see the brief's own Non-goals) and left for
 * 5.2.1/5.2.2 to add as new fields on this same PositionSettings object.
 *
 * The Stacking subsection (Z-index, Checkpoint 5.3) deliberately does
 * *not* copy that same visibility rule — it renders whenever this whole
 * Position section renders, regardless of `position.position`. Real CSS
 * lets z-index affect a flex or grid item's stacking order even while
 * that item is `position: static` (this app already models Flex/Grid
 * items — see flowLayout.ts's FlexChildSettings/GridChildSettings), so
 * hiding Z-index for Static would incorrectly imply it's universally
 * meaningless there, unlike Offsets (which genuinely have zero effect on
 * a static element, full stop). See StackingSubsection's own doc comment
 * for the rest of this checkpoint's design.
 *
 * Callers must not render this section for a Free-layout child or a
 * Free-hosting container — see InspectorNodeSummary, which owns that
 * gating, and types/position.ts's own doc comment for why: Free layout
 * already owns the CSS `position` property (and, by extension, any
 * offset or z-index built on top of it) on those specific nodes. This
 * section does not duplicate that gating internally — Checkpoint 5.3
 * inherits it for free, the same way Checkpoint 5.2 did.
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
      {offsetsApply(position.position) && (
        <div className="border-t border-zinc-200 pt-2 dark:border-zinc-800">
          <OffsetsSubsection offsets={position} nodeId={node.id} onCommit={(next) => setElementPosition(node.id, next)} />
        </div>
      )}
      <StackingSubsection node={node} position={position} onCommit={(next) => setElementPosition(node.id, next)} />
    </InspectorSection>
  );
}

"use client";

import { useState } from "react";
import { InspectorLinkToggle } from "@/features/inspector/components/InspectorLinkToggle";
import { InspectorResetButton } from "@/features/inspector/components/InspectorResetButton";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { InspectorSegmentedRow } from "@/features/inspector/components/InspectorSegmentedRow";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import {
  getDisplaySettings,
  overflowAxesEqual,
  withAllOverflow,
  withDisplayField,
  withOverflowAxis,
  CURSOR_VALUES,
  DISPLAY_VALUES,
  OVERFLOW_VALUES,
  POINTER_EVENTS_VALUES,
  USER_SELECT_VALUES,
  VISIBILITY_VALUES,
  type DisplaySettings,
  type OverflowValue,
} from "@/features/editor/types/display";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorDisplaySectionProps {
  node: EditorElementNode;
}

/**
 * "inline-block" -> "Inline Block", "not-allowed" -> "Not Allowed" — every
 * value in this checkpoint's enums is already lowercase, hyphen-separated
 * CSS, so this transform round-trips cleanly through buildEnumMaps' own
 * reverse lookup without a per-field manual label list (matching
 * InspectorBorderSection's STYLE_LABEL_TO_VALUE/STYLE_VALUE_TO_LABEL
 * precedent, generalized once since this section has six enum fields
 * instead of one).
 */
function humanizeEnumValue(value: string): string {
  return value
    .split("-")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

function buildEnumMaps<T extends string>(values: readonly T[]) {
  const labels = values.map(humanizeEnumValue);
  const labelToValue = Object.fromEntries(values.map((value) => [humanizeEnumValue(value), value])) as Record<string, T>;
  const valueToLabel = Object.fromEntries(values.map((value) => [value, humanizeEnumValue(value)])) as Record<T, string>;
  return { labels, labelToValue, valueToLabel };
}

const DISPLAY_MAPS = buildEnumMaps(DISPLAY_VALUES);
const VISIBILITY_MAPS = buildEnumMaps(VISIBILITY_VALUES);
const POINTER_EVENTS_MAPS = buildEnumMaps(POINTER_EVENTS_VALUES);
const CURSOR_MAPS = buildEnumMaps(CURSOR_VALUES);
const USER_SELECT_MAPS = buildEnumMaps(USER_SELECT_VALUES);

/** Matches no real option — same "don't falsely highlight an unset property" convention InspectorBorderSection established. */
const NO_ACTIVE_OPTION = "";

interface EnumRowConfig {
  field: keyof DisplaySettings;
  label: string;
  options: string[];
  activeOption: string;
  onSelect: (label: string) => void;
  onReset: () => void;
  isSet: boolean;
  help?: string;
}

function renderEnumRow(config: EnumRowConfig) {
  return (
    <InspectorSegmentedRow
      key={config.field}
      label={config.label}
      help={config.help}
      state={config.isSet ? "set" : "unset"}
      options={config.options}
      activeOption={config.activeOption}
      onSelect={config.onSelect}
      reset={
        <InspectorResetButton onReset={config.onReset} disabled={!config.isSet} label={`Reset ${config.label.toLowerCase()}`} />
      }
    />
  );
}

/**
 * Structured per-value copy for every Overflow control (Checkpoint 5.4) —
 * same "structured metadata, not inline JSX prose" requirement Position's
 * POSITION_VALUE_METADATA/ZINDEX_MODE_METADATA already established.
 * Deliberately distinguishes Hidden from Clip rather than treating them
 * as synonyms — Hidden still permits programmatic scrolling in some
 * browsers, Clip never creates a scroll container for that axis at all.
 */
const OVERFLOW_VALUE_METADATA: Record<OverflowValue, { label: string; description: string }> = {
  visible: { label: "Visible", description: "Content may render outside the element's box." },
  hidden: {
    label: "Hidden",
    description: "Overflowing content is clipped. Programmatic scrolling may still exist depending on browser behavior.",
  },
  clip: { label: "Clip", description: "Overflowing content is clipped without creating a scroll container for that axis." },
  auto: { label: "Auto", description: "Scrollbars appear when overflow requires them." },
  scroll: { label: "Scroll", description: "The element becomes scrollable and scrollbars may be shown even when content fits." },
};
const OVERFLOW_OPTIONS = OVERFLOW_VALUES.map((value) => OVERFLOW_VALUE_METADATA[value].label);
const OVERFLOW_LABEL_TO_VALUE = Object.fromEntries(
  OVERFLOW_VALUES.map((value) => [OVERFLOW_VALUE_METADATA[value].label, value]),
) as Record<string, OverflowValue>;
const OVERFLOW_VALUE_TO_LABEL = Object.fromEntries(
  OVERFLOW_VALUES.map((value) => [value, OVERFLOW_VALUE_METADATA[value].label]),
) as Record<OverflowValue, string>;
const OVERFLOW_TOOLTIPS = Object.fromEntries(
  OVERFLOW_VALUES.map((value) => [OVERFLOW_VALUE_METADATA[value].label, OVERFLOW_VALUE_METADATA[value].description]),
);

/** Matches no real option — same "don't falsely highlight an unset property" convention this file's own NO_ACTIVE_OPTION established for the other enum rows. */
const OVERFLOW_NO_ACTIVE_OPTION = "";

/** The effective value an axis displays in Unlinked mode — falls back to the unified `overflow` shorthand purely for *display* when the node hasn't actually been committed in per-axis form yet (see withOverflowAxis's own doc comment on why a commit is what actually performs that seed). */
function axisDisplayValue(display: DisplaySettings, axis: "overflowX" | "overflowY"): OverflowValue | undefined {
  return display[axis] ?? display.overflow;
}

interface OverflowSubsectionProps {
  display: DisplaySettings;
  nodeId: string;
  onCommit: (next: DisplaySettings | undefined) => void;
}

/**
 * The Overflow subsection (Checkpoint 5.4) — upgrades the flat Overflow
 * X/Overflow Y rows from Checkpoint 4.8 in place (no second Overflow
 * section, no duplicate CSS ownership) into a Linked/Unlinked editor,
 * reusing the exact primitives OffsetsSubsection (Position, Checkpoint
 * 5.2) already proved for a linked/unlinked grouped property:
 * InspectorLinkToggle plus a per-axis InspectorSegmentedRow/reset pair.
 *
 * Unlike Offsets (which has no CSS shorthand and always stores all four
 * sides as longhand), Overflow has a *real* CSS shorthand — so Linked and
 * Unlinked here store data in two mutually exclusive shapes rather than
 * one shape displayed two ways: Linked commits the unified `overflow`
 * field (withAllOverflow); Unlinked commits overflowX/overflowY
 * (withOverflowAxis). See types/display.ts's own doc comment on both
 * helpers for the full mutual-exclusivity/seeding contract this relies
 * on, and resolveDisplayStyle for the resolver's matching precedence.
 *
 * Linked/Unlinked is local Inspector UI state, never written to the
 * document and never part of Undo/Redo on its own — re-derived via
 * overflowAxesEqual only when the *selection* changes (the same
 * lastNodeId pattern OffsetsSubsection/InspectorBorderRadiusSection
 * already use), so unlinking and editing just one axis never snaps back
 * to Linked just because that edit made the two axes differ. Toggling
 * the mode is a pure view flip — it never itself calls onCommit, so it
 * never creates a history entry; only an actual value edit does, and
 * exactly one commit per edit (withOverflowAxis performs any needed
 * shape migration inside that same single commit, never a second one).
 */
function OverflowSubsection({ display, nodeId, onCommit }: OverflowSubsectionProps) {
  const [linked, setLinked] = useState(() => overflowAxesEqual(display));

  const [lastNodeId, setLastNodeId] = useState(nodeId);
  if (nodeId !== lastNodeId) {
    setLastNodeId(nodeId);
    setLinked(overflowAxesEqual(display));
  }

  const hasAnyOverflow = display.overflow !== undefined || display.overflowX !== undefined || display.overflowY !== undefined;
  const linkedValue = display.overflow ?? display.overflowX;

  function handleResetAll() {
    onCommit(withAllOverflow(display, undefined));
  }

  return (
    <div className="flex flex-col gap-1.5 border-t border-zinc-200 pt-2 text-xs dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <span className="text-zinc-500 dark:text-zinc-400">Overflow</span>
        <div className="flex items-center gap-1">
          <InspectorLinkToggle linked={linked} onToggle={() => setLinked((prev) => !prev)} />
          <InspectorResetButton onReset={handleResetAll} disabled={!hasAnyOverflow} label="Reset overflow" />
        </div>
      </div>
      {linked ? (
        <InspectorSegmentedRow
          label="Overflow"
          options={OVERFLOW_OPTIONS}
          activeOption={linkedValue ? OVERFLOW_VALUE_TO_LABEL[linkedValue] : OVERFLOW_NO_ACTIVE_OPTION}
          onSelect={(label) => onCommit(withAllOverflow(display, OVERFLOW_LABEL_TO_VALUE[label]))}
          optionTooltips={OVERFLOW_TOOLTIPS}
          state={linkedValue !== undefined ? "set" : "unset"}
        />
      ) : (
        <div className="flex flex-col gap-1.5">
          {(["overflowX", "overflowY"] as const).map((axis) => {
            const axisLabel = axis === "overflowX" ? "Horizontal (X)" : "Vertical (Y)";
            const value = axisDisplayValue(display, axis);
            const isSet = display[axis] !== undefined || display.overflow !== undefined;
            return (
              <InspectorSegmentedRow
                key={axis}
                label={axisLabel}
                options={OVERFLOW_OPTIONS}
                activeOption={value ? OVERFLOW_VALUE_TO_LABEL[value] : OVERFLOW_NO_ACTIVE_OPTION}
                onSelect={(label) => onCommit(withOverflowAxis(display, axis, OVERFLOW_LABEL_TO_VALUE[label]))}
                optionTooltips={OVERFLOW_TOOLTIPS}
                state={isSet ? "set" : "unset"}
                reset={
                  <InspectorResetButton
                    onReset={() => onCommit(withOverflowAxis(display, axis, undefined))}
                    disabled={!isSet}
                    label={`Reset ${axisLabel.toLowerCase()}`}
                  />
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * The Display & Visibility Foundation section (Checkpoint 4.8) — built
 * entirely on the Checkpoint 4.1 shared primitives, same as Border/
 * Filters. Every field is a plain enum choice (no free-text entry, so no
 * UI-level validation error state is needed — invalid *documents* are
 * still handled defensively by resolveDisplayStyle/isValidDisplayFieldValue,
 * never by this component). Commits through the single setElementDisplay
 * store action (one pushHistory per commit, matching Filters — no
 * continuous-drag field exists here), reads its current value via
 * getDisplaySettings (never synthesizes a default), and resets via
 * withDisplayField, which collapses back to a genuinely absent `display`
 * once every field has been cleared.
 *
 * Grouped into four beginner-friendly sub-sections, in the brief's own
 * order: Rendering (Display, Visibility), Interaction (Pointer Events,
 * Cursor), Overflow (Linked/Unlinked — see OverflowSubsection,
 * Checkpoint 5.4), Selection (User Select).
 *
 * `display` deliberately offers only block/inline/inline-block/none —
 * see types/display.ts's own doc comment for why "flex"/"grid" stay
 * exclusive to the pre-existing Layout section's own Display control.
 *
 * Pointer Events' help text documents this checkpoint's own explicit
 * requirement (#8): setting it to "None" is a real, honest CSS value —
 * the Canvas renders it for an accurate live preview — but it also means
 * the browser's own hit-testing skips that element (and, since
 * pointer-events is inherited, its descendants too) during Canvas
 * click-to-select, which relies on genuine DOM hit-testing (see
 * CanvasInteractionBoundary's delegated window click listener). A click
 * that lands on such an element passes through to whichever ancestor
 * still has pointer-events enabled, selecting that ancestor instead —
 * matching real browser physics, not a bug. The element itself remains
 * fully selectable and editable at all times via the Structure panel
 * (StructureTreeNode selects by node id directly, entirely independent
 * of the node's own CSS), and once selected by any means, its Selection/
 * Resize overlay (a sibling DOM tree, not a descendant of the styled
 * node — see CanvasOverlay) and every Inspector control keep working
 * normally regardless of the node's own pointer-events value.
 */
export function InspectorDisplaySection({ node }: InspectorDisplaySectionProps) {
  const setElementDisplay = useEditorStore((state) => state.setElementDisplay);
  const display = getDisplaySettings(node);

  function commitField<K extends keyof DisplaySettings>(field: K, value: DisplaySettings[K]) {
    setElementDisplay(node.id, withDisplayField(display, field, value));
  }

  function handleResetAll() {
    setElementDisplay(node.id, undefined);
  }

  const hasAnySetting = Object.keys(display).length > 0;

  return (
    <InspectorSection
      label="Display & Visibility"
      defaultOpen
      actions={<InspectorResetButton onReset={handleResetAll} disabled={!hasAnySetting} label="Reset display settings" />}
    >
      <div className="flex flex-col gap-1.5 text-xs">
        <span className="text-zinc-500 dark:text-zinc-400">Rendering</span>
        {renderEnumRow({
          field: "display",
          label: "Display",
          options: DISPLAY_MAPS.labels,
          activeOption: display.display ? DISPLAY_MAPS.valueToLabel[display.display] : NO_ACTIVE_OPTION,
          onSelect: (label) => commitField("display", DISPLAY_MAPS.labelToValue[label]),
          onReset: () => commitField("display", undefined),
          isSet: display.display !== undefined,
          help: '"None" removes the element from the layout entirely — unlike Visibility\'s "Hidden," which keeps its space reserved. "Flex"/"Grid" arrangement lives in the Layout section below, not here.',
        })}
        {renderEnumRow({
          field: "visibility",
          label: "Visibility",
          options: VISIBILITY_MAPS.labels,
          activeOption: display.visibility ? VISIBILITY_MAPS.valueToLabel[display.visibility] : NO_ACTIVE_OPTION,
          onSelect: (label) => commitField("visibility", VISIBILITY_MAPS.labelToValue[label]),
          onReset: () => commitField("visibility", undefined),
          isSet: display.visibility !== undefined,
          help: '"Hidden" keeps this element\'s own layout space reserved (siblings don\'t shift) — use Display\'s "None" to remove the space too.',
        })}
      </div>

      <div className="flex flex-col gap-1.5 border-t border-zinc-200 pt-2 text-xs dark:border-zinc-800">
        <span className="text-zinc-500 dark:text-zinc-400">Interaction</span>
        {renderEnumRow({
          field: "pointerEvents",
          label: "Pointer Events",
          options: POINTER_EVENTS_MAPS.labels,
          activeOption: display.pointerEvents ? POINTER_EVENTS_MAPS.valueToLabel[display.pointerEvents] : NO_ACTIVE_OPTION,
          onSelect: (label) => commitField("pointerEvents", POINTER_EVENTS_MAPS.labelToValue[label]),
          onReset: () => commitField("pointerEvents", undefined),
          isSet: display.pointerEvents !== undefined,
          help: '"None" makes this element unclickable on the exported page, and also on the Canvas — clicking it here selects whatever\'s behind it instead. Select it from the Structure panel on the left to keep editing it.',
        })}
        {renderEnumRow({
          field: "cursor",
          label: "Cursor",
          options: CURSOR_MAPS.labels,
          activeOption: display.cursor ? CURSOR_MAPS.valueToLabel[display.cursor] : NO_ACTIVE_OPTION,
          onSelect: (label) => commitField("cursor", CURSOR_MAPS.labelToValue[label]),
          onReset: () => commitField("cursor", undefined),
          isSet: display.cursor !== undefined,
        })}
      </div>

      <OverflowSubsection display={display} nodeId={node.id} onCommit={(next) => setElementDisplay(node.id, next)} />

      <div className="flex flex-col gap-1.5 border-t border-zinc-200 pt-2 text-xs dark:border-zinc-800">
        <span className="text-zinc-500 dark:text-zinc-400">Selection</span>
        {renderEnumRow({
          field: "userSelect",
          label: "User Select",
          options: USER_SELECT_MAPS.labels,
          activeOption: display.userSelect ? USER_SELECT_MAPS.valueToLabel[display.userSelect] : NO_ACTIVE_OPTION,
          onSelect: (label) => commitField("userSelect", USER_SELECT_MAPS.labelToValue[label]),
          onReset: () => commitField("userSelect", undefined),
          isSet: display.userSelect !== undefined,
        })}
      </div>
    </InspectorSection>
  );
}

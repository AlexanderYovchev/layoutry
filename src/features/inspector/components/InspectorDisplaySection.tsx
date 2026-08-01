"use client";

import { InspectorResetButton } from "@/features/inspector/components/InspectorResetButton";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { InspectorSegmentedRow } from "@/features/inspector/components/InspectorSegmentedRow";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import {
  getDisplaySettings,
  withDisplayField,
  CURSOR_VALUES,
  DISPLAY_VALUES,
  OVERFLOW_VALUES,
  POINTER_EVENTS_VALUES,
  USER_SELECT_VALUES,
  VISIBILITY_VALUES,
  type DisplaySettings,
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
const OVERFLOW_MAPS = buildEnumMaps(OVERFLOW_VALUES);
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
 * Cursor), Overflow (Overflow X, Overflow Y), Selection (User Select).
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

      <div className="flex flex-col gap-1.5 border-t border-zinc-200 pt-2 text-xs dark:border-zinc-800">
        <span className="text-zinc-500 dark:text-zinc-400">Overflow</span>
        {renderEnumRow({
          field: "overflowX",
          label: "Overflow X",
          options: OVERFLOW_MAPS.labels,
          activeOption: display.overflowX ? OVERFLOW_MAPS.valueToLabel[display.overflowX] : NO_ACTIVE_OPTION,
          onSelect: (label) => commitField("overflowX", OVERFLOW_MAPS.labelToValue[label]),
          onReset: () => commitField("overflowX", undefined),
          isSet: display.overflowX !== undefined,
        })}
        {renderEnumRow({
          field: "overflowY",
          label: "Overflow Y",
          options: OVERFLOW_MAPS.labels,
          activeOption: display.overflowY ? OVERFLOW_MAPS.valueToLabel[display.overflowY] : NO_ACTIVE_OPTION,
          onSelect: (label) => commitField("overflowY", OVERFLOW_MAPS.labelToValue[label]),
          onReset: () => commitField("overflowY", undefined),
          isSet: display.overflowY !== undefined,
        })}
      </div>

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

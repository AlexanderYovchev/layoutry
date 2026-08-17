"use client";

import { useState } from "react";
import { InspectorNumericValueControl, type NumericOrAuto } from "@/features/inspector/components/InspectorNumericValueControl";
import { InspectorResetButton } from "@/features/inspector/components/InspectorResetButton";
import { InspectorSegmentedRow } from "@/features/inspector/components/InspectorSegmentedRow";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import {
  detectAspectRatioPreset,
  isValidAspectRatioValue,
  ASPECT_RATIO_PRESETS,
  type AspectRatioPresetKey,
  type AspectRatioValue,
} from "@/features/editor/types/aspectRatio";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorAspectRatioFieldsProps {
  node: EditorElementNode;
}

const PRESET_OPTIONS = ASPECT_RATIO_PRESETS.map((preset) => preset.label);
const PRESET_LABEL_TO_KEY: Record<string, AspectRatioPresetKey> = Object.fromEntries(
  ASPECT_RATIO_PRESETS.map((preset) => [preset.label, preset.key]),
);
const PRESET_KEY_TO_LABEL: Record<AspectRatioPresetKey, string> = Object.fromEntries(
  ASPECT_RATIO_PRESETS.map((preset) => [preset.key, preset.label]),
) as Record<AspectRatioPresetKey, string>;
const PRESET_TOOLTIPS = Object.fromEntries(ASPECT_RATIO_PRESETS.map((preset) => [preset.label, preset.description]));

/** Matches no real option — same "don't falsely highlight an unset property" convention every other enum control in this app already established. */
const NO_ACTIVE_OPTION = "";

/** This checkpoint's own explicit required guidance, always visible via the row's help-icon tooltip (structured metadata, not inline JSX prose). */
const ASPECT_RATIO_HELP =
  "Aspect ratio affects sizing when at least one dimension can adjust. If width and height are both fixed, aspect ratio may not visibly change the box.";

/** Smallest positive ratio component this control accepts — keeps the numeric field's own min/max clamp consistent with isValidAspectRatioValue's own "> 0" requirement without ever letting a draft commit exactly 0. */
const MIN_RATIO_COMPONENT = 0.01;

// Typed as the narrower "ratio" branch (not the full AspectRatioValue
// union) specifically so currentRatio's own ternary below still narrows
// correctly — a plain `AspectRatioValue` annotation here would widen
// that ternary's result back to the full union and defeat the point of
// the check.
const DEFAULT_CUSTOM_RATIO: Extract<AspectRatioValue, { mode: "ratio" }> = { mode: "ratio", width: 1, height: 1 };

/**
 * The Aspect Ratio control (Checkpoint 5.5) — the row/custom-fields
 * content only, no section wrapper of its own: Checkpoint 5.7 folded
 * this into the shared "Size" InspectorSection alongside Width/Height/
 * Min/Max/Resize Proportions (see InspectorSizeSection, this
 * component's only caller) rather than each owning a separate
 * accordion — "expand the same section, don't duplicate it." Renamed
 * from InspectorAspectRatioSection (Checkpoint 5.5's own name) to make
 * the "fields only" contract explicit; the row/preset/custom-field logic
 * below is otherwise byte-for-byte what 5.5 shipped.
 *
 * Mode is derived from the document, plus one piece of local, node-keyed
 * UI state (`customMode`) for exactly one case: entering Custom while the
 * current value doesn't already recognize as a preset needs *some*
 * committed starting ratio (see handlePresetSelect), but the segmented
 * row's own active option must still show "Custom" the instant the user
 * clicks it, even before that commit's store update round-trips back
 * through `node`. Re-derived only when the *selection* changes (the same
 * lastNodeId pattern OffsetsSubsection/OverflowSubsection use), so
 * editing the custom fields into a shape that no longer matches a
 * preset never snaps the view back to a named preset.
 *
 * Preset detection (detectAspectRatioPreset) recognizes a
 * mathematically-equivalent ratio (8:6 shows as Landscape) without ever
 * rewriting the stored value — only an actual preset click or a real
 * edit to the custom fields ever calls onCommit.
 */
export function InspectorAspectRatioFields({ node }: InspectorAspectRatioFieldsProps) {
  const setElementAspectRatio = useEditorStore((state) => state.setElementAspectRatio);
  const value = node.aspectRatio;
  const isSet = value !== undefined && isValidAspectRatioValue(value);
  const detectedKey = isSet ? detectAspectRatioPreset(value) : undefined;

  const [customMode, setCustomMode] = useState(() => detectedKey === "custom");
  // Re-derives on a genuine *selection* change (lastNodeId, the same
  // pattern OffsetsSubsection/OverflowSubsection use) — but also, found
  // via Checkpoint 5.5's own real-browser Undo/Redo verification, on any
  // change to the *value itself* while the same node stays selected
  // (lastValue): Undo/Redo mutate the store directly, bypassing this
  // component's own commit functions entirely, so a value that was
  // "Custom" a moment ago can become an exact preset again (or vice
  // versa) with no node-id change at all — the Inspector's own active
  // option must still track that, or it silently shows a stale Custom
  // view over data that undo just turned back into a named preset.
  //
  // skipNextResync guards the one case that would otherwise conflict with
  // this: entering Custom from Auto/absent seeds DEFAULT_CUSTOM_RATIO
  // (1:1) as a real commit (see handlePresetSelect) — but 1:1 is *also*
  // the Square preset's own canonical value, so a value-reference-change
  // resync would immediately (and incorrectly) recognize it as Square and
  // snap the just-opened Custom fields shut. commit() below sets this
  // flag immediately before every one of this component's own writes;
  // the very next render's resync consumes it and skips re-deriving,
  // trusting whatever customMode this component's own handler already
  // set synchronously. An externally-caused value change (Undo/Redo)
  // never sets this flag, so it always resyncs correctly. Plain state,
  // not a ref: React disallows reading/writing a ref during render (this
  // whole block runs during render, the same "adjust state during
  // render" pattern lastNodeId/lastValue themselves already use), so
  // this flag has to be state too, batched right alongside them.
  const [skipNextResync, setSkipNextResync] = useState(false);
  const [lastNodeId, setLastNodeId] = useState(node.id);
  const [lastValue, setLastValue] = useState(value);
  if (node.id !== lastNodeId || value !== lastValue) {
    setLastNodeId(node.id);
    setLastValue(value);
    if (skipNextResync) {
      setSkipNextResync(false);
    } else {
      setCustomMode(detectedKey === "custom");
    }
  }

  const activeKey: AspectRatioPresetKey | undefined = customMode ? "custom" : detectedKey;
  // A stable, always-ratio-shaped fallback for the custom fields' own
  // displayed value — `value?.mode === "ratio" ? value : ...` doesn't
  // narrow `value` itself through the optional chain (a real TypeScript
  // limitation with discriminated unions), so this is computed once
  // here instead of repeating an `undefined`-then-`mode` check at every
  // call site.
  const currentRatio = value !== undefined && value.mode === "ratio" ? value : DEFAULT_CUSTOM_RATIO;

  function commit(next: AspectRatioValue) {
    setSkipNextResync(true);
    setElementAspectRatio(node.id, next);
  }

  function handlePresetSelect(label: string) {
    const key = PRESET_LABEL_TO_KEY[label];

    if (key === "custom") {
      setCustomMode(true);
      // Already ratio-shaped (whether recognized as a named preset or
      // already custom) — just reveal the fields, no document change.
      if (!isSet || value.mode !== "ratio") commit(DEFAULT_CUSTOM_RATIO);
      return;
    }

    setCustomMode(false);
    const preset = ASPECT_RATIO_PRESETS.find((p) => p.key === key);
    if (preset?.value) commit(preset.value);
  }

  function commitCustomWidth(next: NumericOrAuto) {
    if (typeof next !== "number") return;
    commit({ mode: "ratio", width: next, height: currentRatio.height });
  }

  function commitCustomHeight(next: NumericOrAuto) {
    if (typeof next !== "number") return;
    commit({ mode: "ratio", width: currentRatio.width, height: next });
  }

  function handleReset() {
    setCustomMode(false);
    setSkipNextResync(true);
    setElementAspectRatio(node.id, undefined);
  }

  return (
    <>
      <InspectorSegmentedRow
        label="Aspect Ratio"
        help={ASPECT_RATIO_HELP}
        options={PRESET_OPTIONS}
        activeOption={activeKey ? PRESET_KEY_TO_LABEL[activeKey] : NO_ACTIVE_OPTION}
        onSelect={handlePresetSelect}
        optionTooltips={PRESET_TOOLTIPS}
        state={isSet ? "set" : "unset"}
        reset={<InspectorResetButton onReset={handleReset} disabled={!isSet} label="Reset aspect ratio" />}
      />
      {activeKey === "custom" && (
        <div className="flex items-center justify-center gap-2">
          <InspectorNumericValueControl
            ariaLabel="Aspect ratio width"
            value={currentRatio.width}
            min={MIN_RATIO_COMPONENT}
            step={0.1}
            onCommit={commitCustomWidth}
          />
          <span aria-hidden="true" className="text-zinc-400 dark:text-zinc-500">
            :
          </span>
          <InspectorNumericValueControl
            ariaLabel="Aspect ratio height"
            value={currentRatio.height}
            min={MIN_RATIO_COMPONENT}
            step={0.1}
            onCommit={commitCustomHeight}
          />
        </div>
      )}
    </>
  );
}

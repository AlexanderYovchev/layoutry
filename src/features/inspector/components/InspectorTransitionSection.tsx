"use client";

import { InspectorNumericValueControl, type NumericOrAuto } from "@/features/inspector/components/InspectorNumericValueControl";
import { InspectorPropertyRow } from "@/features/inspector/components/InspectorPropertyRow";
import { InspectorResetButton } from "@/features/inspector/components/InspectorResetButton";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { InspectorSegmentedRow } from "@/features/inspector/components/InspectorSegmentedRow";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import {
  DEFAULT_TRANSITION_SETTINGS,
  TRANSITION_PROPERTIES,
  TRANSITION_PROPERTY_LABELS,
  TRANSITION_TIMING_FUNCTIONS,
  TRANSITION_TIMING_FUNCTION_LABELS,
  getTransitionSettings,
  isValidTransitionDelayMs,
  isValidTransitionDurationMs,
  withTransitionField,
  type TransitionProperty,
  type TransitionTimingFunction,
} from "@/features/editor/types/transition";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorTransitionSectionProps {
  node: EditorElementNode;
}

const NONE_OPTION = "None";
const PROPERTY_OPTIONS = [NONE_OPTION, ...TRANSITION_PROPERTIES.map((property) => TRANSITION_PROPERTY_LABELS[property])];
const PROPERTY_LABEL_TO_VALUE: Record<string, TransitionProperty | undefined> = {
  [NONE_OPTION]: undefined,
  ...Object.fromEntries(TRANSITION_PROPERTIES.map((property) => [TRANSITION_PROPERTY_LABELS[property], property])),
};

/**
 * The Transition Foundation section (Checkpoint 1.15.6.14.1) — the first
 * CSS Animation Inspector surface. Property doubles as the enable/disable
 * control (Part Z of this checkpoint's own brief): "None" clears
 * `node.transition` entirely; any other option both activates a
 * transition (defaulting Duration/Timing/Delay the first time, matching
 * DEFAULT_TRANSITION_SETTINGS) and changes which property it targets —
 * the same single-selector-doubles-as-enable-switch shape
 * InspectorBackgroundSection's own "Source: None/Image/Gradient" selector
 * already established, chosen over a separate "Add Transition" button
 * because, unlike Interactions (a LIST of independent bindings),
 * Transition is a single always-one-value struct — exactly Background's
 * own shape, not Interactions'.
 *
 * Duration/Timing/Delay only render once a transition exists (section 26
 * of this checkpoint's brief) — there is nothing meaningful to configure
 * before a Property has been chosen. No sliders (Part H's own explicit
 * instruction): ordinary numeric fields for Duration/Delay, a native
 * `<select>` for Timing, the same shape InspectorInteractionsSection's own
 * Action/Target selects already use.
 */
export function InspectorTransitionSection({ node }: InspectorTransitionSectionProps) {
  const setElementTransition = useEditorStore((state) => state.setElementTransition);
  const transition = getTransitionSettings(node);

  function handlePropertySelect(option: string) {
    const nextProperty = PROPERTY_LABEL_TO_VALUE[option];
    if (nextProperty === undefined) {
      setElementTransition(node.id, undefined);
      return;
    }
    const current = transition ?? DEFAULT_TRANSITION_SETTINGS;
    setElementTransition(node.id, withTransitionField(current, "property", nextProperty));
  }

  function handleDurationCommit(next: NumericOrAuto) {
    if (typeof next !== "number" || !transition || !isValidTransitionDurationMs(next)) return;
    setElementTransition(node.id, withTransitionField(transition, "durationMs", next));
  }

  function handleDelayCommit(next: NumericOrAuto) {
    if (typeof next !== "number" || !transition || !isValidTransitionDelayMs(next)) return;
    setElementTransition(node.id, withTransitionField(transition, "delayMs", next));
  }

  function handleTimingChange(timingFunction: TransitionTimingFunction) {
    if (!transition) return;
    setElementTransition(node.id, withTransitionField(transition, "timingFunction", timingFunction));
  }

  return (
    <InspectorSection
      label="Transition"
      actions={<InspectorResetButton onReset={() => setElementTransition(node.id, undefined)} disabled={!transition} label="Reset transition" />}
    >
      <InspectorSegmentedRow
        label="Property"
        options={PROPERTY_OPTIONS}
        activeOption={transition ? TRANSITION_PROPERTY_LABELS[transition.property] : NONE_OPTION}
        onSelect={handlePropertySelect}
        state={transition ? "set" : "unset"}
      />

      {transition && (
        <>
          <InspectorPropertyRow label="Duration">
            <InspectorNumericValueControl
              ariaLabel="Duration"
              value={transition.durationMs}
              min={0}
              onCommit={handleDurationCommit}
            />
            <span className="text-xs text-zinc-500 dark:text-zinc-400">ms</span>
          </InspectorPropertyRow>

          <InspectorPropertyRow label="Timing" labelHtmlFor="transition-timing">
            <select
              id="transition-timing"
              aria-label="Timing"
              value={transition.timingFunction}
              onChange={(event) => handleTimingChange(event.target.value as TransitionTimingFunction)}
              className="h-7 min-w-24 rounded-md border border-zinc-200 bg-zinc-50 px-1.5 text-xs text-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
            >
              {TRANSITION_TIMING_FUNCTIONS.map((option) => (
                <option key={option} value={option}>
                  {TRANSITION_TIMING_FUNCTION_LABELS[option]}
                </option>
              ))}
            </select>
          </InspectorPropertyRow>

          <InspectorPropertyRow label="Delay">
            <InspectorNumericValueControl ariaLabel="Delay" value={transition.delayMs} min={0} onCommit={handleDelayCommit} />
            <span className="text-xs text-zinc-500 dark:text-zinc-400">ms</span>
          </InspectorPropertyRow>
        </>
      )}
    </InspectorSection>
  );
}

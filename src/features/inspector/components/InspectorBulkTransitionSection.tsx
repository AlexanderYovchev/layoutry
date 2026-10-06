"use client";

import { InspectorBulkNumberField } from "@/features/inspector/components/InspectorBulkNumberField";
import { InspectorPropertyRow } from "@/features/inspector/components/InspectorPropertyRow";
import { InspectorResetButton } from "@/features/inspector/components/InspectorResetButton";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { InspectorSegmentedRow } from "@/features/inspector/components/InspectorSegmentedRow";
import { resolveSharedValue, withSharedFallback } from "@/features/inspector/types/sharedValue";
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
  type TransitionProperty,
  type TransitionTimingFunction,
} from "@/features/editor/types/transition";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorBulkTransitionSectionProps {
  nodes: readonly EditorElementNode[];
}

const NONE_OPTION = "None";
const PROPERTY_OPTIONS = [NONE_OPTION, ...TRANSITION_PROPERTIES.map((property) => TRANSITION_PROPERTY_LABELS[property])];
const PROPERTY_LABEL_TO_VALUE: Record<string, TransitionProperty | undefined> = {
  [NONE_OPTION]: undefined,
  ...Object.fromEntries(TRANSITION_PROPERTIES.map((property) => [TRANSITION_PROPERTY_LABELS[property], property])),
};

/**
 * The multi-selection Transition surface (Checkpoint 1.15.6.14.1) — unlike
 * the single-selection section, every row (Property/Duration/Timing/
 * Delay) renders unconditionally rather than hiding Duration/Timing/Delay
 * until a Property is chosen: a mixed selection can easily have SOME
 * nodes with a transition and some without, or different properties on
 * different nodes, while still sharing a genuinely common Duration — see
 * this checkpoint's own Part K worked example ("Property: Mixed, Duration:
 * 200ms, Timing: Mixed, Delay: 0ms"). Selecting a real Property (or typing
 * a Duration/Delay, or choosing a Timing function) applies it to every
 * targeted node in one atomic bulk commit via setElementsTransitionField,
 * defaulting any node with no transition yet to DEFAULT_TRANSITION_SETTINGS
 * first (see that command's own doc comment) — "None" instead clears every
 * targeted node's transition entirely via the separate whole-value
 * setElementsTransition bulk command.
 */
export function InspectorBulkTransitionSection({ nodes }: InspectorBulkTransitionSectionProps) {
  const setElementsTransitionField = useEditorStore((state) => state.setElementsTransitionField);
  const setElementsTransition = useEditorStore((state) => state.setElementsTransition);
  const ids = nodes.map((node) => node.id);

  const property = resolveSharedValue(nodes, (node) => getTransitionSettings(node)?.property);
  const duration = resolveSharedValue(nodes, (node) => getTransitionSettings(node)?.durationMs);
  const timing = resolveSharedValue(nodes, (node) => getTransitionSettings(node)?.timingFunction);
  const delay = resolveSharedValue(nodes, (node) => getTransitionSettings(node)?.delayMs);

  const hasAnyTransition = nodes.some((node) => getTransitionSettings(node) !== undefined);

  function handlePropertySelect(option: string) {
    const nextProperty = PROPERTY_LABEL_TO_VALUE[option];
    if (nextProperty === undefined) {
      setElementsTransition(ids, undefined);
      return;
    }
    setElementsTransitionField(ids, "property", nextProperty);
  }

  function handleTimingChange(value: string) {
    if (value === "") return;
    setElementsTransitionField(ids, "timingFunction", value as TransitionTimingFunction);
  }

  return (
    <InspectorSection
      label="Transition"
      actions={<InspectorResetButton onReset={() => setElementsTransition(ids, undefined)} disabled={!hasAnyTransition} label="Reset transition" />}
    >
      <InspectorSegmentedRow
        label="Property"
        options={PROPERTY_OPTIONS}
        activeOption={property.kind === "same" ? (property.value ? TRANSITION_PROPERTY_LABELS[property.value] : NONE_OPTION) : "Mixed"}
        onSelect={handlePropertySelect}
        state={property.kind === "mixed" ? "mixed" : property.value ? "set" : "unset"}
      />

      <InspectorPropertyRow label="Duration" state={duration.kind === "mixed" ? "mixed" : duration.value !== undefined ? "set" : "unset"}>
        <InspectorBulkNumberField
          ariaLabel="Duration"
          shared={withSharedFallback(duration, DEFAULT_TRANSITION_SETTINGS.durationMs)}
          min={0}
          onCommit={(value) => isValidTransitionDurationMs(value) && setElementsTransitionField(ids, "durationMs", value)}
        />
        <span className="text-xs text-zinc-500 dark:text-zinc-400">ms</span>
      </InspectorPropertyRow>

      <InspectorPropertyRow label="Timing" state={timing.kind === "mixed" ? "mixed" : timing.value !== undefined ? "set" : "unset"}>
        <select
          aria-label="Timing"
          value={timing.kind === "same" && timing.value !== undefined ? timing.value : ""}
          onChange={(event) => handleTimingChange(event.target.value)}
          className="h-7 min-w-24 rounded-md border border-zinc-200 bg-zinc-50 px-1.5 text-xs text-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
        >
          {!(timing.kind === "same" && timing.value !== undefined) && <option value="">Mixed</option>}
          {TRANSITION_TIMING_FUNCTIONS.map((option) => (
            <option key={option} value={option}>
              {TRANSITION_TIMING_FUNCTION_LABELS[option]}
            </option>
          ))}
        </select>
      </InspectorPropertyRow>

      <InspectorPropertyRow label="Delay" state={delay.kind === "mixed" ? "mixed" : delay.value !== undefined ? "set" : "unset"}>
        <InspectorBulkNumberField
          ariaLabel="Delay"
          shared={withSharedFallback(delay, DEFAULT_TRANSITION_SETTINGS.delayMs)}
          min={0}
          onCommit={(value) => isValidTransitionDelayMs(value) && setElementsTransitionField(ids, "delayMs", value)}
        />
        <span className="text-xs text-zinc-500 dark:text-zinc-400">ms</span>
      </InspectorPropertyRow>
    </InspectorSection>
  );
}

"use client";

import { InspectorBooleanToggle } from "@/features/inspector/components/InspectorBooleanToggle";
import { InspectorNumberFieldRow } from "@/features/inspector/components/InspectorNumberFieldRow";
import { InspectorPropertyRow } from "@/features/inspector/components/InspectorPropertyRow";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { getProgressMax, getProgressValue, isProgressIndeterminate } from "@/features/editor/types/progress";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorProgressSectionProps {
  /** The selected node — rendered only for `progress` (see InspectorNodeSummary). */
  node: EditorElementNode;
}

/**
 * Progress's semantic concerns (Checkpoint 1.15.6.12.4): Value, Max, and
 * Indeterminate. Deliberately not a CSS Inspector section, the same
 * "element data, not styling" spirit InspectorVideoSection/
 * InspectorAudioSection/InspectorTableSection already establish.
 *
 * Indeterminate is a derived toggle, not a stored field — reads
 * isProgressIndeterminate(node) (purely `progressValue === undefined`)
 * and calls the dedicated setElementProgressIndeterminate command, which
 * owns the ON/OFF value-restoration policy (see that command's own doc
 * comment). Value is hidden while Indeterminate is ON — there is nothing
 * meaningful to edit, matching this checkpoint's own brief UX (section Q):
 * showing a disabled-but-visible Value field would imply it still does
 * something.
 *
 * Both Value and Max reuse InspectorNumberFieldRow unchanged — the same
 * local-draft/blur/Enter-commits/Escape-reverts/no-op-skipped field
 * Table's own Columns/Body Rows controls already use, so this needed no
 * new numeric-field component.
 */
export function InspectorProgressSection({ node }: InspectorProgressSectionProps) {
  const setElementProgressValue = useEditorStore((state) => state.setElementProgressValue);
  const setElementProgressMax = useEditorStore((state) => state.setElementProgressMax);
  const setElementProgressIndeterminate = useEditorStore((state) => state.setElementProgressIndeterminate);

  const indeterminate = isProgressIndeterminate(node);
  const effectiveValue = getProgressValue(node) ?? 0;
  const effectiveMax = getProgressMax(node);

  return (
    <InspectorSection label="Progress" defaultOpen>
      <InspectorPropertyRow label="Indeterminate">
        <InspectorBooleanToggle
          checked={indeterminate}
          onChange={(checked) => setElementProgressIndeterminate(node.id, checked)}
          label="Indeterminate"
        />
      </InspectorPropertyRow>
      {!indeterminate && (
        <InspectorNumberFieldRow
          label="Value"
          value={effectiveValue}
          onCommit={(value) => setElementProgressValue(node.id, value)}
        />
      )}
      <InspectorNumberFieldRow
        label="Max"
        value={effectiveMax}
        onCommit={(value) => setElementProgressMax(node.id, value)}
      />
    </InspectorSection>
  );
}

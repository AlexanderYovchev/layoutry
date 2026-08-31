"use client";

import { InspectorNumberFieldRow } from "@/features/inspector/components/InspectorNumberFieldRow";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorSelectOptionsSectionProps {
  /** The selected node — rendered only for select (see InspectorNodeSummary; a direct tag check, not a capability flag, matching InspectorListSection's own precedent — only one tag will ever use this). */
  node: EditorElementNode;
}

/**
 * Select's Options management (Checkpoint 1.13) — the exact same lesson
 * List's own Items count already taught applied to a second constrained-
 * nesting parent: a user shouldn't need the creation menu just to
 * establish how many Options a Select has. Deliberately count-only, not
 * a richer structured list editor (reorder/inline-edit-per-row) — no
 * existing Inspector pattern in this codebase supports that without
 * introducing real new UI infrastructure, and this checkpoint's brief
 * explicitly preferred "correct architecture... over squeezing a mini
 * spreadsheet in." Individual Option editing (Label/Value/Selected)
 * happens through Structure selection + InspectorOptionSection instead.
 * Backed by setOptionCount, the exact structural twin of setListItemCount
 * — grows by appending fresh createOptionNode() entries, shrinks by
 * trimming only from the end, preserving every surviving Option's
 * id/text/value/selected/styles untouched. Does not weaken this
 * checkpoint's select -> option containment: this only ever adds/removes
 * ordinary <option> children through the normal document/store
 * architecture, never a synthetic entry outside the tree.
 */
export function InspectorSelectOptionsSection({ node }: InspectorSelectOptionsSectionProps) {
  const setOptionCount = useEditorStore((state) => state.setOptionCount);
  const optionCount = node.children?.length ?? 0;

  return (
    <InspectorSection label="Options" defaultOpen>
      <InspectorNumberFieldRow
        label="Count"
        value={optionCount}
        onCommit={(value) => setOptionCount(node.id, Math.max(0, Math.round(value)))}
      />
    </InspectorSection>
  );
}

"use client";

import { InspectorNumberFieldRow } from "@/features/inspector/components/InspectorNumberFieldRow";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorListSectionProps {
  /** The selected node — rendered only for ul/ol (see InspectorNodeSummary; List is not a getElementCapabilities flag since only two tags ever use it — Checkpoint 1.12.1). */
  node: EditorElementNode;
}

/**
 * List's one semantic concern: how many `<li>` children it has
 * (Checkpoint 1.12.1), so a user isn't forced back to the creation menu
 * just to add/remove entries. Backed by setListItemCount, which grows by
 * appending fresh createListItemNode() entries and shrinks by trimming
 * only from the end — every surviving item keeps its existing id/text/
 * styles untouched. Does not weaken Checkpoint 1.6's ul/ol -> li
 * containment: this only ever adds/removes ordinary `<li>` children
 * through the normal document/store architecture, never a synthetic
 * visual entry outside the tree. One completed edit is one history entry
 * (setListItemCount's own action-level no-op guard skips a no-op count).
 */
export function InspectorListSection({ node }: InspectorListSectionProps) {
  const setListItemCount = useEditorStore((state) => state.setListItemCount);
  const itemCount = node.children?.length ?? 0;

  return (
    <InspectorSection label="List" defaultOpen>
      <InspectorNumberFieldRow
        label="Items"
        value={itemCount}
        onCommit={(value) => setListItemCount(node.id, Math.max(0, Math.round(value)))}
      />
    </InspectorSection>
  );
}

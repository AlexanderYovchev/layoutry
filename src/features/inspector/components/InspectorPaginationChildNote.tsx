"use client";

import { getInactiveReason } from "@/features/editor/rules/accessibilityAttributes";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";
import { getPaginationRole, isPaginationNode } from "@/features/editor/types/pagination";
import { findNodeById } from "@/features/editor/utils/findNodeById";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { PAGINATION_CHILD_COPY } from "@/features/inspector/utils/paginationCopy";

interface InspectorPaginationChildNoteProps {
  node: EditorElementNode;
  parentId: string | null;
}

/**
 * BC-09.4: when a child of a marked Pagination is selected, says what the
 * Pagination does with it: a disabled control or the current page never
 * activates, the ellipsis is decorative, and an enabled navigation
 * control's destination is managed. Informative only; every other section
 * (Link, CSS, Interactions) stays fully editable. Renders nothing for
 * ordinary pages and for anything outside a marked Pagination.
 */
export function InspectorPaginationChildNote({ node, parentId }: InspectorPaginationChildNoteProps) {
  const parent = useEditorStore((state) => (parentId ? findNodeById(state.document, parentId) : undefined));
  if (!parent || !isPaginationNode(parent)) return null;
  const reason = getInactiveReason(node, parent);
  const role = getPaginationRole(node, parent);
  const message =
    reason === "disabled"
      ? PAGINATION_CHILD_COPY.disabled
      : reason === "current-page"
        ? PAGINATION_CHILD_COPY.currentPage
        : reason === "ellipsis"
          ? PAGINATION_CHILD_COPY.ellipsis
          : role !== undefined
            ? PAGINATION_CHILD_COPY.managedDestination
            : undefined;
  if (!message) return null;
  return (
    <InspectorSection label={PAGINATION_CHILD_COPY.title} defaultOpen>
      <p className="px-0.5 text-[11px] text-fg-secondary">{message}</p>
    </InspectorSection>
  );
}

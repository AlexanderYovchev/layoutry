"use client";

import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { InspectorSegmentedRow } from "@/features/inspector/components/InspectorSegmentedRow";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { HEADING_TAGS, type HeadingTag } from "@/features/editor/types/heading";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorHeadingLevelSectionProps {
  /** The selected node — rendered only for a heading-capable tag (see InspectorNodeSummary, gated on getElementCapabilities().supportsHeadingLevel — Checkpoint 1.7). */
  node: EditorElementNode;
}

const LEVEL_OPTIONS = HEADING_TAGS.map((tag) => tag.toUpperCase());

function tagToOption(tag: string): string {
  return tag.toUpperCase();
}

function optionToTag(option: string): HeadingTag {
  return option.toLowerCase() as HeadingTag;
}

/**
 * Heading's one HTML-semantics concern for this checkpoint: its level
 * (Checkpoint 1.7) — deliberately not under CSS Typography, since H1 vs.
 * H2 is document structure, not styling. The node's own tag is the sole
 * source of truth (see setElementTag's own doc comment) — there is no
 * parallel headingLevel field to keep in sync. The segmented row's fixed
 * H1–H6 option set is what keeps this safe: selecting an option always
 * maps to one of the six real heading tags, never free-form text, so no
 * separate validation layer is needed the way Link's href field needed
 * one. setElementTag's own no-op guard means re-selecting the
 * already-active level pushes no history entry.
 */
export function InspectorHeadingLevelSection({ node }: InspectorHeadingLevelSectionProps) {
  const setElementTag = useEditorStore((state) => state.setElementTag);

  return (
    <InspectorSection label="Heading Level" defaultOpen>
      <InspectorSegmentedRow
        label="Level"
        options={LEVEL_OPTIONS}
        activeOption={tagToOption(node.tag)}
        onSelect={(option) => setElementTag(node.id, optionToTag(option))}
      />
    </InspectorSection>
  );
}

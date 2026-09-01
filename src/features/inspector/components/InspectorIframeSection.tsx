"use client";

import { useState } from "react";
import { InspectorMediaTextField } from "@/features/inspector/components/InspectorMediaTextField";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { isValidLinkHref } from "@/features/editor/types/link";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorIframeSectionProps {
  /** The selected node — rendered only for `iframe` (see InspectorNodeSummary). */
  node: EditorElementNode;
}

/**
 * Embed's (iframe's) two semantic concerns (Checkpoint 1.15): Source URL
 * and Title, both InspectorMediaTextField instances (see that component's
 * own doc comment — this is one of its four simultaneous consumers).
 * Source URL reuses isValidLinkHref for the same javascript:-URI safety
 * check Link's own destination field already applies. Title has no such
 * validation — it's a plain accessible-name string, the name a screen
 * reader announces for the embedded content, prominently surfaced since
 * createIframeNode already stamps a real starter value ("Embedded
 * content") rather than leaving it unset; see that factory's own doc
 * comment for why.
 */
export function InspectorIframeSection({ node }: InspectorIframeSectionProps) {
  const setElementSrc = useEditorStore((state) => state.setElementSrc);
  const setElementTitle = useEditorStore((state) => state.setElementTitle);

  const [srcError, setSrcError] = useState<string | undefined>(undefined);

  const [lastNodeId, setLastNodeId] = useState(node.id);
  if (node.id !== lastNodeId) {
    setLastNodeId(node.id);
    setSrcError(undefined);
  }

  function handleSrcCommit(value: string) {
    if (!isValidLinkHref(value)) {
      setSrcError("Enter a valid embed URL.");
      return;
    }
    setSrcError(undefined);
    setElementSrc(node.id, value);
  }

  return (
    <InspectorSection label="Embed" defaultOpen>
      <InspectorMediaTextField
        id="iframe-src"
        label="Source URL"
        value={node.src ?? ""}
        hasExplicitValue={node.src !== undefined}
        placeholder="https://example.com/embed"
        onCommit={handleSrcCommit}
        onReset={() => {
          setSrcError(undefined);
          setElementSrc(node.id, undefined);
        }}
        error={srcError}
      />
      <InspectorMediaTextField
        id="iframe-title"
        label="Title"
        value={node.title ?? ""}
        hasExplicitValue={node.title !== undefined}
        placeholder="Embedded content"
        onCommit={(value) => setElementTitle(node.id, value)}
        onReset={() => setElementTitle(node.id, undefined)}
      />
    </InspectorSection>
  );
}

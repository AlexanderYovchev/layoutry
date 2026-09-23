"use client";

import { useState } from "react";
import { InspectorMediaTextField } from "@/features/inspector/components/InspectorMediaTextField";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { isValidLinkHref } from "@/features/editor/types/link";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorImageSectionProps {
  /** The selected node — rendered only for `img` (see InspectorNodeSummary). */
  node: EditorElementNode;
}

/**
 * Image's one semantic concern (Checkpoint 1.15.6.10.1): Source URL, an
 * InspectorMediaTextField instance — the same shared field Video's Source/
 * Poster and Iframe's Source/Title already use (see that component's own
 * doc comment). `node.src` and the generic, tag-agnostic `setElementSrc`
 * command already existed (Checkpoint 1.15) — the 1.15.6.10 audit found
 * this was purely an Inspector omission, not a document-model or renderer
 * gap, so this section is deliberately the smallest possible closure:
 * no new field, no new command, no new validation. Source URL reuses
 * isValidLinkHref for the same javascript:-URI safety check Link/Video/
 * Iframe's own destination fields already apply — reusing the existing
 * check, not adding new validation infrastructure.
 *
 * Deliberately rendered OUTSIDE InspectorProtectedStyleGroup in
 * InspectorNodeSummary (matching Video/Iframe's own placement) — Source
 * is semantic element data, not CSS, so Parent Style Protection's "Lock
 * child styles" must never block editing it.
 */
export function InspectorImageSection({ node }: InspectorImageSectionProps) {
  const setElementSrc = useEditorStore((state) => state.setElementSrc);

  const [srcError, setSrcError] = useState<string | undefined>(undefined);

  const [lastNodeId, setLastNodeId] = useState(node.id);
  if (node.id !== lastNodeId) {
    setLastNodeId(node.id);
    setSrcError(undefined);
  }

  function handleSrcCommit(value: string) {
    if (!isValidLinkHref(value)) {
      setSrcError("Enter a valid image URL.");
      return;
    }
    setSrcError(undefined);
    setElementSrc(node.id, value);
  }

  return (
    <InspectorSection label="Image" defaultOpen>
      <InspectorMediaTextField
        id="image-src"
        label="Source URL"
        value={node.src ?? ""}
        hasExplicitValue={node.src !== undefined}
        placeholder="https://example.com/image.jpg"
        onCommit={handleSrcCommit}
        onReset={() => {
          setSrcError(undefined);
          setElementSrc(node.id, undefined);
        }}
        error={srcError}
      />
    </InspectorSection>
  );
}

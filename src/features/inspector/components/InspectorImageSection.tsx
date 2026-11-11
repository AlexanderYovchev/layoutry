"use client";

import { useState } from "react";
import { InspectorImageUploadField } from "@/features/inspector/components/InspectorImageUploadField";
import { InspectorMediaTextField } from "@/features/inspector/components/InspectorMediaTextField";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { isValidLinkHref } from "@/features/editor/types/link";
import type { EditorElementNode } from "@/features/editor/types/document";
import { describeEmbeddedImage } from "@/features/inspector/utils/describeEmbeddedImage";
import type { DecodeImage } from "@/features/inspector/utils/validateImageUpload";

export const ALT_TEXT_COPY = {
  label: "Alt text",
  placeholder: "Describe the image",
  description: "Describe the image for people using screen readers. Leave empty for decorative images.",
} as const;

interface InspectorImageSectionProps {
  /** The selected node — rendered only for `img` (see InspectorNodeSummary). */
  node: EditorElementNode;
  /** Tests inject an image decoder for the upload field. */
  decode?: DecodeImage;
}

/**
 * Image's semantic data: its source and its alt text.
 *
 * Source (Checkpoint 1.15.6.10.1, upload since BC-07.2) is either an
 * uploaded file, embedded in `src` as a data URL (InspectorImageUploadField),
 * or a URL typed into Source URL, which reuses isValidLinkHref for the same
 * javascript:-URI check Link/Video/Iframe apply. While an upload is the
 * source, Source URL shows empty instead of megabytes of base64. Typing a
 * URL there replaces the upload; its Reset is for URL sources, while Remove
 * clears an upload.
 *
 * Alt text (BC-07.2) edits `displayName`, the value the Canvas, Preview and
 * export already render as `alt`. It commits like every other text field
 * here (on Enter or blur, one Undo step), and an emptied field is a real,
 * decorative `alt=""`.
 *
 * Deliberately rendered OUTSIDE InspectorProtectedStyleGroup in
 * InspectorNodeSummary (matching Video/Iframe's own placement) — source and
 * alt are semantic element data, not CSS, so Parent Style Protection's
 * "Lock child styles" must never block editing them.
 */
export function InspectorImageSection({ node, decode }: InspectorImageSectionProps) {
  const setElementSrc = useEditorStore((state) => state.setElementSrc);
  const setElementAltText = useEditorStore((state) => state.setElementAltText);

  const [srcError, setSrcError] = useState<string | undefined>(undefined);

  const [lastNodeId, setLastNodeId] = useState(node.id);
  if (node.id !== lastNodeId) {
    setLastNodeId(node.id);
    setSrcError(undefined);
  }

  const embedded = describeEmbeddedImage(node.src) !== undefined;

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
      <InspectorImageUploadField node={node} decode={decode} />
      <InspectorMediaTextField
        id="image-src"
        label="Source URL"
        value={embedded ? "" : (node.src ?? "")}
        hasExplicitValue={!embedded && node.src !== undefined}
        placeholder={embedded ? "Or paste an image URL" : "https://example.com/image.jpg"}
        onCommit={handleSrcCommit}
        onReset={() => {
          setSrcError(undefined);
          setElementSrc(node.id, undefined);
        }}
        error={srcError}
      />
      <InspectorMediaTextField
        id="image-alt"
        label={ALT_TEXT_COPY.label}
        value={node.displayName ?? ""}
        hasExplicitValue={node.displayName !== undefined}
        placeholder={ALT_TEXT_COPY.placeholder}
        description={ALT_TEXT_COPY.description}
        allowEmpty
        onCommit={(value) => setElementAltText(node.id, value === "" ? undefined : value)}
        onReset={() => setElementAltText(node.id, undefined)}
      />
    </InspectorSection>
  );
}

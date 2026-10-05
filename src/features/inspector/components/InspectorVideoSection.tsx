"use client";

import { useState } from "react";
import { InspectorMediaPlaybackFields } from "@/features/inspector/components/InspectorMediaPlaybackFields";
import { InspectorMediaTextField } from "@/features/inspector/components/InspectorMediaTextField";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { isValidLinkHref } from "@/features/editor/types/link";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorVideoSectionProps {
  /** The selected node — rendered only for `video` (see InspectorNodeSummary). */
  node: EditorElementNode;
}

/**
 * Video's semantic concerns (Checkpoint 1.15): Source URL, Poster URL,
 * and the Controls/Autoplay/Muted/Loop toggles. Deliberately not a CSS
 * Inspector section, the same "element data, not styling" spirit
 * InspectorLinkSection/InspectorFormControlSection already established.
 * Source/Poster reuse isValidLinkHref for the same javascript:-URI safety
 * check Link's own destination field already applies — the concern (never
 * embed a javascript: URI) is identical, just applied to a different
 * field/tag, so reusing the one existing validator was preferred over a
 * near-duplicate regex.
 *
 * Autoplay/Muted are deliberately NOT coupled — this checkpoint's brief
 * explicitly rejects auto-forcing Muted the moment Autoplay is turned on:
 * doing so would silently overwrite a user's own independent choice for a
 * DIFFERENT authored HTML attribute, which is a real behavioral surprise
 * (turn on Autoplay, and Muted flips too, with no visible cause) for a
 * "convenience" that saves one extra click. Instead, a small static hint
 * (not a validation engine — this app has none) explains the real browser
 * constraint once the user has both fields visible.
 */
export function InspectorVideoSection({ node }: InspectorVideoSectionProps) {
  const setElementSrc = useEditorStore((state) => state.setElementSrc);
  const setElementPoster = useEditorStore((state) => state.setElementPoster);

  const [srcError, setSrcError] = useState<string | undefined>(undefined);
  const [posterError, setPosterError] = useState<string | undefined>(undefined);

  const [lastNodeId, setLastNodeId] = useState(node.id);
  if (node.id !== lastNodeId) {
    setLastNodeId(node.id);
    setSrcError(undefined);
    setPosterError(undefined);
  }

  function handleSrcCommit(value: string) {
    if (!isValidLinkHref(value)) {
      setSrcError("Enter a valid video URL.");
      return;
    }
    setSrcError(undefined);
    setElementSrc(node.id, value);
  }

  function handlePosterCommit(value: string) {
    if (!isValidLinkHref(value)) {
      setPosterError("Enter a valid image URL.");
      return;
    }
    setPosterError(undefined);
    setElementPoster(node.id, value);
  }

  return (
    <InspectorSection label="Video" defaultOpen>
      <InspectorMediaTextField
        id="video-src"
        label="Source URL"
        value={node.src ?? ""}
        hasExplicitValue={node.src !== undefined}
        placeholder="https://example.com/video.mp4"
        onCommit={handleSrcCommit}
        onReset={() => {
          setSrcError(undefined);
          setElementSrc(node.id, undefined);
        }}
        error={srcError}
      />
      <InspectorMediaTextField
        id="video-poster"
        label="Poster URL"
        value={node.poster ?? ""}
        hasExplicitValue={node.poster !== undefined}
        placeholder="https://example.com/poster.jpg"
        onCommit={handlePosterCommit}
        onReset={() => {
          setPosterError(undefined);
          setElementPoster(node.id, undefined);
        }}
        error={posterError}
      />
      <InspectorMediaPlaybackFields node={node} />
    </InspectorSection>
  );
}

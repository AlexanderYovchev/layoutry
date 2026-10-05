"use client";

import { useState } from "react";
import { InspectorMediaPlaybackFields } from "@/features/inspector/components/InspectorMediaPlaybackFields";
import { InspectorMediaTextField } from "@/features/inspector/components/InspectorMediaTextField";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { isValidLinkHref } from "@/features/editor/types/link";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorAudioSectionProps {
  /** The selected node — rendered only for `audio` (see InspectorNodeSummary). */
  node: EditorElementNode;
}

/**
 * Audio's semantic concerns (Checkpoint 1.15.6.12.3) — Source URL plus the
 * Controls/Autoplay/Muted/Loop toggles, the exact same fields Video
 * reuses unchanged (no `audioSrc`/`audioControls`/etc. — see
 * EditorElementNode's own field doc comments, widened this checkpoint to
 * mention Audio). Deliberately the smallest possible semantic surface:
 * no Poster (a visual-only concept Video needs because a video has a
 * "before playback" frame to represent — an audio control bar has no
 * equivalent visual placeholder state) and no Media Fit (see
 * elementCapabilities.ts's own audio doc comment — Audio never gets
 * supportsMediaFit, so InspectorNodeSummary's generic
 * supportsMediaFit-gated InspectorMediaSection simply never renders for
 * this tag, the same way it already skips Iframe).
 */
export function InspectorAudioSection({ node }: InspectorAudioSectionProps) {
  const setElementSrc = useEditorStore((state) => state.setElementSrc);

  const [srcError, setSrcError] = useState<string | undefined>(undefined);

  const [lastNodeId, setLastNodeId] = useState(node.id);
  if (node.id !== lastNodeId) {
    setLastNodeId(node.id);
    setSrcError(undefined);
  }

  function handleSrcCommit(value: string) {
    if (!isValidLinkHref(value)) {
      setSrcError("Enter a valid audio URL.");
      return;
    }
    setSrcError(undefined);
    setElementSrc(node.id, value);
  }

  return (
    <InspectorSection label="Audio" defaultOpen>
      <InspectorMediaTextField
        id="audio-src"
        label="Source URL"
        value={node.src ?? ""}
        hasExplicitValue={node.src !== undefined}
        placeholder="https://example.com/audio.mp3"
        onCommit={handleSrcCommit}
        onReset={() => {
          setSrcError(undefined);
          setElementSrc(node.id, undefined);
        }}
        error={srcError}
      />
      <InspectorMediaPlaybackFields node={node} />
    </InspectorSection>
  );
}

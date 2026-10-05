"use client";

import { InspectorBooleanToggle } from "@/features/inspector/components/InspectorBooleanToggle";
import { InspectorPropertyRow } from "@/features/inspector/components/InspectorPropertyRow";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { getMediaControls } from "@/features/editor/types/video";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorMediaPlaybackFieldsProps {
  node: EditorElementNode;
}

/**
 * The Controls/Autoplay/Muted/Loop toggle block shared by Video and Audio
 * (Checkpoint 1.15.6.12.3) — identical semantics and identical generic
 * setElement* commands on both tags, extracted here once Audio became a
 * second real consumer (this project's own "don't share until genuinely
 * shared by more than one caller" convention — see InspectorMediaTextField's
 * own doc comment for the same threshold applied to a different control).
 * Deliberately just these four toggles plus the autoplay/muted browser-
 * policy hint — Source URL (and Poster, Video-only) stay owned by each
 * caller's own section, since those use per-field draft/error state this
 * shared block has no need to know about. Autoplay/Muted stay deliberately
 * uncoupled, the same reasoning InspectorVideoSection's own original doc
 * comment already established: auto-forcing one the moment the other is
 * toggled would silently overwrite a user's own independent choice.
 */
export function InspectorMediaPlaybackFields({ node }: InspectorMediaPlaybackFieldsProps) {
  const setElementControls = useEditorStore((state) => state.setElementControls);
  const setElementAutoplay = useEditorStore((state) => state.setElementAutoplay);
  const setElementMuted = useEditorStore((state) => state.setElementMuted);
  const setElementLoop = useEditorStore((state) => state.setElementLoop);

  return (
    <>
      <InspectorPropertyRow label="Controls">
        <InspectorBooleanToggle
          checked={getMediaControls(node)}
          onChange={(checked) => setElementControls(node.id, checked)}
          label="Controls"
        />
      </InspectorPropertyRow>
      <InspectorPropertyRow label="Autoplay">
        <InspectorBooleanToggle
          checked={node.autoplay ?? false}
          onChange={(checked) => setElementAutoplay(node.id, checked)}
          label="Autoplay"
        />
      </InspectorPropertyRow>
      <p className="px-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">
        Most browsers only allow autoplay when muted.
      </p>
      <InspectorPropertyRow label="Muted">
        <InspectorBooleanToggle checked={node.muted ?? false} onChange={(checked) => setElementMuted(node.id, checked)} label="Muted" />
      </InspectorPropertyRow>
      <InspectorPropertyRow label="Loop">
        <InspectorBooleanToggle checked={node.loop ?? false} onChange={(checked) => setElementLoop(node.id, checked)} label="Loop" />
      </InspectorPropertyRow>
    </>
  );
}

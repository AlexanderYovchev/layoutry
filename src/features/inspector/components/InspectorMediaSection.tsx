"use client";

import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { InspectorSegmentedRow } from "@/features/inspector/components/InspectorSegmentedRow";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { getMediaFitSettings } from "@/features/editor/types/mediaFit";
import type { MediaFit, MediaPosition } from "@/features/editor/types/mediaFit";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorMediaSectionProps {
  /** The selected node — rendered only for a media-capable tag (see InspectorNodeSummary, gated on getElementCapabilities().supportsIntrinsicAspectRatio). */
  node: EditorElementNode;
}

const FIT_OPTIONS = ["Contain", "Cover", "Fill"];
const POSITION_OPTIONS = ["Center", "Top", "Bottom", "Left", "Right"];

const FIT_LABEL_TO_VALUE: Record<string, MediaFit> = { Contain: "contain", Cover: "cover", Fill: "fill" };
const FIT_VALUE_TO_LABEL: Record<MediaFit, string> = { contain: "Contain", cover: "Cover", fill: "Fill" };

const POSITION_LABEL_TO_VALUE: Record<string, MediaPosition> = {
  Center: "center",
  Top: "top",
  Bottom: "bottom",
  Left: "left",
  Right: "right",
};
const POSITION_VALUE_TO_LABEL: Record<MediaPosition, string> = {
  center: "Center",
  top: "Top",
  bottom: "Bottom",
  left: "Left",
  right: "Right",
};

/**
 * Fit (Contain/Cover/Fill) + Position for a media-capable node's own
 * visual content (Checkpoint 3.5.1) — deliberately just these two
 * controls, not a full media inspector (asset picker, crop, etc. are
 * out of scope). preserveAspectRatio is always true from this UI: "Fill"
 * is the deliberate escape hatch for an intentional stretch, so there's
 * no separate toggle to confuse it with.
 */
export function InspectorMediaSection({ node }: InspectorMediaSectionProps) {
  const setMediaFitSettings = useEditorStore((state) => state.setMediaFitSettings);
  const mediaFit = getMediaFitSettings(node);

  function commit(patch: Partial<typeof mediaFit>) {
    setMediaFitSettings(node.id, { ...mediaFit, preserveAspectRatio: true, ...patch });
  }

  return (
    <InspectorSection label="Media" defaultOpen>
      <InspectorSegmentedRow
        label="Fit"
        options={FIT_OPTIONS}
        activeOption={FIT_VALUE_TO_LABEL[mediaFit.fit]}
        onSelect={(option) => commit({ fit: FIT_LABEL_TO_VALUE[option] })}
      />
      <InspectorSegmentedRow
        label="Position"
        options={POSITION_OPTIONS}
        activeOption={POSITION_VALUE_TO_LABEL[mediaFit.position]}
        onSelect={(option) => commit({ position: POSITION_LABEL_TO_VALUE[option] })}
      />
    </InspectorSection>
  );
}

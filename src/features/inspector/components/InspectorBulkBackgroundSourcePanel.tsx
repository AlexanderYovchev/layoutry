"use client";

import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { getBackgroundSettings, type BackgroundSettings } from "@/features/editor/types/background";
import type { EditorElementNode } from "@/features/editor/types/document";
import { InspectorMixedSectionPanel } from "@/features/inspector/components/InspectorMixedSectionPanel";
import { stableJson } from "@/features/inspector/utils/sectionUniformity";

/** Everything in Background except the colour: the source (image or gradient) and how it is placed. */
function backgroundSource(settings: BackgroundSettings): BackgroundSettings {
  const source = { ...settings };
  delete source.color;
  return source;
}

interface InspectorBulkBackgroundSourcePanelProps {
  nodes: readonly EditorElementNode[];
  primary: EditorElementNode;
  primaryName: string;
}

/**
 * BC-10.4: the image/gradient part of Background for a multi-selection
 * whose backgrounds differ (the colour has its own bulk field above).
 * - all without an image or gradient: nothing to show;
 * - all with the same image/gradient (only colours differ): says so (the
 *   full image/gradient editor appears once the colours agree too);
 * - different ones: Mixed, with "Use …'s image/gradient on all" and
 *   "Remove images and gradients from all". Each keeps every element's own
 *   colour, is one Undo step, and never rewrites a gradient: the primary's
 *   stored value is copied as is.
 */
export function InspectorBulkBackgroundSourcePanel({ nodes, primary, primaryName }: InspectorBulkBackgroundSourcePanelProps) {
  const setElementsSettings = useEditorStore((state) => state.setElementsSettings);
  const ids = nodes.map((node) => node.id);
  const sources = nodes.map((node) => stableJson(backgroundSource(getBackgroundSettings(node))));
  const none = stableJson({});
  if (sources.every((source) => source === none)) return null;
  const same = sources.every((source) => source === sources[0]);
  return (
    <InspectorMixedSectionPanel
      label="Background Image & Gradient"
      description={
        same
          ? "Every selected element uses the same image or gradient; only their colours differ."
          : "The selected elements have different background images or gradients."
      }
      actions={[
        ...(same ? [] : [{ label: `Use ${primaryName}'s image/gradient on all`, onSelect: () => setElementsSettings(ids, "backgroundSource", backgroundSource(getBackgroundSettings(primary))) }]),
        { label: "Remove images and gradients from all", onSelect: () => setElementsSettings(ids, "backgroundSource", undefined) },
      ]}
      note={same ? "Set the same colour on all of them to edit the image or gradient together." : "Every element keeps its own colour."}
    />
  );
}

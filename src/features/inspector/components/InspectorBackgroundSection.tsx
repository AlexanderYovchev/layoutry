"use client";

import { useState } from "react";
import { InspectorBackgroundImageControls } from "@/features/inspector/components/InspectorBackgroundImageControls";
import { InspectorColorFieldShell } from "@/features/inspector/components/InspectorColorFieldShell";
import { InspectorGradientSection } from "@/features/inspector/components/InspectorGradientSection";
import { InspectorPropertyRow } from "@/features/inspector/components/InspectorPropertyRow";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { InspectorSegmentedRow } from "@/features/inspector/components/InspectorSegmentedRow";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { isValidCssColor } from "@/features/editor/utils/cssColor";
import {
  getActiveBackgroundSource,
  getBackgroundSettings,
  withBackgroundField,
  withBackgroundGradientSource,
  type BackgroundSourceType,
} from "@/features/editor/types/background";
import { createDefaultGradientSettings } from "@/features/editor/types/gradient";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorBackgroundSectionProps {
  node: EditorElementNode;
}

const SOURCE_OPTIONS = ["None", "Image", "Gradient"];
const SOURCE_LABEL_TO_VALUE: Record<string, BackgroundSourceType | undefined> = {
  None: undefined,
  Image: "image",
  Gradient: "gradient",
};
const SOURCE_VALUE_TO_LABEL: Record<BackgroundSourceType, string> = { image: "Image", gradient: "Gradient" };

/**
 * The Background Foundation section (Checkpoint 4.3), extended in
 * Checkpoint 4.3.1 with a Gradient source alongside Image. Background
 * Color stays independent of source (always shown here). Only one of
 * InspectorBackgroundImageControls / InspectorGradientSection ever
 * renders at a time — switching the source selector never deletes the
 * *other* source's stored configuration (Checkpoint 4.3.1's #2 —
 * "preserve inactive source values"), it only changes which one is
 * active (see getActiveBackgroundSource, the single place that decision
 * is made, shared with the Canvas resolver so they can never disagree).
 */
export function InspectorBackgroundSection({ node }: InspectorBackgroundSectionProps) {
  const setElementBackground = useEditorStore((state) => state.setElementBackground);
  const background = getBackgroundSettings(node);
  const activeSource = getActiveBackgroundSource(background);

  const [colorError, setColorError] = useState<string | undefined>(undefined);

  const [lastNodeId, setLastNodeId] = useState(node.id);
  if (node.id !== lastNodeId) {
    setLastNodeId(node.id);
    setColorError(undefined);
  }

  function handleColorCommit(text: string) {
    if (!isValidCssColor(text)) {
      setColorError("Enter a hex color (#RRGGBB) or an rgb()/rgba() value.");
      return;
    }
    setColorError(undefined);
    setElementBackground(node.id, withBackgroundField(background, "color", text));
  }

  function handleSourceSelect(option: string) {
    const nextSource = SOURCE_LABEL_TO_VALUE[option];
    if (nextSource === "gradient") {
      // One coherent document change (Checkpoint 4.3.1's #4): activating
      // Gradient and — only the first time, when nothing is stored yet —
      // filling in the default two-stop gradient happen in this single
      // commit, never as separate history entries.
      const nextGradient = background.gradient ?? createDefaultGradientSettings("linear");
      setElementBackground(node.id, withBackgroundGradientSource(background, nextGradient));
      return;
    }
    setElementBackground(node.id, withBackgroundField(background, "sourceType", nextSource));
  }

  return (
    <InspectorSection label="Background" defaultOpen>
      <InspectorPropertyRow
        label="Color"
        state={colorError ? "invalid" : background.color ? "set" : "unset"}
        error={colorError}
      >
        <InspectorColorFieldShell
          label="Background color"
          value={background.color ?? null}
          onCommit={handleColorCommit}
          onReset={() => {
            setColorError(undefined);
            setElementBackground(node.id, withBackgroundField(background, "color", undefined));
          }}
          error={colorError}
        />
      </InspectorPropertyRow>

      <InspectorSegmentedRow
        label="Source"
        options={SOURCE_OPTIONS}
        activeOption={activeSource ? SOURCE_VALUE_TO_LABEL[activeSource] : "None"}
        onSelect={handleSourceSelect}
      />

      {activeSource === "image" && <InspectorBackgroundImageControls node={node} />}
      {activeSource === "gradient" && <InspectorGradientSection node={node} />}
    </InspectorSection>
  );
}

"use client";

import { useState } from "react";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { InspectorSegmentedRow } from "@/features/inspector/components/InspectorSegmentedRow";
import { useConvertContainerToFreeLayout } from "@/features/editor/hooks/useConvertContainerToFreeLayout";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { getLayoutMode, resolveChildResizePolicy } from "@/features/editor/types/layout";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorLayoutSectionProps {
  /** The selected node — rendered only when it can contain children (see InspectorNodeSummary). */
  node: EditorElementNode;
}

const LAYOUT_MODE_OPTIONS = ["Flow", "Free"];
const RESIZE_POLICY_OPTIONS = ["Scale", "Clamp"];

/**
 * Layout mode (Flow/Free) and, when Free, Resize contents (Scale/Clamp)
 * controls for the selected container (Checkpoint 3.4.4). Switching to
 * Free goes through useConvertContainerToFreeLayout (one atomic,
 * one-history-entry measurement + write); switching back to Flow and
 * changing the resize policy are already-atomic discrete store actions.
 */
export function InspectorLayoutSection({ node }: InspectorLayoutSectionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const convertToFreeLayout = useConvertContainerToFreeLayout();
  const convertToFlowLayout = useEditorStore((state) => state.convertToFlowLayout);
  const setChildResizePolicy = useEditorStore((state) => state.setChildResizePolicy);

  const isFree = getLayoutMode(node) === "free";

  function handleLayoutModeSelect(option: string) {
    if (option === "Free" && !isFree) convertToFreeLayout(node.id);
    if (option === "Flow" && isFree) convertToFlowLayout(node.id);
  }

  function handlePolicySelect(option: string) {
    setChildResizePolicy(node.id, option === "Clamp" ? "clamp" : "scale");
  }

  return (
    <InspectorSection label="Layout" isOpen={isOpen} onToggle={() => setIsOpen((open) => !open)}>
      <InspectorSegmentedRow
        label="Layout mode"
        options={LAYOUT_MODE_OPTIONS}
        activeOption={isFree ? "Free" : "Flow"}
        onSelect={handleLayoutModeSelect}
      />
      {isFree && (
        <InspectorSegmentedRow
          label="Resize contents"
          options={RESIZE_POLICY_OPTIONS}
          activeOption={resolveChildResizePolicy(node) === "clamp" ? "Clamp" : "Scale"}
          onSelect={handlePolicySelect}
        />
      )}
    </InspectorSection>
  );
}

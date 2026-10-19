"use client";

import { InspectorBooleanToggle } from "@/features/inspector/components/InspectorBooleanToggle";
import { InspectorPropertyRow } from "@/features/inspector/components/InspectorPropertyRow";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorProtectionSectionProps {
  /** The selected node — rendered only for a tag eligible to OWN a style lock (see canOwnStyleLock, and InspectorNodeSummary's own gate). */
  node: EditorElementNode;
}

/**
 * "Lock child styles" (Checkpoint 1.15.3) — the one control that sets
 * EditorElementNode.lockChildStyles. Deliberately a tiny, single-toggle
 * section, not a permissions panel (the brief's own explicit instruction):
 * the real enforcement lives centrally in the store's guardedStyleMutation/
 * guardedBulkStyleMutation (see rules/styleProtection.ts), not here — this
 * section only ever writes the one boolean.
 */
export function InspectorProtectionSection({ node }: InspectorProtectionSectionProps) {
  const setElementLockChildStyles = useEditorStore((state) => state.setElementLockChildStyles);

  return (
    <InspectorSection label="Protection" defaultOpen={false}>
      <InspectorPropertyRow label="Lock child styles">
        <InspectorBooleanToggle
          checked={node.lockChildStyles ?? false}
          onChange={(checked) => setElementLockChildStyles(node.id, checked || undefined)}
          label="Lock child styles"
        />
      </InspectorPropertyRow>
      <p className="px-0.5 text-[11px] text-fg-secondary">
        Prevents CSS changes to descendants while keeping their content editable.
      </p>
    </InspectorSection>
  );
}

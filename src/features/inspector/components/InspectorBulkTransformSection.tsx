"use client";

import { InspectorBulkNumberField } from "@/features/inspector/components/InspectorBulkNumberField";
import { InspectorPropertyRow } from "@/features/inspector/components/InspectorPropertyRow";
import { InspectorResetButton } from "@/features/inspector/components/InspectorResetButton";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { resolveSharedValue, withSharedFallback } from "@/features/inspector/types/sharedValue";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import {
  getTransformSettings,
  isValidTransformRotateDeg,
  isValidTransformScale,
  isValidTransformTranslate,
} from "@/features/editor/types/transform";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorBulkTransformSectionProps {
  nodes: readonly EditorElementNode[];
}

/**
 * The multi-selection Transform surface (Checkpoint 1.15.6.14.3) — all
 * four rows (Translate X/Y, Rotate, Scale) render unconditionally, same
 * reasoning as InspectorBulkTransitionSection: a mixed selection can have
 * some nodes with no Transform at all and some with different values
 * while still sharing a genuinely common field. Committing any field
 * applies it to every targeted node in one atomic bulk commit via
 * setElementsTransformField; Reset clears every targeted node's Transform
 * entirely via setElementsTransform — never a group transform (no
 * bounding-box rotation/scale/move across the selection — Checkpoint
 * 1.15.6.14.2.1's own Part J).
 */
export function InspectorBulkTransformSection({ nodes }: InspectorBulkTransformSectionProps) {
  const setElementsTransformField = useEditorStore((state) => state.setElementsTransformField);
  const setElementsTransform = useEditorStore((state) => state.setElementsTransform);
  const ids = nodes.map((node) => node.id);

  const translateX = resolveSharedValue(nodes, (node) => getTransformSettings(node)?.translateX);
  const translateY = resolveSharedValue(nodes, (node) => getTransformSettings(node)?.translateY);
  const rotateDeg = resolveSharedValue(nodes, (node) => getTransformSettings(node)?.rotateDeg);
  const scale = resolveSharedValue(nodes, (node) => getTransformSettings(node)?.scale);

  const hasAnyTransform = nodes.some((node) => getTransformSettings(node) !== undefined);

  return (
    <InspectorSection
      label="Transform"
      actions={<InspectorResetButton onReset={() => setElementsTransform(ids, undefined)} disabled={!hasAnyTransform} label="Reset transform" />}
    >
      <InspectorPropertyRow label="Translate X" state={translateX.kind === "mixed" ? "mixed" : translateX.value !== undefined ? "set" : "unset"}>
        <InspectorBulkNumberField
          ariaLabel="Translate X"
          shared={withSharedFallback(translateX, 0)}
          onCommit={(value) => isValidTransformTranslate(value) && setElementsTransformField(ids, "translateX", value)}
        />
        <span className="text-xs text-zinc-500 dark:text-zinc-400">px</span>
      </InspectorPropertyRow>

      <InspectorPropertyRow label="Translate Y" state={translateY.kind === "mixed" ? "mixed" : translateY.value !== undefined ? "set" : "unset"}>
        <InspectorBulkNumberField
          ariaLabel="Translate Y"
          shared={withSharedFallback(translateY, 0)}
          onCommit={(value) => isValidTransformTranslate(value) && setElementsTransformField(ids, "translateY", value)}
        />
        <span className="text-xs text-zinc-500 dark:text-zinc-400">px</span>
      </InspectorPropertyRow>

      <InspectorPropertyRow label="Rotate" state={rotateDeg.kind === "mixed" ? "mixed" : rotateDeg.value !== undefined ? "set" : "unset"}>
        <InspectorBulkNumberField
          ariaLabel="Rotate"
          shared={withSharedFallback(rotateDeg, 0)}
          onCommit={(value) => isValidTransformRotateDeg(value) && setElementsTransformField(ids, "rotateDeg", value)}
        />
        <span className="text-xs text-zinc-500 dark:text-zinc-400">°</span>
      </InspectorPropertyRow>

      <InspectorPropertyRow label="Scale" state={scale.kind === "mixed" ? "mixed" : scale.value !== undefined ? "set" : "unset"}>
        <InspectorBulkNumberField
          ariaLabel="Scale"
          shared={withSharedFallback(scale, 1)}
          onCommit={(value) => isValidTransformScale(value) && setElementsTransformField(ids, "scale", value)}
        />
      </InspectorPropertyRow>
    </InspectorSection>
  );
}

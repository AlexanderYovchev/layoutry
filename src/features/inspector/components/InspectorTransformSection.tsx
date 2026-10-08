"use client";

import { InspectorNumericValueControl, type NumericOrAuto } from "@/features/inspector/components/InspectorNumericValueControl";
import { InspectorPropertyRow } from "@/features/inspector/components/InspectorPropertyRow";
import { InspectorResetButton } from "@/features/inspector/components/InspectorResetButton";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import {
  getTransformSettings,
  isValidTransformRotateDeg,
  isValidTransformScale,
  isValidTransformTranslate,
  withTransformField,
  type TransformSettings,
} from "@/features/editor/types/transform";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorTransformSectionProps {
  node: EditorElementNode;
}

/**
 * The Transform Foundation section (Checkpoint 1.15.6.14.3) — unlike
 * Transition's Property-as-enable-switch, Transform has no single
 * "enable" control: four independent numeric fields (Translate X/Y,
 * Rotate, Scale), each starting at its own identity placeholder (0/0/0/1)
 * while absent, matching this checkpoint's own approved Inspector mockup.
 * Committing a value merges it in via withTransformField, which already
 * identity-normalizes — setting a field back to its own identity value
 * removes just that field (never the whole object unless it was the last
 * meaningful one).
 *
 * The second, conditional hint (Checkpoint 1.15.6.14.2.1's own Part S) is
 * the Inspector-side half of the ancestor move/resize restriction: shown
 * only for a container (has children) whose own current rotate or scale
 * is non-identity, never for a leaf, never for translate-only, never when
 * there are no children to be affected.
 */
export function InspectorTransformSection({ node }: InspectorTransformSectionProps) {
  const setElementTransform = useEditorStore((state) => state.setElementTransform);
  const transform = getTransformSettings(node);

  function commitField<K extends keyof TransformSettings>(field: K, next: NumericOrAuto, isValid: (value: number) => boolean) {
    if (typeof next !== "number" || !isValid(next)) return;
    setElementTransform(node.id, withTransformField(transform, field, next));
  }

  const hasChildren = (node.children?.length ?? 0) > 0;
  const hasBlockingRotateOrScale = transform?.rotateDeg !== undefined || transform?.scale !== undefined;
  const showAncestorHint = hasChildren && hasBlockingRotateOrScale;

  return (
    <InspectorSection
      label="Transform"
      actions={<InspectorResetButton onReset={() => setElementTransform(node.id, undefined)} disabled={!transform} label="Reset transform" />}
    >
      <InspectorPropertyRow label="Translate X">
        <InspectorNumericValueControl
          ariaLabel="Translate X"
          value={transform?.translateX ?? 0}
          onCommit={(next) => commitField("translateX", next, isValidTransformTranslate)}
        />
        <span className="text-xs text-zinc-500 dark:text-zinc-400">px</span>
      </InspectorPropertyRow>

      <InspectorPropertyRow label="Translate Y">
        <InspectorNumericValueControl
          ariaLabel="Translate Y"
          value={transform?.translateY ?? 0}
          onCommit={(next) => commitField("translateY", next, isValidTransformTranslate)}
        />
        <span className="text-xs text-zinc-500 dark:text-zinc-400">px</span>
      </InspectorPropertyRow>

      <InspectorPropertyRow label="Rotate">
        <InspectorNumericValueControl
          ariaLabel="Rotate"
          value={transform?.rotateDeg ?? 0}
          onCommit={(next) => commitField("rotateDeg", next, isValidTransformRotateDeg)}
        />
        <span className="text-xs text-zinc-500 dark:text-zinc-400">°</span>
      </InspectorPropertyRow>

      <InspectorPropertyRow label="Scale">
        <InspectorNumericValueControl
          ariaLabel="Scale"
          value={transform?.scale ?? 1}
          onCommit={(next) => commitField("scale", next, isValidTransformScale)}
        />
      </InspectorPropertyRow>

      {showAncestorHint && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Reset this container&apos;s rotation or scale to move or resize its children.
        </p>
      )}

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Transforms change how an element looks without changing the space it occupies in the layout.
      </p>
    </InspectorSection>
  );
}

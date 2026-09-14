"use client";

import { InspectorBulkNumberField } from "@/features/inspector/components/InspectorBulkNumberField";
import { InspectorBulkTextField } from "@/features/inspector/components/InspectorBulkTextField";
import { InspectorProtectedStyleGroup } from "@/features/inspector/components/InspectorProtectedStyleGroup";
import { InspectorPropertyRow } from "@/features/inspector/components/InspectorPropertyRow";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { InspectorSegmentedRow } from "@/features/inspector/components/InspectorSegmentedRow";
import { resolveSharedValue, withSharedFallback } from "@/features/inspector/types/sharedValue";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { isValidCssColor } from "@/features/editor/utils/cssColor";
import { getSvgKind, type SvgPrimitiveKind } from "@/features/editor/types/svg";
import type { StyleProtectionResult } from "@/features/editor/rules/styleProtection";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorBulkSvgSectionProps {
  nodes: readonly EditorElementNode[];
  protections: readonly StyleProtectionResult[];
}

const PRIMITIVE_OPTIONS = ["Rectangle", "Circle", "Triangle", "Star"];
const NO_ACTIVE_OPTION = "";
const PRIMITIVE_LABEL_TO_VALUE: Record<string, SvgPrimitiveKind> = {
  Rectangle: "rectangle",
  Circle: "circle",
  Triangle: "triangle",
  Star: "star",
};
const PRIMITIVE_VALUE_TO_LABEL: Record<SvgPrimitiveKind, string> = {
  rectangle: "Rectangle",
  circle: "Circle",
  triangle: "Triangle",
  star: "Star",
};

/**
 * The multi-selection SVG surface (Checkpoint 1.15.5, section 35 of its
 * own brief) — Primitive/Fill/Stroke/Stroke Width all get bulk support
 * (ViewBox bulk editing is explicitly omitted per that same section: four
 * independent numeric fields across a mixed selection has no single
 * coherent "mixed" affordance worth building for a foundation
 * checkpoint). Rendered as its own standalone section OUTSIDE
 * InspectorMultiNodeSummary's big shared InspectorProtectedStyleGroup —
 * unlike every other bulk CSS section, this one needs PARTIAL protection
 * (Primitive stays interactive even when protected; Fill/Stroke/Stroke
 * Width don't), the exact same content-vs-style split
 * InspectorSvgSection draws for the single-selection case.
 */
export function InspectorBulkSvgSection({ nodes, protections }: InspectorBulkSvgSectionProps) {
  const setElementsSvgKind = useEditorStore((state) => state.setElementsSvgKind);
  const setElementsSvgFill = useEditorStore((state) => state.setElementsSvgFill);
  const setElementsSvgStroke = useEditorStore((state) => state.setElementsSvgStroke);
  const setElementsSvgStrokeWidth = useEditorStore((state) => state.setElementsSvgStrokeWidth);
  const ids = nodes.map((node) => node.id);
  const anyProtected = protections.some((result) => result.protected);

  const kind = resolveSharedValue(nodes, (node) => getSvgKind(node));
  const fill = resolveSharedValue(nodes, (node) => node.svgFill);
  const stroke = resolveSharedValue(nodes, (node) => node.svgStroke);
  const strokeWidth = resolveSharedValue(nodes, (node) => node.svgStrokeWidth);

  return (
    <InspectorSection label="SVG">
      <InspectorSegmentedRow
        label="Primitive"
        options={PRIMITIVE_OPTIONS}
        activeOption={kind.kind === "same" ? PRIMITIVE_VALUE_TO_LABEL[kind.value] : NO_ACTIVE_OPTION}
        onSelect={(option) => setElementsSvgKind(ids, PRIMITIVE_LABEL_TO_VALUE[option])}
      />

      <InspectorProtectedStyleGroup protected={anyProtected}>
        <div className="flex flex-col gap-2">
          <InspectorPropertyRow label="Fill" state={fill.kind === "mixed" ? "mixed" : fill.value ? "set" : "unset"}>
            <InspectorBulkTextField
              ariaLabel="Fill"
              shared={withSharedFallback(fill, "")}
              placeholder="Unset"
              onCommit={(value) => {
                if (!isValidCssColor(value)) return;
                setElementsSvgFill(ids, value);
              }}
            />
          </InspectorPropertyRow>
          <InspectorPropertyRow label="Stroke" state={stroke.kind === "mixed" ? "mixed" : stroke.value ? "set" : "unset"}>
            <InspectorBulkTextField
              ariaLabel="Stroke"
              shared={withSharedFallback(stroke, "")}
              placeholder="Unset"
              onCommit={(value) => {
                if (!isValidCssColor(value)) return;
                setElementsSvgStroke(ids, value);
              }}
            />
          </InspectorPropertyRow>
          <InspectorPropertyRow label="Stroke Width" state={strokeWidth.kind === "mixed" ? "mixed" : "set"}>
            <InspectorBulkNumberField
              ariaLabel="Stroke Width"
              shared={withSharedFallback(strokeWidth, 1)}
              min={0}
              onCommit={(value) => setElementsSvgStrokeWidth(ids, Math.max(0, value))}
            />
          </InspectorPropertyRow>
        </div>
      </InspectorProtectedStyleGroup>

      <p className="px-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">
        Primitive stays editable even when child styles are locked; Fill, Stroke, and Stroke Width respect Parent Style Protection.
      </p>
    </InspectorSection>
  );
}

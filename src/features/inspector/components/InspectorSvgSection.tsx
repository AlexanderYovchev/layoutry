"use client";

import { useState } from "react";
import { InspectorColorFieldShell } from "@/features/inspector/components/InspectorColorFieldShell";
import { InspectorNumberFieldRow } from "@/features/inspector/components/InspectorNumberFieldRow";
import { InspectorProtectedStyleGroup } from "@/features/inspector/components/InspectorProtectedStyleGroup";
import { InspectorPropertyRow } from "@/features/inspector/components/InspectorPropertyRow";
import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { InspectorSegmentedRow } from "@/features/inspector/components/InspectorSegmentedRow";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { isValidCssColor } from "@/features/editor/utils/cssColor";
import { getSvgKind, resolveSvgViewBox, type SvgPrimitiveKind } from "@/features/editor/types/svg";
import type { StyleProtectionResult } from "@/features/editor/rules/styleProtection";
import type { EditorElementNode } from "@/features/editor/types/document";

interface InspectorSvgSectionProps {
  node: EditorElementNode;
  protection: StyleProtectionResult;
}

const PRIMITIVE_OPTIONS = ["Rectangle", "Circle", "Triangle", "Star"];
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
 * The SVG Foundation Inspector section (Checkpoint 1.15.5) — Primitive
 * and ViewBox first (vector CONTENT, never wrapped in
 * InspectorProtectedStyleGroup — see this checkpoint's own report,
 * section J, for the exact style-vs-content boundary), then Fill/Stroke/
 * Stroke Width (visual STYLING, wrapped in the exact same protection
 * group every other CSS section already uses). This is the one Inspector
 * section in the app that needs partial, not whole-section, protection
 * wrapping — a deliberate consequence of SVG's own content/style split,
 * not an oversight; every other section either wraps entirely or not at
 * all.
 */
export function InspectorSvgSection({ node, protection }: InspectorSvgSectionProps) {
  const setSvgKind = useEditorStore((state) => state.setSvgKind);
  const setSvgViewBox = useEditorStore((state) => state.setSvgViewBox);
  const setSvgFill = useEditorStore((state) => state.setSvgFill);
  const setSvgStroke = useEditorStore((state) => state.setSvgStroke);
  const setSvgStrokeWidth = useEditorStore((state) => state.setSvgStrokeWidth);
  const enterSvgEditMode = useEditorStore((state) => state.enterSvgEditMode);

  const [fillError, setFillError] = useState<string | undefined>(undefined);
  const [strokeError, setStrokeError] = useState<string | undefined>(undefined);

  const [lastNodeId, setLastNodeId] = useState(node.id);
  if (node.id !== lastNodeId) {
    setLastNodeId(node.id);
    setFillError(undefined);
    setStrokeError(undefined);
  }

  const kind = getSvgKind(node);
  const viewBox = resolveSvgViewBox(node);

  function commitFill(text: string) {
    if (!isValidCssColor(text)) {
      setFillError("Enter a hex color (#RRGGBB) or an rgb()/rgba() value.");
      return;
    }
    setFillError(undefined);
    setSvgFill(node.id, text);
  }

  function commitStroke(text: string) {
    if (!isValidCssColor(text)) {
      setStrokeError("Enter a hex color (#RRGGBB) or an rgb()/rgba() value.");
      return;
    }
    setStrokeError(undefined);
    setSvgStroke(node.id, text);
  }

  return (
    <InspectorSection
      label="SVG"
      actions={
        // Checkpoint 1.15.6 — the entry point into SVG Drawing Mode
        // (double-clicking the SVG on the Canvas is the other one; see
        // SvgElement.tsx's own handleDoubleClick). Materializes a legacy
        // starter primitive into an equivalent scene object on first
        // entry (see enterSvgEditMode's own doc comment) — invisible here,
        // since InspectorSvgSection itself stops rendering the instant
        // svgEditingNodeId matches this node (see InspectorNodeSummary's
        // own routing), replaced by InspectorSvgDrawingModeSection.
        <button
          type="button"
          onClick={() => enterSvgEditMode(node.id)}
          className="flex h-6 items-center justify-center rounded-md border border-zinc-200 px-2 text-xs font-medium text-zinc-600 transition-colors duration-150 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800/50"
        >
          Edit SVG
        </button>
      }
    >
      <InspectorSegmentedRow
        label="Primitive"
        options={PRIMITIVE_OPTIONS}
        activeOption={PRIMITIVE_VALUE_TO_LABEL[kind]}
        onSelect={(option) => setSvgKind(node.id, PRIMITIVE_LABEL_TO_VALUE[option])}
      />

      <InspectorProtectedStyleGroup protected={protection.protected}>
        <div className="flex flex-col gap-2">
          <InspectorPropertyRow label="Fill" state={fillError ? "invalid" : node.svgFill ? "set" : "unset"} error={fillError}>
            <InspectorColorFieldShell label="Fill" value={node.svgFill ?? null} onCommit={commitFill} onReset={() => setSvgFill(node.id, undefined)} error={fillError} />
          </InspectorPropertyRow>
          <InspectorPropertyRow label="Stroke" state={strokeError ? "invalid" : node.svgStroke ? "set" : "unset"} error={strokeError}>
            <InspectorColorFieldShell
              label="Stroke"
              value={node.svgStroke ?? null}
              onCommit={commitStroke}
              onReset={() => setSvgStroke(node.id, undefined)}
              error={strokeError}
            />
          </InspectorPropertyRow>
          <InspectorNumberFieldRow
            label="Stroke Width"
            value={node.svgStrokeWidth ?? 1}
            onCommit={(value) => setSvgStrokeWidth(node.id, Math.max(0, value))}
          />
        </div>
      </InspectorProtectedStyleGroup>

      <InspectorPropertyRow label="ViewBox" variant="stack">
        <div className="grid grid-cols-2 gap-1.5">
          {/* "ViewBox " prefixed on Width/Height specifically (not Min X/Min
              Y, which are already unambiguous) — InspectorNumberFieldRow's
              own `label` prop drives both the visible text and the field's
              accessible name, and a bare "Width"/"Height" would otherwise
              collide with InspectorSizeSection's and InspectorBorderSection's
              own identically-named fields on the very same node. */}
          <InspectorNumberFieldRow label="Min X" value={viewBox.minX} onCommit={(minX) => setSvgViewBox(node.id, { ...viewBox, minX })} />
          <InspectorNumberFieldRow label="Min Y" value={viewBox.minY} onCommit={(minY) => setSvgViewBox(node.id, { ...viewBox, minY })} />
          <InspectorNumberFieldRow
            label="ViewBox Width"
            value={viewBox.width}
            onCommit={(width) => setSvgViewBox(node.id, { ...viewBox, width: Math.max(1, width) })}
          />
          <InspectorNumberFieldRow
            label="ViewBox Height"
            value={viewBox.height}
            onCommit={(height) => setSvgViewBox(node.id, { ...viewBox, height: Math.max(1, height) })}
          />
        </div>
      </InspectorPropertyRow>

      <p className="px-0.5 text-[11px] text-fg-secondary">
        Primitive and ViewBox are vector content, so they stay editable even when child styles are locked.
      </p>
    </InspectorSection>
  );
}

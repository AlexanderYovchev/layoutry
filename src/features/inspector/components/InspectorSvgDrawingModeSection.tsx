"use client";

import { InspectorSection } from "@/features/inspector/components/InspectorSection";
import { InspectorSegmentedRow } from "@/features/inspector/components/InspectorSegmentedRow";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { SvgDrawingTool } from "@/features/editor/types/svgEditMode";

const TOOL_OPTIONS = ["Select", "Rectangle", "Ellipse", "Line", "Polygon", "Pen"];
const TOOL_LABEL_TO_VALUE: Record<string, SvgDrawingTool> = {
  Select: "select",
  Rectangle: "rect",
  Ellipse: "ellipse",
  Line: "line",
  Polygon: "polygon",
  Pen: "pen",
};
const TOOL_VALUE_TO_LABEL: Record<SvgDrawingTool, string> = {
  select: "Select",
  rect: "Rectangle",
  ellipse: "Ellipse",
  line: "Line",
  polygon: "Polygon",
  pen: "Pen",
};

/**
 * The SVG Drawing Tool's own contextual toolbar (Checkpoint 1.15.6,
 * section F/Q of its own brief: tool placement is "NOT the global HTML
 * Creation Toolbar — a small contextual vector toolbar... within the
 * Inspector; must be visually clear the user is editing inside the
 * SVG"). Replaces InspectorSvgSection entirely while this SVG is the
 * active `svgEditingNodeId` (see InspectorNodeSummary's own routing) —
 * Primitive/ViewBox/Fill/Stroke/Stroke Width all become moot the moment a
 * vector scene exists, so showing both sections side by side would only
 * ever confuse which one governs the visible geometry.
 *
 * "Done" exits Drawing Mode without touching the document (see
 * exitSvgEditMode's own doc comment — it's pure UI state) — identical in
 * effect to clicking outside the SVG or pressing Escape with nothing
 * selected/drafted.
 */
export function InspectorSvgDrawingModeSection() {
  const activeSvgTool = useEditorStore((state) => state.activeSvgTool);
  const setActiveSvgTool = useEditorStore((state) => state.setActiveSvgTool);
  const exitSvgEditMode = useEditorStore((state) => state.exitSvgEditMode);

  return (
    <InspectorSection
      label="Drawing Mode"
      defaultOpen
      actions={
        <button
          type="button"
          onClick={exitSvgEditMode}
          className="flex h-6 items-center justify-center rounded-md border border-zinc-200 px-2 text-xs font-medium text-zinc-600 transition-colors duration-150 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800/50"
        >
          Done
        </button>
      }
    >
      <InspectorSegmentedRow
        label="Tool"
        options={TOOL_OPTIONS}
        activeOption={TOOL_VALUE_TO_LABEL[activeSvgTool]}
        onSelect={(option) => setActiveSvgTool(TOOL_LABEL_TO_VALUE[option])}
      />
      <p className="px-0.5 text-[11px] text-fg-secondary">
        Editing inside this SVG. Draw a shape, or switch to Select to move, resize, and style existing ones.
      </p>
    </InspectorSection>
  );
}

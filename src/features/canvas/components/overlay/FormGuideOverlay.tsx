"use client";

import type { RefObject } from "react";
import { useMeasuredNodeRect } from "@/features/canvas/hooks/useMeasuredNodeRect";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";

interface FormGuideOverlayProps {
  canvasRootRef: RefObject<HTMLElement | null>;
}

function collectFormNodes(node: EditorElementNode, nodes: EditorElementNode[] = []): EditorElementNode[] {
  if (node.tag === "form") nodes.push(node);
  for (const child of node.children ?? []) collectFormNodes(child, nodes);
  return nodes;
}

interface SingleFormGuideProps {
  canvasRootRef: RefObject<HTMLElement | null>;
  node: EditorElementNode;
}

/**
 * One Form's design-time boundary + empty-state hint (Checkpoint 1.12.1)
 * — a beginner-usability affordance, not exported markup: a freshly
 * created Form otherwise renders identically to a generic Container,
 * which manual QA flagged as confusing. Follows the exact same overlay
 * shape SelectionOverlay/HoverOverlay already establish (an
 * absolutely-positioned sibling measured via useMeasuredNodeRect, never
 * touching the real node's own layout, never exported — CanvasOverlay's
 * whole layer is aria-hidden and pointer-events-none), just amber instead
 * of blue so it never competes with the real (blue) selection outline
 * when a Form happens to also be selected. Renders for every Form on the
 * canvas, not only the selected one — an empty Form needs to read as a
 * drop target while dragging a control onto it, not just while selected.
 */
function SingleFormGuide({ canvasRootRef, node }: SingleFormGuideProps) {
  const rect = useMeasuredNodeRect(canvasRootRef, node.id);
  if (!rect) return null;

  const isEmpty = (node.children?.length ?? 0) === 0;

  return (
    <div
      data-canvas-overlay="form-guide"
      className="absolute rounded-xs outline-1 -outline-offset-1 outline-dashed outline-amber-400/70"
      style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
    >
      <span className="absolute left-0 top-0 rounded-br-md rounded-tl-xs bg-amber-400/90 px-1.5 py-0.5 text-[10px] font-medium text-amber-950">
        Form
      </span>
      {isEmpty && rect.width >= 80 && rect.height >= 32 && (
        <p className="absolute inset-0 flex items-center justify-center px-2 text-center text-[11px] text-amber-700/80 dark:text-amber-400/80">
          Drop form controls here
        </p>
      )}
    </div>
  );
}

/** Renders a SingleFormGuide for every `form` node currently in the document — see SingleFormGuide's own doc comment. */
export function FormGuideOverlay({ canvasRootRef }: FormGuideOverlayProps) {
  const document = useEditorStore((state) => state.document);
  const formNodes = collectFormNodes(document);

  return (
    <>
      {formNodes.map((node) => (
        <SingleFormGuide key={node.id} canvasRootRef={canvasRootRef} node={node} />
      ))}
    </>
  );
}

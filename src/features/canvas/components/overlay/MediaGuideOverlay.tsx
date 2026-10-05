"use client";

import type { RefObject } from "react";
import { useMeasuredNodeRect } from "@/features/canvas/hooks/useMeasuredNodeRect";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";

interface MediaGuideOverlayProps {
  canvasRootRef: RefObject<HTMLElement | null>;
}

const MEDIA_LABELS: Record<string, string> = { video: "Video", iframe: "Embed", audio: "Audio" };

const EMPTY_SOURCE_MEDIA_TAGS: ReadonlySet<string> = new Set(["video", "iframe", "audio"]);

function collectEmptyMediaNodes(node: EditorElementNode, nodes: EditorElementNode[] = []): EditorElementNode[] {
  if (EMPTY_SOURCE_MEDIA_TAGS.has(node.tag) && !node.src) nodes.push(node);
  for (const child of node.children ?? []) collectEmptyMediaNodes(child, nodes);
  return nodes;
}

interface SingleMediaGuideProps {
  canvasRootRef: RefObject<HTMLElement | null>;
  node: EditorElementNode;
}

/**
 * One sourceless Video/Iframe's Canvas empty-state hint (Checkpoint 1.15)
 * — the exact same overlay shape FormGuideOverlay already established
 * (an absolutely-positioned sibling measured via useMeasuredNodeRect,
 * never touching the real node's own layout, never exported — see
 * CanvasOverlay's own aria-hidden/pointer-events-none wrapper). Unlike
 * Form's boundary+badge treatment, this is deliberately a plain centered
 * label (no dashed drop-target boundary): a sourceless Video/Iframe
 * doesn't accept dropped children the way an empty Form does, so implying
 * a drop target here would be misleading. Renders only while `src` is
 * genuinely empty — the real `<video>`/`<iframe>` underneath is always
 * present and genuine regardless (see VideoElement/IframeElement's own
 * doc comments); this hint disappears the instant a Source URL is set,
 * with no separate "clear the hint" step, since it's derived fresh from
 * the same node data on every render.
 */
function SingleMediaGuide({ canvasRootRef, node }: SingleMediaGuideProps) {
  const rect = useMeasuredNodeRect(canvasRootRef, node.id);
  if (!rect) return null;
  if (rect.width < 60 || rect.height < 32) return null;

  return (
    <div
      data-canvas-overlay="media-guide"
      className="absolute flex flex-col items-center justify-center gap-0.5 bg-zinc-900/5 text-center dark:bg-zinc-50/5"
      style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
    >
      <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{MEDIA_LABELS[node.tag]}</span>
      <span className="px-2 text-[11px] text-zinc-400 dark:text-zinc-500">Add a source URL</span>
    </div>
  );
}

/** Renders a SingleMediaGuide for every sourceless `video`/`iframe` node currently in the document — see SingleMediaGuide's own doc comment. */
export function MediaGuideOverlay({ canvasRootRef }: MediaGuideOverlayProps) {
  const document = useEditorStore((state) => state.document);
  const emptyMediaNodes = collectEmptyMediaNodes(document);

  return (
    <>
      {emptyMediaNodes.map((node) => (
        <SingleMediaGuide key={node.id} canvasRootRef={canvasRootRef} node={node} />
      ))}
    </>
  );
}

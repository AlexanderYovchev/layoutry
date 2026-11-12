"use client";

import type { RefObject } from "react";
import { useHostOrigin } from "@/features/canvas/hooks/useHostOrigin";
import { useMeasuredNodeRect } from "@/features/canvas/hooks/useMeasuredNodeRect";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";
import { isVideoEmbedNode } from "@/features/editor/types/videoEmbed";
import { resolveIframeSourcePolicy } from "@/lib/iframeSandbox";

interface MediaGuideOverlayProps {
  canvasRootRef: RefObject<HTMLElement | null>;
}

const MEDIA_LABELS: Record<string, string> = { video: "Video", iframe: "Embed", audio: "Audio" };

const EMPTY_SOURCE_MEDIA_TAGS: ReadonlySet<string> = new Set(["video", "iframe", "audio"]);

const EMPTY_SOURCE_HINT = "Add a source URL";
const REFUSED_EMBED_HINT = "Use an http or https address";

interface MediaGuide {
  node: EditorElementNode;
  hint: string;
}

// An embed whose source the iframe policy refuses (BC-02.3: data:, blob:,
// file:, about:, ...) renders as an empty frame too, so it gets a guide
// saying why instead of looking silently broken.
// A Video Embed (BC-08.2) shows its own empty state in its placeholder.
function collectMediaGuides(node: EditorElementNode, hostOrigin: string | null, guides: MediaGuide[] = []): MediaGuide[] {
  if (EMPTY_SOURCE_MEDIA_TAGS.has(node.tag) && !isVideoEmbedNode(node)) {
    if (!node.src) guides.push({ node, hint: EMPTY_SOURCE_HINT });
    else if (node.tag === "iframe" && hostOrigin !== null && resolveIframeSourcePolicy(node.src, hostOrigin).refused) guides.push({ node, hint: REFUSED_EMBED_HINT });
  }
  for (const child of node.children ?? []) collectMediaGuides(child, hostOrigin, guides);
  return guides;
}

interface SingleMediaGuideProps {
  canvasRootRef: RefObject<HTMLElement | null>;
  node: EditorElementNode;
  hint: string;
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
function SingleMediaGuide({ canvasRootRef, node, hint }: SingleMediaGuideProps) {
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
      <span className="px-2 text-[11px] text-zinc-400 dark:text-zinc-500">{hint}</span>
    </div>
  );
}

/** Renders a SingleMediaGuide for every sourceless `video`/`iframe` node (and every embed whose source is refused) currently in the document — see SingleMediaGuide's own doc comment. */
export function MediaGuideOverlay({ canvasRootRef }: MediaGuideOverlayProps) {
  const document = useEditorStore((state) => state.document);
  const hostOrigin = useHostOrigin();
  const guides = collectMediaGuides(document, hostOrigin);

  return (
    <>
      {guides.map(({ node, hint }) => (
        <SingleMediaGuide key={node.id} canvasRootRef={canvasRootRef} node={node} hint={hint} />
      ))}
    </>
  );
}

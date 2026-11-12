"use client";

import { MonitorPlay } from "lucide-react";
import { summarizeVideoEmbed } from "@/features/canvas/utils/videoEmbedSummary";
import type { EditorElementNode } from "@/features/editor/types/document";

interface VideoEmbedPlaceholderProps {
  node: EditorElementNode;
  isPreview: boolean;
}

/**
 * The Canvas stand-in for a Video Embed (BC-08.2, approved decision 4): a
 * static, local box — no provider iframe, thumbnail, metadata or script,
 * so opening or editing a project never contacts YouTube, Vimeo or any
 * other provider. It fills the embed's own layout box (IframeElement's
 * wrapper), so selection, drag, resize, Flow/Free/Flex/Grid placement and
 * the authored border, radius and background behave exactly as for any
 * Embed. Every line truncates and the wrapper clips, so the text never
 * escapes a small box.
 *
 * Preview (interim, until BC-08.3 adds the player and its lifecycle): the
 * same placeholder, saying so, so nothing plays without the lifecycle that
 * stops it.
 */
export function VideoEmbedPlaceholder({ node, isPreview }: VideoEmbedPlaceholderProps) {
  const { providerName, settings } = summarizeVideoEmbed(node);
  const heading = providerName ? `${providerName} video` : "Video Embed";
  const note = !providerName ? "Paste a video link in the Inspector" : isPreview ? "The player isn't available in Preview yet" : "No video is loaded while you design";
  // The title is shown only when it adds something (not the provider's own default, e.g. "YouTube video").
  const title = node.title && node.title !== heading ? node.title : undefined;
  const label = [heading, title, note].filter(Boolean).join(". ");

  return (
    <div
      role="img"
      aria-label={label}
      data-video-embed-placeholder={providerName ? "ready" : "empty"}
      className="absolute inset-0 flex min-w-0 flex-col items-center justify-center gap-1 overflow-hidden p-2 text-center"
    >
      <MonitorPlay aria-hidden="true" className="size-8 shrink-0 text-zinc-300 dark:text-zinc-700" />
      <span className="max-w-full truncate text-xs font-medium text-zinc-600 dark:text-zinc-300">{heading}</span>
      {providerName && title && <span className="max-w-full truncate text-[11px] text-zinc-500 dark:text-zinc-400">{title}</span>}
      {settings.length > 0 && <span className="max-w-full truncate text-[11px] text-zinc-500 dark:text-zinc-400">{settings.join(" · ")}</span>}
      <span className="max-w-full truncate text-[11px] text-zinc-400 dark:text-zinc-500">{note}</span>
    </div>
  );
}

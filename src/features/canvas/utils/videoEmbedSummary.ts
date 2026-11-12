import type { EditorElementNode } from "@/features/editor/types/document";
import { getEffectiveAutoplay } from "@/features/editor/types/video";
import { readVideoEmbedSource } from "@/lib/videoEmbed/buildVideoEmbedUrl";
import { formatStartTime } from "@/lib/videoEmbed/videoEmbedTime";
import { getVideoEmbedProvider, providerSupports } from "@/lib/videoEmbed/videoEmbedProviders";

export interface VideoEmbedSummary {
  /** The provider's name, or undefined while the embed has no valid link. */
  providerName: string | undefined;
  /** Short labels for the settings that will actually apply (unsupported ones are left out). */
  settings: string[];
}

/**
 * What the Canvas placeholder says about a Video Embed (BC-08.2). Read
 * from the document only — no provider request, thumbnail or metadata
 * lookup. Settings the provider cannot apply are not listed, and Autoplay
 * is listed only when it would really start (autoplay AND muted).
 */
export function summarizeVideoEmbed(node: EditorElementNode): VideoEmbedSummary {
  const source = readVideoEmbedSource(node.src);
  if (!source) return { providerName: undefined, settings: [] };
  const { provider } = source;
  const settings: string[] = [];
  if (node.muted === true && providerSupports(provider, "muted")) settings.push("Muted");
  if (getEffectiveAutoplay(node) && providerSupports(provider, "autoplay")) settings.push("Autoplay");
  if (node.loop === true && providerSupports(provider, "loop")) settings.push("Loop");
  if (node.controls === false && providerSupports(provider, "controls")) settings.push("No controls");
  if (source.startSeconds !== undefined) settings.push(`Starts at ${formatStartTime(source.startSeconds)}`);
  if (source.privacy) settings.push("Privacy mode");
  return { providerName: getVideoEmbedProvider(provider).displayName, settings };
}

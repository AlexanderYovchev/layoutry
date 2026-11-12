import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { findNodeById } from "@/features/editor/utils/findNodeById";
import { isVideoEmbedNode } from "@/features/editor/types/videoEmbed";
import { resolveVideoEmbedSourceInput } from "@/lib/videoEmbed/buildVideoEmbedUrl";
import type { VideoEmbedParseFailure } from "@/lib/videoEmbed/parseVideoEmbedUrl";
import {
  DEFERRED_VIDEO_PROVIDERS,
  VIDEO_EMBED_PROVIDERS,
  isDeferredVideoProviderId,
  isVideoEmbedProviderId,
  type DeferredVideoProviderId,
  type VideoEmbedProviderId,
} from "@/lib/videoEmbed/videoEmbedProviders";

/** The neutral title createVideoEmbedNode starts with. */
export const DEFAULT_VIDEO_EMBED_TITLE = "Embedded video";

function providerName(provider: VideoEmbedProviderId | DeferredVideoProviderId | undefined): string {
  if (provider === undefined) return "That";
  return isVideoEmbedProviderId(provider) ? VIDEO_EMBED_PROVIDERS[provider].displayName : DEFERRED_VIDEO_PROVIDERS[provider].displayName;
}

/** What the Video URL field says for each way a pasted link can fail. */
export function videoEmbedUrlErrorMessage(reason: VideoEmbedParseFailure, provider?: VideoEmbedProviderId | DeferredVideoProviderId): string {
  switch (reason) {
    case "empty":
      return "Paste a video link.";
    case "malformed":
      return "That isn't a web address. Paste the video's link.";
    case "protocol-relative":
      return "Paste the full link, starting with https://.";
    case "not-https":
      return "Use the video's https:// link.";
    case "unsafe-scheme":
      return "Only https:// video links are supported.";
    case "credentials":
      return "Links with a user name or password aren't supported.";
    case "port":
      return "Links with a port number aren't supported.";
    case "unknown-host":
      return "That isn't a YouTube, Vimeo, Loom or Wistia link.";
    case "unsupported-path":
      return `That ${providerName(provider)} link isn't a single video. Paste the video's own link.`;
    case "invalid-id":
      return `That ${providerName(provider)} link has an invalid video ID.`;
    case "deferred-provider":
      return provider !== undefined && isDeferredVideoProviderId(provider) ? DEFERRED_VIDEO_PROVIDERS[provider].blocker : "Videos from this site aren't supported yet.";
  }
}

/** A title the user never chose: the starter one, or another provider's default. */
function isDefaultTitle(title: string | undefined): boolean {
  if (title === undefined || title === DEFAULT_VIDEO_EMBED_TITLE) return true;
  return Object.values(VIDEO_EMBED_PROVIDERS).some((provider) => provider.defaultTitle === title);
}

export type VideoEmbedUrlCommitResult = { ok: true } | { ok: false; message: string };

/**
 * Commits a typed or pasted Video URL (BC-08.2, approved decision 13):
 * - invalid: nothing is written — the last valid source stays, no Undo
 *   step, and the project is not marked changed; the caller shows
 *   `message` and keeps the draft;
 * - valid: the canonical source (and, if the title was never customized,
 *   the provider's default title) are written as ONE Undo step;
 * - the same video again: no change, no Undo step.
 */
export function commitVideoEmbedUrl(nodeId: string, input: string): VideoEmbedUrlCommitResult {
  const store = useEditorStore.getState();
  const node = findNodeById(store.document, nodeId);
  if (!node || !isVideoEmbedNode(node)) return { ok: false, message: "This element is not a Video Embed." };
  const resolved = resolveVideoEmbedSourceInput(input, node.src);
  if (!resolved.ok) return { ok: false, message: videoEmbedUrlErrorMessage(resolved.reason, resolved.provider) };
  const title = VIDEO_EMBED_PROVIDERS[resolved.reference.provider].defaultTitle;
  const retitle = isDefaultTitle(node.title) && node.title !== title;
  if (resolved.src === node.src && !retitle) return { ok: true };
  store.beginTransaction({ mergeHistory: true });
  store.mergeTransactionWrite(() => {
    const current = useEditorStore.getState();
    current.setElementSrc(nodeId, resolved.src);
    if (retitle) current.setElementTitle(nodeId, title);
  });
  useEditorStore.getState().commitTransaction();
  return { ok: true };
}

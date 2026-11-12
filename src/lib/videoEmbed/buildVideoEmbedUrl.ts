import { parseVideoEmbedUrl, type VideoEmbedParseResult, type VideoEmbedReference } from "@/lib/videoEmbed/parseVideoEmbedUrl";
import { providerSupports, type VideoEmbedProviderId } from "@/lib/videoEmbed/videoEmbedProviders";

/**
 * Building embed URLs (BC-08.2). Only these functions ever assemble a
 * provider URL, always from a validated VideoEmbedReference, always on the
 * provider's own https embed host, with values set through URLSearchParams.
 *
 * Two layers, so each setting has exactly one home in the document:
 * - The SOURCE (buildVideoEmbedSource) is what a Video Embed stores in
 *   `src`: which video, its unlisted hash, its start time, and whether the
 *   privacy mode is on. It never carries playback settings.
 * - The PLAYER URL (buildVideoEmbedPlayerUrl) adds the playback settings,
 *   which live in the node's own autoplay/muted/loop/controls fields.
 *   BC-08.3 uses it for Preview and Export; nothing loads it in BC-08.2.
 */

export interface StoredVideoEmbed extends VideoEmbedReference {
  privacy: boolean;
}

export interface VideoEmbedPlayback {
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  controls?: boolean;
}

function startParam(reference: StoredVideoEmbed, provider: VideoEmbedProviderId): number | undefined {
  return providerSupports(provider, "startTime") && reference.startSeconds !== undefined && reference.startSeconds > 0 ? reference.startSeconds : undefined;
}

function sourceUrl(reference: StoredVideoEmbed): URL {
  const { provider, videoId } = reference;
  const start = startParam(reference, provider);
  switch (provider) {
    case "youtube": {
      const url = new URL(`https://${reference.privacy ? "www.youtube-nocookie.com" : "www.youtube.com"}/embed/${videoId}`);
      if (start !== undefined) url.searchParams.set("start", String(start));
      return url;
    }
    case "vimeo": {
      const url = new URL(`https://player.vimeo.com/video/${videoId}`);
      if (reference.hash !== undefined) url.searchParams.set("h", reference.hash);
      if (reference.privacy) url.searchParams.set("dnt", "1");
      if (start !== undefined) url.hash = `t=${start}s`;
      return url;
    }
    case "loom": {
      const url = new URL(`https://www.loom.com/embed/${videoId}`);
      if (start !== undefined) url.searchParams.set("t", `${start}s`);
      return url;
    }
    case "wistia": {
      const url = new URL(`https://fast.wistia.net/embed/iframe/${videoId}`);
      if (reference.privacy) url.searchParams.set("doNotTrack", "true");
      if (start !== undefined) url.searchParams.set("time", String(start));
      return url;
    }
  }
}

/** The canonical `src` a Video Embed stores. Deterministic: rebuilding a parsed source gives the same string. */
export function buildVideoEmbedSource(reference: StoredVideoEmbed): string {
  return sourceUrl({ ...reference, privacy: reference.privacy && providerSupports(reference.provider, "privacyMode") }).href;
}

/**
 * The URL a player is loaded from (BC-08.3). Muted-only autoplay
 * (BC-02.2.1): autoplay is requested only when the embed is authored both
 * autoplay AND muted; muted is never forced on. Providers whose owners can
 * switch autoplay on in their account (Vimeo, Wistia) get an explicit
 * "off", which their documentation says takes priority. A setting the
 * provider does not support adds nothing.
 */
export function buildVideoEmbedPlayerUrl(reference: StoredVideoEmbed, playback: VideoEmbedPlayback): string {
  const url = new URL(buildVideoEmbedSource(reference));
  const { provider, videoId } = reference;
  const muted = playback.muted === true && providerSupports(provider, "muted");
  const autoplay = playback.autoplay === true && muted && providerSupports(provider, "autoplay");
  const loop = playback.loop === true && providerSupports(provider, "loop");
  const hideControls = playback.controls === false && providerSupports(provider, "controls");
  const params = url.searchParams;
  switch (provider) {
    case "youtube":
      if (autoplay) params.set("autoplay", "1");
      if (muted) params.set("mute", "1");
      if (loop) {
        params.set("loop", "1");
        params.set("playlist", videoId);
      }
      if (hideControls) params.set("controls", "0");
      break;
    case "vimeo":
      params.set("autoplay", autoplay ? "1" : "0");
      if (muted) params.set("muted", "1");
      if (loop) params.set("loop", "1");
      break;
    case "loom":
      if (autoplay) params.set("autoplay", "1");
      if (muted) params.set("muted", "1");
      break;
    case "wistia":
      params.set("autoPlay", autoplay ? "true" : "false");
      if (muted) params.set("muted", "true");
      if (loop) params.set("endVideoBehavior", "loop");
      break;
  }
  return url.href;
}

/** A stored Video Embed source, read back (privacy is off unless the source says so). */
export function readVideoEmbedSource(src: string | undefined): StoredVideoEmbed | undefined {
  if (src === undefined || src === "") return undefined;
  const parsed = parseVideoEmbedUrl(src);
  return parsed.ok ? { ...parsed.reference, privacy: parsed.reference.privacy ?? false } : undefined;
}

export type VideoEmbedSourceInputResult = { ok: true; src: string; reference: StoredVideoEmbed } | Extract<VideoEmbedParseResult, { ok: false }>;

/**
 * What a pasted link becomes (Inspector Video URL). The privacy mode is
 * taken from the link when it states one; otherwise the current choice is
 * kept for the same provider, and a new provider starts with privacy ON
 * wherever it has a privacy mode (approved default: YouTube nocookie,
 * Vimeo dnt). The start time comes from the pasted link only.
 */
export function resolveVideoEmbedSourceInput(input: string, currentSrc: string | undefined): VideoEmbedSourceInputResult {
  const parsed = parseVideoEmbedUrl(input);
  if (!parsed.ok) return parsed;
  const current = readVideoEmbedSource(currentSrc);
  const privacy = parsed.reference.privacy ?? (current?.provider === parsed.reference.provider ? current.privacy : true);
  const reference: StoredVideoEmbed = { ...parsed.reference, privacy: privacy && providerSupports(parsed.reference.provider, "privacyMode") };
  return { ok: true, src: buildVideoEmbedSource(reference), reference };
}

/** The same source with a different privacy choice. */
export function withVideoEmbedPrivacy(src: string, privacy: boolean): string | undefined {
  const current = readVideoEmbedSource(src);
  return current ? buildVideoEmbedSource({ ...current, privacy }) : undefined;
}

/** The same source with a different start time (undefined or 0 removes it). */
export function withVideoEmbedStart(src: string, startSeconds: number | undefined): string | undefined {
  const current = readVideoEmbedSource(src);
  if (!current) return undefined;
  const next: StoredVideoEmbed = { ...current };
  delete next.startSeconds;
  if (startSeconds !== undefined && startSeconds > 0) next.startSeconds = startSeconds;
  return buildVideoEmbedSource(next);
}

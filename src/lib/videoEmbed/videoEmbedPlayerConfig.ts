import { resolveIframeSourcePolicy } from "@/lib/iframeSandbox";
import { buildVideoEmbedPlayerUrl, readVideoEmbedSource } from "@/lib/videoEmbed/buildVideoEmbedUrl";
import { getVideoEmbedPlaybackBlocker, getVideoEmbedProvider, providerSupports, type VideoEmbedProviderId } from "@/lib/videoEmbed/videoEmbedProviders";

/**
 * The one player configuration for a Video Embed (BC-08.3), used by the
 * Canvas Preview and the HTML export alike, so the two cannot drift.
 *
 * Nothing stored is trusted: the stored `src` is parsed again with the
 * same parser that accepted it (readVideoEmbedSource), the player URL is
 * rebuilt from the validated identity, and the result must be https on
 * one of the provider's own embed hosts. Anything else gives no player at
 * all (undefined), never a fallback iframe. So does a provider whose
 * player is blocked under the approved permissions (Vimeo, BC-08.3: it
 * needs encrypted-media); getVideoEmbedPlaybackBlocker says why.
 *
 * Attributes, and why:
 *   sandbox         the unchanged BC-02.3 policy (resolveIframeSourcePolicy)
 *   allow           "fullscreen" only — and only when the caller allows it
 *                   (browsers; not the desktop app until BC-08.4) and the
 *                   provider is fullscreen-capable. No autoplay, camera,
 *                   clipboard or other delegation.
 *   referrerpolicy  strict-origin-when-cross-origin: the browser default,
 *                   stated explicitly so a page-wide no-referrer cannot
 *                   break providers that need the page's origin (YouTube's
 *                   documented requirement); only the origin is sent.
 *   loading         lazy: off-screen players do not load (and YouTube asks
 *                   that autoplay only start once the player is visible).
 *
 * Muted-only autoplay (BC-02.2.1) plus reduced motion: autoplay is
 * requested only when authored autoplay AND muted, the provider supports
 * it, and the viewer has not asked for reduced motion. `stillSrc` is the
 * same player with autoplay off.
 */

export const VIDEO_EMBED_REFERRER_POLICY = "strict-origin-when-cross-origin";
export const VIDEO_EMBED_LOADING = "lazy";

export interface VideoEmbedPlayerInput {
  src?: string;
  title?: string;
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  controls?: boolean;
}

export interface VideoEmbedPlayerOptions {
  /** The origin of the page the iframe lives in (decides allow-same-origin, BC-02.3). */
  hostOrigin: string;
  /** prefers-reduced-motion: reduce — autoplay is never requested. */
  reducedMotion: boolean;
  /** Whether this environment may delegate fullscreen (false in the desktop app until BC-08.4). */
  fullscreenAllowed: boolean;
}

export interface VideoEmbedPlayerConfig {
  provider: VideoEmbedProviderId;
  /** The URL the player loads. */
  src: string;
  /** The same player without autoplay. Equal to `src` when no autoplay is requested. */
  stillSrc: string;
  autoplayRequested: boolean;
  title: string;
  sandbox: string;
  allow: string | undefined;
  referrerPolicy: typeof VIDEO_EMBED_REFERRER_POLICY;
  loading: typeof VIDEO_EMBED_LOADING;
}

function isOnProviderEmbedHost(url: string, provider: VideoEmbedProviderId): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.port === "" && parsed.username === "" && parsed.password === "" && getVideoEmbedProvider(provider).embedHosts.includes(parsed.hostname);
  } catch {
    return false;
  }
}

export function resolveVideoEmbedPlayerConfig(input: VideoEmbedPlayerInput, options: VideoEmbedPlayerOptions): VideoEmbedPlayerConfig | undefined {
  const source = readVideoEmbedSource(input.src);
  if (!source) return undefined;
  const { provider } = source;
  if (getVideoEmbedPlaybackBlocker(provider) !== undefined) return undefined;
  const autoplayRequested = input.autoplay === true && input.muted === true && providerSupports(provider, "autoplay") && providerSupports(provider, "muted") && !options.reducedMotion;
  const playback = { muted: input.muted, loop: input.loop, controls: input.controls };
  const src = buildVideoEmbedPlayerUrl(source, { ...playback, autoplay: autoplayRequested });
  const stillSrc = buildVideoEmbedPlayerUrl(source, { ...playback, autoplay: false });
  if (!isOnProviderEmbedHost(src, provider) || !isOnProviderEmbedHost(stillSrc, provider)) return undefined;
  const policy = resolveIframeSourcePolicy(src, options.hostOrigin);
  if (policy.refused || policy.src === undefined) return undefined;
  const title = input.title?.trim() || getVideoEmbedProvider(provider).defaultTitle;
  return {
    provider,
    src,
    stillSrc,
    autoplayRequested,
    title,
    sandbox: policy.sandbox,
    allow: options.fullscreenAllowed && providerSupports(provider, "fullscreen") ? "fullscreen" : undefined,
    referrerPolicy: VIDEO_EMBED_REFERRER_POLICY,
    loading: VIDEO_EMBED_LOADING,
  };
}

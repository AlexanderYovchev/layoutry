import { parseProviderTime } from "@/lib/videoEmbed/videoEmbedTime";
import type { DeferredVideoProviderId, VideoEmbedProviderId } from "@/lib/videoEmbed/videoEmbedProviders";

/**
 * The one parser for pasted video links (BC-08.2). Every pasted string is
 * untrusted. The rules:
 *
 * - Parsed with the WHATWG URL parser, never by string slicing. The parser
 *   lowercases the host and turns Unicode hosts into punycode, so a
 *   look-alike host ("yоutube.com" with a Cyrillic о) becomes xn--… and
 *   matches nothing.
 * - https only. A link typed without a scheme ("youtu.be/…") is read as
 *   https; "//host" (protocol-relative), http:, javascript:, data:, file:,
 *   blob: and every other scheme are refused.
 * - No user name or password ("https://youtube.com@evil.example/" has the
 *   host evil.example and fails anyway; "https://a@www.youtube.com/" is
 *   refused for its credentials), and no explicit port.
 * - Hosts are matched EXACTLY against each provider's list, never with
 *   includes/endsWith. The single structured rule is Wistia's account
 *   host: exactly "<one DNS label>.wistia.com".
 * - Paths are matched with anchored patterns and the identifier is checked
 *   with a strict pattern. pathname keeps percent-escapes, so an encoded
 *   slash or payload ("%2F", "%253C") fails the identifier pattern.
 * - Nothing from the query string is passed on. Only the values Layoutry
 *   understands (the video id, an unlisted-video hash, a start time, a
 *   privacy flag) are read; tracking parameters (si, utm_*, sid, feature,
 *   …) and anything else are dropped. Embed URLs are always rebuilt from
 *   these validated parts (buildVideoEmbedUrl.ts), never edited from the
 *   input.
 * - No network access: short links are resolved by pattern, and link
 *   shorteners (bit.ly, …) are simply unknown hosts.
 */

export interface VideoEmbedReference {
  provider: VideoEmbedProviderId;
  videoId: string;
  /** Vimeo's unlisted-video hash. */
  hash?: string;
  startSeconds?: number;
  /** Only set when the link itself states it (nocookie host, dnt=, doNotTrack=). */
  privacy?: boolean;
}

export type VideoEmbedParseFailure =
  | "empty"
  | "malformed"
  | "protocol-relative"
  | "not-https"
  | "unsafe-scheme"
  | "credentials"
  | "port"
  | "unknown-host"
  | "unsupported-path"
  | "invalid-id"
  | "deferred-provider";

export type VideoEmbedParseResult =
  | { ok: true; reference: VideoEmbedReference }
  | { ok: false; reason: VideoEmbedParseFailure; provider?: VideoEmbedProviderId | DeferredVideoProviderId };

type ProviderParse = { ok: true; reference: VideoEmbedReference } | { ok: false; reason: "unsupported-path" | "invalid-id" };

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
// /embed/videoseries is YouTube's playlist player, not a video, though it is 11 characters.
const YOUTUBE_RESERVED_IDS: ReadonlySet<string> = new Set(["videoseries"]);
const VIMEO_ID = /^\d{1,12}$/;
const VIMEO_HASH = /^[0-9a-f]{6,20}$/;
const LOOM_ID = /^[0-9a-f]{32}$/;
// A Loom share link may carry a title slug before the id: /share/My-demo-<id>.
const LOOM_SEGMENT = /^(?:[A-Za-z0-9-]{1,200}-)?([0-9a-f]{32})$/;
const WISTIA_ID = /^[a-z0-9]{10}$/;
const DNS_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

const YOUTUBE_HOSTS: ReadonlySet<string> = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com"]);
const YOUTUBE_NOCOOKIE_HOSTS: ReadonlySet<string> = new Set(["youtube-nocookie.com", "www.youtube-nocookie.com"]);
const YOUTUBE_SHORT_HOSTS: ReadonlySet<string> = new Set(["youtu.be"]);
const VIMEO_HOSTS: ReadonlySet<string> = new Set(["vimeo.com", "www.vimeo.com"]);
const VIMEO_PLAYER_HOSTS: ReadonlySet<string> = new Set(["player.vimeo.com"]);
const LOOM_HOSTS: ReadonlySet<string> = new Set(["loom.com", "www.loom.com"]);
const WISTIA_EMBED_HOSTS: ReadonlySet<string> = new Set(["fast.wistia.net", "fast.wistia.com"]);
const WISTIA_SHORT_HOSTS: ReadonlySet<string> = new Set(["wi.st"]);

const DEFERRED_HOSTS: ReadonlyMap<string, DeferredVideoProviderId> = new Map([
  ["dailymotion.com", "dailymotion"],
  ["www.dailymotion.com", "dailymotion"],
  ["geo.dailymotion.com", "dailymotion"],
  ["dai.ly", "dailymotion"],
  ["twitch.tv", "twitch"],
  ["www.twitch.tv", "twitch"],
  ["m.twitch.tv", "twitch"],
  ["clips.twitch.tv", "twitch"],
  ["player.twitch.tv", "twitch"],
]);

/** "<one DNS label>.wistia.com", e.g. "acme.wistia.com" — Wistia's own per-account hosts. */
function isWistiaAccountHost(host: string): boolean {
  const labels = host.split(".");
  return labels.length === 3 && labels[1] === "wistia" && labels[2] === "com" && DNS_LABEL.test(labels[0]);
}

/** The path's segments, ignoring one trailing slash; empty segments make the path unsupported. */
function pathSegments(url: URL): string[] | undefined {
  const path = url.pathname.endsWith("/") && url.pathname.length > 1 ? url.pathname.slice(0, -1) : url.pathname;
  const segments = path.split("/").slice(1);
  return segments.some((segment) => segment === "") ? undefined : segments;
}

/** One query value, or undefined when the key is absent or repeated (ambiguous). */
function singleParam(url: URL, key: string): string | undefined {
  const values = url.searchParams.getAll(key);
  return values.length === 1 ? values[0] : undefined;
}

function booleanParam(value: string | undefined): boolean | undefined {
  if (value === "1" || value === "true") return true;
  if (value === "0" || value === "false") return false;
  return undefined;
}

function withId(provider: VideoEmbedProviderId, videoId: string | undefined, pattern: RegExp, extra: Omit<VideoEmbedReference, "provider" | "videoId"> = {}): ProviderParse {
  if (videoId === undefined || !pattern.test(videoId)) return { ok: false, reason: "invalid-id" };
  if (provider === "youtube" && YOUTUBE_RESERVED_IDS.has(videoId)) return { ok: false, reason: "invalid-id" };
  const reference: VideoEmbedReference = { provider, videoId };
  if (extra.hash !== undefined) reference.hash = extra.hash;
  if (extra.startSeconds !== undefined) reference.startSeconds = extra.startSeconds;
  if (extra.privacy !== undefined) reference.privacy = extra.privacy;
  return { ok: true, reference };
}

function parseYouTube(url: URL, host: string): ProviderParse | undefined {
  const isMain = YOUTUBE_HOSTS.has(host);
  const isNoCookie = YOUTUBE_NOCOOKIE_HOSTS.has(host);
  const isShort = YOUTUBE_SHORT_HOSTS.has(host);
  if (!isMain && !isNoCookie && !isShort) return undefined;
  const segments = pathSegments(url);
  if (!segments) return { ok: false, reason: "unsupported-path" };
  const startRaw = singleParam(url, "start") ?? singleParam(url, "t");
  const extra = { startSeconds: parseProviderTime(startRaw), privacy: isNoCookie ? true : undefined };
  if (isShort) return segments.length === 1 ? withId("youtube", segments[0], YOUTUBE_ID, extra) : { ok: false, reason: "unsupported-path" };
  if (isMain && segments.length === 1 && segments[0] === "watch") return withId("youtube", singleParam(url, "v"), YOUTUBE_ID, extra);
  if (segments.length === 2 && (segments[0] === "embed" || (isMain && (segments[0] === "shorts" || segments[0] === "live")))) {
    return withId("youtube", segments[1], YOUTUBE_ID, extra);
  }
  return { ok: false, reason: "unsupported-path" };
}

function parseVimeo(url: URL, host: string): ProviderParse | undefined {
  const isPublic = VIMEO_HOSTS.has(host);
  const isPlayer = VIMEO_PLAYER_HOSTS.has(host);
  if (!isPublic && !isPlayer) return undefined;
  const segments = pathSegments(url);
  if (!segments) return { ok: false, reason: "unsupported-path" };
  const timeMatch = /^#t=([0-9hms]{1,16})$/i.exec(url.hash);
  const extra = { startSeconds: parseProviderTime(timeMatch?.[1]), privacy: booleanParam(singleParam(url, "dnt")) };
  const withHash = (id: string | undefined, hash: string | undefined): ProviderParse => {
    if (hash !== undefined && !VIMEO_HASH.test(hash)) return { ok: false, reason: "invalid-id" };
    return withId("vimeo", id, VIMEO_ID, { ...extra, hash });
  };
  if (isPlayer) {
    return segments.length === 2 && segments[0] === "video" ? withHash(segments[1], singleParam(url, "h")) : { ok: false, reason: "unsupported-path" };
  }
  const [first, second, third, fourth] = segments;
  if (segments.length === 1 && VIMEO_ID.test(first)) return withHash(first, undefined);
  if (segments.length === 2 && VIMEO_ID.test(first)) return withHash(first, second);
  if (segments.length === 3 && first === "channels") return withHash(third, undefined);
  if (segments.length === 4 && first === "groups" && third === "videos") return withHash(fourth, undefined);
  return { ok: false, reason: "unsupported-path" };
}

function parseLoom(url: URL, host: string): ProviderParse | undefined {
  if (!LOOM_HOSTS.has(host)) return undefined;
  const segments = pathSegments(url);
  if (!segments || segments.length !== 2 || (segments[0] !== "share" && segments[0] !== "embed")) return { ok: false, reason: "unsupported-path" };
  const id = LOOM_SEGMENT.exec(segments[1])?.[1];
  return withId("loom", id, LOOM_ID, { startSeconds: parseProviderTime(singleParam(url, "t")) });
}

function parseWistia(url: URL, host: string): ProviderParse | undefined {
  const isEmbed = WISTIA_EMBED_HOSTS.has(host);
  const isShort = WISTIA_SHORT_HOSTS.has(host);
  if (!isEmbed && !isShort && !isWistiaAccountHost(host)) return undefined;
  const segments = pathSegments(url);
  if (!segments) return { ok: false, reason: "unsupported-path" };
  const extra = { startSeconds: parseProviderTime(singleParam(url, "time")), privacy: booleanParam(singleParam(url, "doNotTrack")) };
  if (isEmbed) {
    return segments.length === 3 && segments[0] === "embed" && (segments[1] === "iframe" || segments[1] === "medias")
      ? withId("wistia", segments[2], WISTIA_ID, extra)
      : { ok: false, reason: "unsupported-path" };
  }
  return segments.length === 2 && segments[0] === "medias" ? withId("wistia", segments[1], WISTIA_ID, extra) : { ok: false, reason: "unsupported-path" };
}

const PROVIDER_PARSERS: ReadonlyArray<readonly [VideoEmbedProviderId, (url: URL, host: string) => ProviderParse | undefined]> = [
  ["youtube", parseYouTube],
  ["vimeo", parseVimeo],
  ["loom", parseLoom],
  ["wistia", parseWistia],
];

/** Detects the provider of a pasted video link and extracts its validated identity. */
export function parseVideoEmbedUrl(input: string): VideoEmbedParseResult {
  // As a browser's URL parser does: ASCII tab/newline are removed anywhere
  // (so a tab inside "javascript:" is still seen as the javascript: scheme).
  const trimmed = input.replace(/[\t\n\r]/g, "").trim();
  if (trimmed === "") return { ok: false, reason: "empty" };
  if (trimmed.startsWith("//") || trimmed.startsWith("\\\\") || trimmed.startsWith("/\\") || trimmed.startsWith("\\/")) return { ok: false, reason: "protocol-relative" };
  const candidate = URL_SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (url.protocol === "http:") return { ok: false, reason: "not-https" };
  if (url.protocol !== "https:") return { ok: false, reason: "unsafe-scheme" };
  if (url.username !== "" || url.password !== "") return { ok: false, reason: "credentials" };
  if (url.port !== "") return { ok: false, reason: "port" };
  const host = url.hostname;
  for (const [provider, parse] of PROVIDER_PARSERS) {
    const result = parse(url, host);
    if (result === undefined) continue;
    return result.ok ? result : { ok: false, reason: result.reason, provider };
  }
  const deferred = DEFERRED_HOSTS.get(host);
  if (deferred) return { ok: false, reason: "deferred-provider", provider: deferred };
  return { ok: false, reason: "unknown-host" };
}


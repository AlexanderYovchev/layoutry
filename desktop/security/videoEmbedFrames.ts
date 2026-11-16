import { APP_ENTRY_URL } from "../protocol/appOrigin";

/**
 * Video Embed frame authorization for the desktop shell (BC-08.4).
 *
 * The main window's permission and request hooks only see a request's URL
 * (Electron 44 PermissionRequest = { requestingUrl, isMainFrame }), so a
 * provider hostname alone could never tell an authorized Video Embed
 * player from a generic Embed showing the same page. Authorization is
 * therefore bound to a FRAME the main process can inspect itself:
 *
 * 1. The editor (the main window's top frame on app://layoutry/, the only
 *    caller the desktop IPC accepts) mounts each Video Embed player iframe
 *    with a fresh random name, `ly-video-<32 hex>`, and registers
 *    { token, provider } before giving the iframe its src. It unregisters
 *    when the iframe unmounts (Preview exit, hidden, ancestor hidden, source
 *    or provider change, project change, editor unmount).
 * 2. A frame is an authorized player only when ALL hold, checked from the
 *    main process's own frame tree at the moment of use:
 *      - it is a DIRECT child of the main window's top frame;
 *      - its current browsing-context name is a token registered by that
 *        same window;
 *      - its URL is https, without port or credentials, on one of that
 *        provider's exact player origins below.
 *    A renamed frame (content can set window.name), a nested frame, a frame
 *    that navigated elsewhere, a removed frame or a stale token all fail.
 * 3. Fullscreen is granted only when every frame currently showing the
 *    requesting URL is authorized: if a generic Embed shows the same URL
 *    the request is ambiguous and denied.
 *
 * The renderer's registration alone proves nothing: it names a frame that
 * the main process must then find, in the right place, on the right
 * origin. Generic Embeds get no name and are never registered.
 *
 * These origins repeat the web app's provider registry
 * (src/lib/videoEmbed/videoEmbedProviders.ts embedHosts): desktop/ and src/
 * do not import each other (ADR-0002); both test files pin the same lists.
 */

export type VideoEmbedProvider = "youtube" | "vimeo" | "loom" | "wistia";

export const VIDEO_EMBED_PLAYER_ORIGINS: Readonly<Record<VideoEmbedProvider, readonly string[]>> = {
  youtube: ["https://www.youtube-nocookie.com", "https://www.youtube.com"],
  vimeo: ["https://player.vimeo.com"],
  loom: ["https://www.loom.com"],
  wistia: ["https://fast.wistia.net"],
};

export const VIDEO_EMBED_TOKEN_PATTERN = /^ly-video-[0-9a-f]{32}$/;

/** More players than any page could show at once: a cap, so a misbehaving renderer cannot grow the registry. */
export const MAX_VIDEO_EMBED_FRAMES = 256;

/** The parts of Electron's WebFrameMain this module reads. */
export interface FrameLike {
  readonly name: string;
  readonly url: string;
  readonly parent: FrameLike | null;
}

function isProvider(value: unknown): value is VideoEmbedProvider {
  return typeof value === "string" && Object.hasOwn(VIDEO_EMBED_PLAYER_ORIGINS, value);
}

function exactKeys(payload: unknown, keys: readonly string[]): payload is Record<string, unknown> {
  if (typeof payload !== "object" || payload === null) return false;
  const own = Object.keys(payload).sort();
  return own.length === keys.length && own.every((key, index) => key === [...keys].sort()[index]);
}

/** Registered player frames, per owning window (webContents id). */
export class VideoEmbedFrameRegistry {
  private readonly owners = new Map<number, Map<string, VideoEmbedProvider>>();

  register(ownerId: number, payload: unknown): void {
    if (!exactKeys(payload, ["provider", "token"])) throw new Error("Layoutry desktop API: expected {token, provider}");
    const { token, provider } = payload;
    if (typeof token !== "string" || !VIDEO_EMBED_TOKEN_PATTERN.test(token)) throw new Error("Layoutry desktop API: invalid video frame token");
    if (!isProvider(provider)) throw new Error("Layoutry desktop API: unknown video provider");
    const frames = this.owners.get(ownerId) ?? new Map<string, VideoEmbedProvider>();
    if (frames.has(token)) throw new Error("Layoutry desktop API: video frame token already registered");
    if (frames.size >= MAX_VIDEO_EMBED_FRAMES) throw new Error("Layoutry desktop API: too many video frames");
    frames.set(token, provider);
    this.owners.set(ownerId, frames);
  }

  unregister(ownerId: number, payload: unknown): void {
    if (!exactKeys(payload, ["token"]) || typeof payload.token !== "string") throw new Error("Layoutry desktop API: expected {token}");
    this.owners.get(ownerId)?.delete(payload.token);
  }

  /** Every registration of a window ends: it closed, crashed or reloaded. */
  clearOwner(ownerId: number): void {
    this.owners.delete(ownerId);
  }

  providerFor(ownerId: number, token: string): VideoEmbedProvider | undefined {
    return this.owners.get(ownerId)?.get(token);
  }

  count(ownerId: number): number {
    return this.owners.get(ownerId)?.size ?? 0;
  }
}

/** The origin of an https URL with no port or credentials, else undefined. */
function strictHttpsOrigin(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.port === "" && parsed.username === "" && parsed.password === "" ? parsed.origin : undefined;
  } catch {
    return undefined;
  }
}

/** The provider an authorized player frame belongs to, or undefined (see the module comment, rule 2). */
export function authorizedPlayerProvider(registry: VideoEmbedFrameRegistry, ownerId: number, frame: FrameLike, topFrame: FrameLike, url: string): VideoEmbedProvider | undefined {
  if (frame === topFrame || frame.parent !== topFrame) return undefined;
  if (!VIDEO_EMBED_TOKEN_PATTERN.test(frame.name)) return undefined;
  const provider = registry.providerFor(ownerId, frame.name);
  if (!provider) return undefined;
  const origin = strictHttpsOrigin(url);
  return origin !== undefined && VIDEO_EMBED_PLAYER_ORIGINS[provider].includes(origin) ? provider : undefined;
}

export interface PermissionContents {
  readonly id: number;
  readonly mainFrame: FrameLike & { readonly framesInSubtree: readonly FrameLike[] };
}

/**
 * Whether a fullscreen request may be granted (module comment, rule 3).
 * The editor's own top frame never gets it.
 */
export function isFullscreenRequestAuthorized(registry: VideoEmbedFrameRegistry, contents: PermissionContents, details: { isMainFrame: boolean; requestingUrl: string }): boolean {
  if (details.isMainFrame) return false;
  const top = contents.mainFrame;
  const candidates = top.framesInSubtree.filter((frame) => frame !== top && frame.url === details.requestingUrl);
  return candidates.length > 0 && candidates.every((frame) => authorizedPlayerProvider(registry, contents.id, frame, top, frame.url) !== undefined);
}

/** URL filters for the request hook: only the exact player origins are ever seen by it. */
export const VIDEO_EMBED_REQUEST_FILTER: readonly string[] = Object.values(VIDEO_EMBED_PLAYER_ORIGINS).flatMap((origins) => origins.map((origin) => `${origin}/*`));

export interface PlayerRequestDetails {
  readonly resourceType: string;
  readonly url: string;
  readonly frame?: FrameLike | null;
  readonly requestHeaders: Record<string, string>;
}

/**
 * The Referer an authorized player's own document request carries (BC-08.4).
 * The editor's origin is a custom scheme, so Chromium sends none, and
 * YouTube refuses to play without one ("Error 153"). The value is the
 * editor's TRUE origin, app://layoutry/ — no website is claimed — and it is
 * added only:
 *   - to the navigation of an authorized player frame (resourceType
 *     "subFrame"; Electron reports the navigating frame itself, verified),
 *   - when the request has no Referer already.
 * Nothing else is changed: not other headers, not sub-resources, not
 * generic Embeds, not any other request. Returns the headers unchanged
 * otherwise.
 */
export function playerRequestHeaders(registry: VideoEmbedFrameRegistry, ownerId: number | undefined, topFrame: FrameLike | undefined, details: PlayerRequestDetails): Record<string, string> {
  const headers = details.requestHeaders;
  if (details.resourceType !== "subFrame" || ownerId === undefined || !topFrame || !details.frame) return headers;
  if (Object.keys(headers).some((name) => name.toLowerCase() === "referer")) return headers;
  if (!authorizedPlayerProvider(registry, ownerId, details.frame, topFrame, details.url)) return headers;
  return { ...headers, Referer: APP_ENTRY_URL };
}

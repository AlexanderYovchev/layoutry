// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { hardenSession } from "./hardenSession";
import {
  authorizedPlayerProvider,
  isFullscreenRequestAuthorized,
  MAX_VIDEO_EMBED_FRAMES,
  playerRequestHeaders,
  VIDEO_EMBED_PLAYER_ORIGINS,
  VIDEO_EMBED_REQUEST_FILTER,
  VideoEmbedFrameRegistry,
  type FrameLike,
  type PermissionContents,
} from "./videoEmbedFrames";

/**
 * Frame objects here have exactly the shape Electron's WebFrameMain showed
 * in the BC-08.4 probes: a browsing-context `name` (the iframe's name
 * attribute, changeable by the framed page itself), its current `url`, and
 * its `parent` (the main window's top frame for a direct child).
 */
const TOKEN = "ly-video-00112233445566778899aabbccddeeff";
const OTHER = "ly-video-ffeeddccbbaa99887766554433221100";
const OWNER = 7;
const YT = "https://www.youtube-nocookie.com/embed/M7lc1UVf-VE?autoplay=1&mute=1";

interface MutableFrame {
  name: string;
  url: string;
  parent: FrameLike | null;
}

function topWith(...children: MutableFrame[]): PermissionContents & { mainFrame: { framesInSubtree: FrameLike[] } } {
  const top = { name: "", url: "app://layoutry/", parent: null, framesInSubtree: [] as FrameLike[] };
  for (const child of children) child.parent = top;
  top.framesInSubtree = [top, ...children];
  return { id: OWNER, mainFrame: top };
}

const frame = (name: string, url: string): MutableFrame => ({ name, url, parent: null });

function registry(...entries: [string, string][]) {
  const result = new VideoEmbedFrameRegistry();
  for (const [token, provider] of entries) result.register(OWNER, { token, provider });
  return result;
}

describe("VideoEmbedFrameRegistry (BC-08.4)", () => {
  it("accepts only {token, provider} with a well-formed token and a known provider", () => {
    const frames = new VideoEmbedFrameRegistry();
    for (const bad of [null, "x", { token: TOKEN }, { token: TOKEN, provider: "youtube", extra: 1 }, { token: "ly-video-short", provider: "youtube" }, { token: TOKEN, provider: "dailymotion" }, { token: TOKEN, provider: "__proto__" }, { token: 5, provider: "youtube" }]) {
      expect(() => frames.register(OWNER, bad), JSON.stringify(bad)).toThrow();
    }
    frames.register(OWNER, { token: TOKEN, provider: "youtube" });
    expect(frames.providerFor(OWNER, TOKEN)).toBe("youtube");
    expect(() => frames.register(OWNER, { token: TOKEN, provider: "vimeo" })).toThrow("already registered");
  });

  it("is per window, revocable and capped", () => {
    const frames = registry([TOKEN, "youtube"]);
    expect(frames.providerFor(OWNER + 1, TOKEN)).toBeUndefined();
    frames.unregister(OWNER, { token: TOKEN });
    expect(frames.providerFor(OWNER, TOKEN)).toBeUndefined();
    frames.register(OWNER, { token: OTHER, provider: "vimeo" });
    frames.clearOwner(OWNER);
    expect(frames.count(OWNER)).toBe(0);
    for (let index = 0; index < MAX_VIDEO_EMBED_FRAMES; index += 1) frames.register(OWNER, { token: `ly-video-${index.toString(16).padStart(32, "0")}`, provider: "wistia" });
    expect(() => frames.register(OWNER, { token: TOKEN, provider: "wistia" })).toThrow("too many");
  });
});

describe("authorizedPlayerProvider", () => {
  it("a registered, direct child frame on its provider's exact player origin", () => {
    const player = frame(TOKEN, YT);
    const contents = topWith(player);
    expect(authorizedPlayerProvider(registry([TOKEN, "youtube"]), OWNER, player, contents.mainFrame, player.url)).toBe("youtube");
  });

  it.each([
    ["an unregistered (generic Embed) frame with the same URL", () => frame("", YT)],
    ["a frame whose name is another token", () => frame(OTHER, YT)],
    ["a frame that renamed itself", () => frame("renamed-by-content", YT)],
    ["the right token on another provider's origin", () => frame(TOKEN, "https://player.vimeo.com/video/1")],
    ["the right token on a look-alike host", () => frame(TOKEN, "https://www.youtube-nocookie.com.evil.example/embed/x")],
    ["the right token after navigating elsewhere", () => frame(TOKEN, "https://evil.example/")],
    ["the right token over http", () => frame(TOKEN, "http://www.youtube-nocookie.com/embed/x")],
    ["the right token with a port", () => frame(TOKEN, "https://www.youtube-nocookie.com:8443/embed/x")],
    ["the right token with credentials", () => frame(TOKEN, "https://a@www.youtube-nocookie.com/embed/x")],
  ])("refuses %s", (_label, make) => {
    const candidate = make();
    const contents = topWith(candidate);
    expect(authorizedPlayerProvider(registry([TOKEN, "youtube"]), OWNER, candidate, contents.mainFrame, candidate.url)).toBeUndefined();
  });

  it("refuses a nested frame (not a direct child of the editor) and the editor's own frame", () => {
    const player = frame(TOKEN, YT);
    const contents = topWith(player);
    const nested = { name: TOKEN, url: YT, parent: player };
    const frames = registry([TOKEN, "youtube"]);
    expect(authorizedPlayerProvider(frames, OWNER, nested, contents.mainFrame, YT)).toBeUndefined();
    expect(authorizedPlayerProvider(frames, OWNER, contents.mainFrame, contents.mainFrame, YT)).toBeUndefined();
  });

  it("refuses a stale token (unregistered after its player unmounted)", () => {
    const frames = registry([TOKEN, "youtube"]);
    const player = frame(TOKEN, YT);
    const contents = topWith(player);
    frames.unregister(OWNER, { token: TOKEN });
    expect(authorizedPlayerProvider(frames, OWNER, player, contents.mainFrame, YT)).toBeUndefined();
  });
});

describe("isFullscreenRequestAuthorized", () => {
  const details = (requestingUrl: string, isMainFrame = false) => ({ requestingUrl, isMainFrame });

  it("grants an authorized player's request", () => {
    const contents = topWith(frame(TOKEN, YT));
    expect(isFullscreenRequestAuthorized(registry([TOKEN, "youtube"]), contents, details(YT))).toBe(true);
  });

  it("denies the editor's own frame, unknown URLs, generic Embeds and ambiguous requests", () => {
    const frames = registry([TOKEN, "youtube"]);
    expect(isFullscreenRequestAuthorized(frames, topWith(frame(TOKEN, YT)), details("app://layoutry/", true))).toBe(false);
    expect(isFullscreenRequestAuthorized(frames, topWith(frame(TOKEN, YT)), details("https://www.youtube-nocookie.com/embed/other"))).toBe(false);
    expect(isFullscreenRequestAuthorized(frames, topWith(frame("", YT)), details(YT))).toBe(false);
    // A generic Embed showing the same URL as an authorized player: ambiguous, denied.
    expect(isFullscreenRequestAuthorized(frames, topWith(frame(TOKEN, YT), frame("", YT)), details(YT))).toBe(false);
  });

  it("is revoked with the registration and never transfers between frames", () => {
    const frames = registry([TOKEN, "youtube"]);
    const contents = topWith(frame(TOKEN, YT));
    frames.unregister(OWNER, { token: TOKEN });
    expect(isFullscreenRequestAuthorized(frames, contents, details(YT))).toBe(false);
    frames.register(OWNER, { token: OTHER, provider: "youtube" });
    // The old frame still carries the old name: a new registration does not authorize it.
    expect(isFullscreenRequestAuthorized(frames, contents, details(YT))).toBe(false);
  });
});

describe("hardenSession with the fullscreen exception", () => {
  function handlers(isFullscreenAllowed: () => boolean) {
    const session = { setPermissionRequestHandler: vi.fn(), setPermissionCheckHandler: vi.fn(), setDevicePermissionHandler: vi.fn() };
    hardenSession(session, { isFullscreenAllowed });
    return { request: session.setPermissionRequestHandler.mock.calls[0][0], check: session.setPermissionCheckHandler.mock.calls[0][0], device: session.setDevicePermissionHandler.mock.calls[0][0] };
  }
  const contents = {};

  it("asks the authorizer only for fullscreen, and follows its answer", () => {
    const allow = vi.fn(() => true);
    const { request } = handlers(allow);
    const granted = vi.fn();
    request(contents, "fullscreen", granted, { requestingUrl: YT, isMainFrame: false });
    expect(granted).toHaveBeenCalledWith(true);
    expect(allow).toHaveBeenCalledWith(contents, { requestingUrl: YT, isMainFrame: false });
    const denied = vi.fn();
    handlers(() => false).request(contents, "fullscreen", denied, { requestingUrl: YT, isMainFrame: false });
    expect(denied).toHaveBeenCalledWith(false);
  });

  it.each(["media", "mediaKeySystem", "geolocation", "notifications", "clipboard-read", "clipboard-sanitized-write", "display-capture", "openExternal", "pointerLock", "keyboardLock", "fileSystem", "automatic-fullscreen", "unknown"])(
    "still denies %s, without asking the authorizer",
    (permission) => {
      const allow = vi.fn(() => true);
      const { request } = handlers(allow);
      const callback = vi.fn();
      request(contents, permission, callback, { requestingUrl: YT, isMainFrame: false });
      expect(callback).toHaveBeenCalledWith(false);
      expect(allow).not.toHaveBeenCalled();
    },
  );

  it("still denies every permission check and device", () => {
    const { check, device } = handlers(() => true);
    expect(check(contents, "fullscreen", "https://www.youtube-nocookie.com", {})).toBe(false);
    expect(device({ deviceType: "usb" })).toBe(false);
  });
});

describe("playerRequestHeaders (Referer)", () => {
  const base = { "User-Agent": "x" };

  it("adds the editor's true origin, app://layoutry/, to an authorized player's own document request only", () => {
    const player = frame(TOKEN, "");
    const contents = topWith(player);
    const frames = registry([TOKEN, "youtube"]);
    expect(playerRequestHeaders(frames, OWNER, contents.mainFrame, { resourceType: "subFrame", url: YT, frame: player, requestHeaders: base })).toEqual({ ...base, Referer: "app://layoutry/" });
    // Never on sub-resources, media or scripts of the player.
    for (const resourceType of ["script", "xhr", "media", "image", "mainFrame", "other"]) {
      expect(playerRequestHeaders(frames, OWNER, contents.mainFrame, { resourceType, url: YT, frame: player, requestHeaders: base })).toBe(base);
    }
  });

  it("never for a generic Embed, another window, a look-alike or another provider's origin, and never replaces an existing Referer", () => {
    const player = frame(TOKEN, "");
    const generic = frame("", "");
    const contents = topWith(player, generic);
    const frames = registry([TOKEN, "youtube"]);
    expect(playerRequestHeaders(frames, OWNER, contents.mainFrame, { resourceType: "subFrame", url: YT, frame: generic, requestHeaders: base })).toBe(base);
    expect(playerRequestHeaders(frames, undefined, undefined, { resourceType: "subFrame", url: YT, frame: player, requestHeaders: base })).toBe(base);
    expect(playerRequestHeaders(frames, OWNER, contents.mainFrame, { resourceType: "subFrame", url: "https://player.vimeo.com/video/1", frame: player, requestHeaders: base })).toBe(base);
    expect(playerRequestHeaders(frames, OWNER, contents.mainFrame, { resourceType: "subFrame", url: "https://www.youtube-nocookie.com.evil.example/embed/x", frame: player, requestHeaders: base })).toBe(base);
    const existing = { referer: "https://example.com/" };
    expect(playerRequestHeaders(frames, OWNER, contents.mainFrame, { resourceType: "subFrame", url: YT, frame: player, requestHeaders: existing })).toBe(existing);
  });

  it("the request hook only ever sees the exact player origins", () => {
    expect([...VIDEO_EMBED_REQUEST_FILTER].sort()).toEqual(["https://fast.wistia.net/*", "https://player.vimeo.com/*", "https://www.loom.com/*", "https://www.youtube-nocookie.com/*", "https://www.youtube.com/*"]);
  });

  it("pins the player origins (they repeat src/lib/videoEmbed/videoEmbedProviders.ts embedHosts)", () => {
    expect(VIDEO_EMBED_PLAYER_ORIGINS).toEqual({
      youtube: ["https://www.youtube-nocookie.com", "https://www.youtube.com"],
      vimeo: ["https://player.vimeo.com"],
      loom: ["https://www.loom.com"],
      wistia: ["https://fast.wistia.net"],
    });
  });
});

import { describe, expect, it } from "vitest";
import { EXPORTED_PAGE_ORIGIN, resolveIframeSourcePolicy } from "@/lib/iframeSandbox";
import { resolveVideoEmbedPlayerConfig, type VideoEmbedPlayerInput, type VideoEmbedPlayerOptions } from "./videoEmbedPlayerConfig";

const YT = "dQw4w9WgXcQ";
const LOOM = "0123456789abcdef0123456789abcdef";
/** Providers whose player is loaded (Vimeo is blocked, see below). */
const SOURCES = {
  youtube: `https://www.youtube-nocookie.com/embed/${YT}?start=30`,
  loom: `https://www.loom.com/embed/${LOOM}`,
  wistia: "https://fast.wistia.net/embed/iframe/26sk4lmiix?doNotTrack=true",
} as const;
const VIMEO = "https://player.vimeo.com/video/76979871?h=a1b2c3d4e5&dnt=1";
const browser: VideoEmbedPlayerOptions = { hostOrigin: "http://localhost:3000", reducedMotion: false, fullscreenAllowed: true };
const FORBIDDEN_TOKENS = ["allow-top-navigation", "allow-top-navigation-by-user-activation", "allow-top-navigation-to-custom-protocols", "allow-popups-to-escape-sandbox", "allow-modals", "allow-downloads", "allow-pointer-lock", "allow-presentation", "allow-orientation-lock", "allow-storage-access-by-user-activation"];

function config(input: VideoEmbedPlayerInput, options: VideoEmbedPlayerOptions = browser) {
  const result = resolveVideoEmbedPlayerConfig(input, options);
  if (!result) throw new Error("expected a player");
  return result;
}
const query = (url: string) => Object.fromEntries(new URL(url).searchParams);

describe("resolveVideoEmbedPlayerConfig (BC-08.3)", () => {
  it.each(Object.entries(SOURCES))("%s: provider host, the BC-02.3 sandbox, fullscreen only, explicit referrer policy, lazy", (provider, src) => {
    const player = config({ src });
    expect(player.provider).toBe(provider);
    expect(new URL(player.src).protocol).toBe("https:");
    expect(player.sandbox).toBe(resolveIframeSourcePolicy(player.src, browser.hostOrigin).sandbox);
    expect(player.sandbox).toBe("allow-forms allow-popups allow-scripts allow-same-origin");
    for (const token of FORBIDDEN_TOKENS) expect(player.sandbox.split(" ")).not.toContain(token);
    expect(player.allow).toBe("fullscreen");
    expect(player.referrerPolicy).toBe("strict-origin-when-cross-origin");
    expect(player.loading).toBe("lazy");
  });

  it("the exported page's stand-in origin gives the same sandbox (cross-origin provider)", () => {
    expect(config({ src: SOURCES.youtube }, { ...browser, hostOrigin: EXPORTED_PAGE_ORIGIN }).sandbox).toBe(config({ src: SOURCES.youtube }).sandbox);
  });

  it("muted-only autoplay matrix, for every provider", () => {
    for (const src of Object.values(SOURCES)) {
      const autoplaying = (autoplay: boolean, muted: boolean) => config({ src, autoplay, muted }).autoplayRequested;
      expect(autoplaying(false, false)).toBe(false);
      expect(autoplaying(false, true)).toBe(false);
      expect(autoplaying(true, false)).toBe(false);
      expect(autoplaying(true, true)).toBe(true);
      // Never muted for the user.
      const unmuted = query(config({ src, autoplay: true, muted: false }).src);
      expect(unmuted.mute ?? unmuted.muted).toBeUndefined();
    }
  });

  it("autoplay URL and still URL: identical except for autoplay", () => {
    const player = config({ src: SOURCES.youtube, autoplay: true, muted: true, loop: true, controls: false });
    expect(query(player.src)).toEqual({ start: "30", autoplay: "1", mute: "1", loop: "1", playlist: YT, controls: "0" });
    expect(query(player.stillSrc)).toEqual({ start: "30", mute: "1", loop: "1", playlist: YT, controls: "0" });
    const quiet = config({ src: SOURCES.youtube });
    expect(quiet.src).toBe(quiet.stillSrc);
  });

  it("reduced motion: autoplay is never requested; manual playback stays (same player without autoplay)", () => {
    const player = config({ src: SOURCES.wistia, autoplay: true, muted: true }, { ...browser, reducedMotion: true });
    expect(player.autoplayRequested).toBe(false);
    expect(query(player.src).autoPlay).toBe("false");
    expect(player.src).toBe(player.stillSrc);
  });

  it("no fullscreen delegation where the environment can't (desktop Preview until BC-08.4)", () => {
    for (const src of Object.values(SOURCES)) expect(config({ src }, { ...browser, fullscreenAllowed: false }).allow).toBeUndefined();
  });

  it("provider-specific parameters: unsupported settings add nothing", () => {
    const all = { autoplay: true, muted: true, loop: true, controls: false };
    expect(query(config({ src: SOURCES.loom, ...all }).src)).toEqual({ autoplay: "1", muted: "1" });
    expect(query(config({ src: SOURCES.wistia, ...all }).src)).toEqual({ doNotTrack: "true", autoPlay: "true", muted: "true", endVideoBehavior: "loop" });
  });

  it("title: the authored one, else the provider's default", () => {
    expect(config({ src: SOURCES.youtube, title: "Product tour" }).title).toBe("Product tour");
    expect(config({ src: SOURCES.youtube, title: "   " }).title).toBe("YouTube video");
    expect(config({ src: SOURCES.wistia }).title).toBe("Wistia video");
  });

  it("re-validates the stored source: anything not a supported video gives no player at all", () => {
    for (const src of [
      undefined,
      "",
      "https://example.com/embed/x",
      `https://youtube.com.evil.example/embed/${YT}`,
      `https://www.youtube.com:8443/embed/${YT}`,
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "https://www.twitch.tv/somechannel",
      "https://www.dailymotion.com/video/x84sh87",
      `https://user@www.youtube.com/embed/${YT}`,
    ]) {
      expect(resolveVideoEmbedPlayerConfig({ src }, browser), String(src)).toBeUndefined();
    }
  });

  it("a stored public link (hand-edited file) is rebuilt as the provider's embed URL, tracking dropped", () => {
    expect(config({ src: `https://www.youtube.com/watch?v=${YT}&si=track` }).src).toBe(`https://www.youtube.com/embed/${YT}`);
  });

  it("Vimeo is blocked under the approved permissions: no player at all, for any setting", () => {
    expect(resolveVideoEmbedPlayerConfig({ src: VIMEO }, browser)).toBeUndefined();
    expect(resolveVideoEmbedPlayerConfig({ src: VIMEO, autoplay: true, muted: true }, { ...browser, hostOrigin: EXPORTED_PAGE_ORIGIN })).toBeUndefined();
  });

  it("is deterministic", () => {
    const input = { src: SOURCES.wistia, autoplay: true, muted: true, loop: true };
    expect(config(input)).toEqual(config(input));
  });
});

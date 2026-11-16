import { describe, expect, it } from "vitest";
import { EXPORTED_PAGE_ORIGIN, resolveIframeSourcePolicy } from "@/lib/iframeSandbox";
import { resolveVideoEmbedPlayerConfig, type VideoEmbedPlayerInput, type VideoEmbedPlayerOptions } from "./videoEmbedPlayerConfig";

const YT = "dQw4w9WgXcQ";
const LOOM = "0123456789abcdef0123456789abcdef";
const VIMEO = "https://player.vimeo.com/video/76979871?h=a1b2c3d4e5&dnt=1";
const SOURCES = {
  youtube: `https://www.youtube-nocookie.com/embed/${YT}?start=30`,
  vimeo: VIMEO,
  loom: `https://www.loom.com/embed/${LOOM}`,
  wistia: "https://fast.wistia.net/embed/iframe/26sk4lmiix?doNotTrack=true",
} as const;
/** The approved allow attribute per provider (BC-08.3.1: encrypted-media for Vimeo only). */
const ALLOW = { youtube: "fullscreen", vimeo: "fullscreen; encrypted-media", loom: "fullscreen", wistia: "fullscreen" } as const;
const browser: VideoEmbedPlayerOptions = { hostOrigin: "http://localhost:3000", reducedMotion: false, fullscreenAllowed: true };
const FORBIDDEN_TOKENS = ["allow-top-navigation", "allow-top-navigation-by-user-activation", "allow-top-navigation-to-custom-protocols", "allow-popups-to-escape-sandbox", "allow-modals", "allow-downloads", "allow-pointer-lock", "allow-presentation", "allow-orientation-lock", "allow-storage-access-by-user-activation"];

function config(input: VideoEmbedPlayerInput, options: VideoEmbedPlayerOptions = browser) {
  const result = resolveVideoEmbedPlayerConfig(input, options);
  if (!result) throw new Error("expected a player");
  return result;
}
const query = (url: string) => Object.fromEntries(new URL(url).searchParams);

describe("resolveVideoEmbedPlayerConfig (BC-08.3)", () => {
  it.each(Object.entries(SOURCES))("%s: provider host, the BC-02.3 sandbox, the approved permissions only, explicit referrer policy, lazy", (provider, src) => {
    const player = config({ src });
    expect(player.provider).toBe(provider);
    expect(new URL(player.src).protocol).toBe("https:");
    expect(player.sandbox).toBe(resolveIframeSourcePolicy(player.src, browser.hostOrigin).sandbox);
    expect(player.sandbox).toBe("allow-forms allow-popups allow-scripts allow-same-origin");
    for (const token of FORBIDDEN_TOKENS) expect(player.sandbox.split(" ")).not.toContain(token);
    expect(player.allow).toBe(ALLOW[provider as keyof typeof ALLOW]);
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

  it("no fullscreen delegation where the environment can't (desktop Preview until BC-08.4); Vimeo keeps only encrypted-media", () => {
    for (const [provider, src] of Object.entries(SOURCES)) expect(config({ src }, { ...browser, fullscreenAllowed: false }).allow, provider).toBe(provider === "vimeo" ? "encrypted-media" : undefined);
  });

  it("encrypted-media comes only from the validated Vimeo identity: never for another provider, the export origin included", () => {
    for (const [provider, src] of Object.entries(SOURCES)) {
      for (const options of [browser, { ...browser, hostOrigin: EXPORTED_PAGE_ORIGIN }, { ...browser, fullscreenAllowed: false }]) {
        const allow = config({ src, autoplay: true, muted: true, loop: true }, options).allow ?? "";
        expect(allow.includes("encrypted-media"), `${provider}`).toBe(provider === "vimeo");
        // Nothing else is ever delegated.
        expect(allow.split("; ").filter(Boolean).every((feature) => feature === "fullscreen" || feature === "encrypted-media")).toBe(true);
      }
    }
  });

  it("a spoofed or malformed Vimeo source gives no player, so no permission at all", () => {
    for (const src of [
      "https://player.vimeo.com.evil.example/video/76979871",
      "https://evil.example/player.vimeo.com/video/76979871",
      "https://player.vimeo.com@evil.example/video/76979871",
      "https://user@player.vimeo.com/video/76979871",
      "https://player.vimeo.com:8443/video/76979871",
      "https://notvimeo.com/76979871",
      "https://player.vimeo.com/video/76979871%2F..%2Fevil",
      "https://player.vimeo.com/video/abc",
      "http://player.vimeo.com/video/76979871",
    ]) {
      expect(resolveVideoEmbedPlayerConfig({ src }, browser), src).toBeUndefined();
    }
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

  it("Vimeo: playback parameters as before, and the same sandbox as every provider", () => {
    const player = config({ src: VIMEO, autoplay: true, muted: true, loop: true, controls: false });
    expect(query(player.src)).toEqual({ h: "a1b2c3d4e5", dnt: "1", autoplay: "1", muted: "1", loop: "1" });
    expect(query(player.stillSrc)).toEqual({ h: "a1b2c3d4e5", dnt: "1", autoplay: "0", muted: "1", loop: "1" });
    expect(player.sandbox).toBe("allow-forms allow-popups allow-scripts allow-same-origin");
  });

  it("is deterministic", () => {
    const input = { src: SOURCES.wistia, autoplay: true, muted: true, loop: true };
    expect(config(input)).toEqual(config(input));
  });
});

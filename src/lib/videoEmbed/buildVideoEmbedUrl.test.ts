import { describe, expect, it } from "vitest";
import {
  buildVideoEmbedPlayerUrl,
  buildVideoEmbedSource,
  readVideoEmbedSource,
  resolveVideoEmbedSourceInput,
  withVideoEmbedPrivacy,
  withVideoEmbedStart,
  type StoredVideoEmbed,
} from "./buildVideoEmbedUrl";
import { VIDEO_EMBED_PROVIDERS, type VideoEmbedProviderId } from "./videoEmbedProviders";

const YT = "dQw4w9WgXcQ";
const LOOM = "0123456789abcdef0123456789abcdef";
const WISTIA = "26sk4lmiix";

const youtube: StoredVideoEmbed = { provider: "youtube", videoId: YT, privacy: true };
const vimeo: StoredVideoEmbed = { provider: "vimeo", videoId: "76979871", hash: "a1b2c3d4e5", privacy: true };
const loom: StoredVideoEmbed = { provider: "loom", videoId: LOOM, privacy: false };
const wistia: StoredVideoEmbed = { provider: "wistia", videoId: WISTIA, privacy: true };

function resolved(input: string, current?: string): string {
  const result = resolveVideoEmbedSourceInput(input, current);
  if (!result.ok) throw new Error(result.reason);
  return result.src;
}

describe("buildVideoEmbedSource — canonical sources (BC-08.2)", () => {
  it.each([
    [youtube, `https://www.youtube-nocookie.com/embed/${YT}`],
    [{ ...youtube, privacy: false }, `https://www.youtube.com/embed/${YT}`],
    [{ ...youtube, startSeconds: 90 }, `https://www.youtube-nocookie.com/embed/${YT}?start=90`],
    [vimeo, "https://player.vimeo.com/video/76979871?h=a1b2c3d4e5&dnt=1"],
    [{ ...vimeo, hash: undefined, privacy: false }, "https://player.vimeo.com/video/76979871"],
    [{ ...vimeo, startSeconds: 62 }, "https://player.vimeo.com/video/76979871?h=a1b2c3d4e5&dnt=1#t=62s"],
    [loom, `https://www.loom.com/embed/${LOOM}`],
    [{ ...loom, privacy: true, startSeconds: 80 }, `https://www.loom.com/embed/${LOOM}?t=80s`],
    [wistia, `https://fast.wistia.net/embed/iframe/${WISTIA}?doNotTrack=true`],
    [{ ...wistia, startSeconds: 30 }, `https://fast.wistia.net/embed/iframe/${WISTIA}?doNotTrack=true&time=30`],
  ])("%j -> %s", (reference, expected) => {
    expect(buildVideoEmbedSource(reference)).toBe(expected);
  });

  it("every source is https on the provider's own embed host", () => {
    for (const reference of [youtube, { ...youtube, privacy: false }, vimeo, loom, wistia]) {
      const url = new URL(buildVideoEmbedSource(reference));
      expect(url.protocol).toBe("https:");
      expect(VIDEO_EMBED_PROVIDERS[reference.provider].embedHosts).toContain(url.hostname);
    }
  });

  it("is deterministic: a stored source reads back to itself (stable after save/reopen)", () => {
    for (const reference of [youtube, { ...youtube, privacy: false, startSeconds: 5 }, vimeo, { ...vimeo, privacy: false }, loom, wistia, { ...wistia, privacy: false, startSeconds: 7 }]) {
      const source = buildVideoEmbedSource(reference);
      const read = readVideoEmbedSource(source);
      expect(read).toBeDefined();
      expect(buildVideoEmbedSource(read!)).toBe(source);
    }
  });

  it("readVideoEmbedSource returns undefined for anything that isn't a supported video", () => {
    expect(readVideoEmbedSource(undefined)).toBeUndefined();
    expect(readVideoEmbedSource("")).toBeUndefined();
    expect(readVideoEmbedSource("https://example.com/embed")).toBeUndefined();
    expect(readVideoEmbedSource("https://www.twitch.tv/somechannel")).toBeUndefined();
    expect(readVideoEmbedSource("javascript:alert(1)")).toBeUndefined();
  });
});

describe("resolveVideoEmbedSourceInput — what a pasted link becomes", () => {
  it("approved privacy defaults: YouTube nocookie and Vimeo dnt for a new link", () => {
    expect(resolved(`https://www.youtube.com/watch?v=${YT}&si=x`)).toBe(`https://www.youtube-nocookie.com/embed/${YT}`);
    expect(resolved("https://vimeo.com/76979871")).toBe("https://player.vimeo.com/video/76979871?dnt=1");
    expect(resolved(`https://acme.wistia.com/medias/${WISTIA}`)).toBe(`https://fast.wistia.net/embed/iframe/${WISTIA}?doNotTrack=true`);
    expect(resolved(`https://www.loom.com/share/${LOOM}?sid=abc`)).toBe(`https://www.loom.com/embed/${LOOM}`);
  });

  it("keeps an unlisted Vimeo hash", () => {
    expect(resolved("https://vimeo.com/76979871/a1b2c3d4e5")).toBe("https://player.vimeo.com/video/76979871?h=a1b2c3d4e5&dnt=1");
  });

  it("keeps the current privacy choice for the same provider, unless the link states its own", () => {
    const off = `https://www.youtube.com/embed/${YT}`;
    expect(resolved("https://youtu.be/aaaaaaaaaaa", off)).toBe("https://www.youtube.com/embed/aaaaaaaaaaa");
    expect(resolved("https://www.youtube-nocookie.com/embed/aaaaaaaaaaa", off)).toBe("https://www.youtube-nocookie.com/embed/aaaaaaaaaaa");
    // A different provider starts from its own default.
    expect(resolved("https://vimeo.com/1", off)).toBe("https://player.vimeo.com/video/1?dnt=1");
    expect(resolved("https://player.vimeo.com/video/1?dnt=0", off)).toBe("https://player.vimeo.com/video/1");
  });

  it("passes the parser's refusal through", () => {
    expect(resolveVideoEmbedSourceInput("https://youtube.com.evil.example/watch?v=x", undefined)).toEqual({ ok: false, reason: "unknown-host" });
    expect(resolveVideoEmbedSourceInput("https://www.twitch.tv/x", undefined)).toEqual({ ok: false, reason: "deferred-provider", provider: "twitch" });
  });

  it("withVideoEmbedPrivacy / withVideoEmbedStart rebuild the same video", () => {
    const source = `https://www.youtube-nocookie.com/embed/${YT}`;
    expect(withVideoEmbedPrivacy(source, false)).toBe(`https://www.youtube.com/embed/${YT}`);
    expect(withVideoEmbedStart(source, 75)).toBe(`https://www.youtube-nocookie.com/embed/${YT}?start=75`);
    expect(withVideoEmbedStart(`${source}?start=75`, undefined)).toBe(source);
    expect(withVideoEmbedStart(`${source}?start=75`, 0)).toBe(source);
    expect(withVideoEmbedPrivacy("https://example.com/", true)).toBeUndefined();
    // Loom has no privacy mode: switching it on changes nothing.
    expect(withVideoEmbedPrivacy(`https://www.loom.com/embed/${LOOM}`, true)).toBe(`https://www.loom.com/embed/${LOOM}`);
  });
});

describe("buildVideoEmbedPlayerUrl — playback settings and the muted-only autoplay policy", () => {
  const params = (url: string) => Object.fromEntries(new URL(url).searchParams);

  it("autoplay off: no automatic playback is requested", () => {
    expect(params(buildVideoEmbedPlayerUrl(youtube, { autoplay: false, muted: true }))).toEqual({ mute: "1" });
    expect(params(buildVideoEmbedPlayerUrl(vimeo, {}))).toMatchObject({ autoplay: "0" });
    expect(params(buildVideoEmbedPlayerUrl(wistia, {}))).toMatchObject({ autoPlay: "false" });
    expect(params(buildVideoEmbedPlayerUrl(loom, {}))).toEqual({});
  });

  it("autoplay on + muted off: never autoplays, and muted is never switched on", () => {
    for (const reference of [youtube, vimeo, loom, wistia]) {
      const query = params(buildVideoEmbedPlayerUrl(reference, { autoplay: true, muted: false }));
      expect(query.autoplay === "1" || query.autoPlay === "true").toBe(false);
      expect(query.mute ?? query.muted).toBeUndefined();
    }
  });

  it("autoplay on + muted on: may autoplay, muted", () => {
    expect(params(buildVideoEmbedPlayerUrl(youtube, { autoplay: true, muted: true }))).toEqual({ autoplay: "1", mute: "1" });
    expect(params(buildVideoEmbedPlayerUrl(vimeo, { autoplay: true, muted: true }))).toEqual({ h: "a1b2c3d4e5", dnt: "1", autoplay: "1", muted: "1" });
    expect(params(buildVideoEmbedPlayerUrl(loom, { autoplay: true, muted: true }))).toEqual({ autoplay: "1", muted: "1" });
    expect(params(buildVideoEmbedPlayerUrl(wistia, { autoplay: true, muted: true }))).toEqual({ doNotTrack: "true", autoPlay: "true", muted: "true" });
  });

  it("loop and controls follow each provider's capabilities; unsupported settings add nothing", () => {
    expect(params(buildVideoEmbedPlayerUrl(youtube, { loop: true, controls: false }))).toEqual({ loop: "1", playlist: YT, controls: "0" });
    expect(params(buildVideoEmbedPlayerUrl(vimeo, { loop: true, controls: false }))).toEqual({ h: "a1b2c3d4e5", dnt: "1", autoplay: "0", loop: "1" });
    expect(params(buildVideoEmbedPlayerUrl(loom, { loop: true, controls: false }))).toEqual({});
    expect(params(buildVideoEmbedPlayerUrl(wistia, { loop: true, controls: false }))).toEqual({ doNotTrack: "true", autoPlay: "false", endVideoBehavior: "loop" });
  });

  it("keeps the start time and Vimeo's fragment", () => {
    expect(buildVideoEmbedPlayerUrl({ ...vimeo, startSeconds: 62 }, { muted: true })).toBe("https://player.vimeo.com/video/76979871?h=a1b2c3d4e5&dnt=1&autoplay=0&muted=1#t=62s");
  });
});

describe("capability matrix", () => {
  it("every unsupported capability has an explanation; supported ones do not", () => {
    for (const id of Object.keys(VIDEO_EMBED_PROVIDERS) as VideoEmbedProviderId[]) {
      const provider = VIDEO_EMBED_PROVIDERS[id];
      for (const [capability, status] of Object.entries(provider.capabilities)) {
        const note = provider.unsupportedNotes[capability as keyof typeof provider.unsupportedNotes];
        if (status === "unsupported") expect(note, `${id}.${capability}`).toBeTruthy();
        else expect(note, `${id}.${capability}`).toBeUndefined();
      }
    }
  });

  it("matches the documented provider settings", () => {
    const supported = (id: VideoEmbedProviderId) =>
      Object.entries(VIDEO_EMBED_PROVIDERS[id].capabilities)
        .filter(([, status]) => status !== "unsupported")
        .map(([capability]) => capability)
        .sort();
    expect(supported("youtube")).toEqual(["autoplay", "controls", "fullscreen", "loop", "muted", "privacyMode", "startTime"]);
    expect(supported("vimeo")).toEqual(["autoplay", "fullscreen", "loop", "muted", "privacyMode", "startTime"]);
    expect(supported("loom")).toEqual(["autoplay", "fullscreen", "muted", "startTime"]);
    expect(supported("wistia")).toEqual(["autoplay", "fullscreen", "loop", "muted", "privacyMode", "startTime"]);
    expect(VIDEO_EMBED_PROVIDERS.youtube.capabilities.muted).toBe("unverified");
    expect(VIDEO_EMBED_PROVIDERS.youtube.capabilities.privacyMode).toBe("unverified");
  });
});

import { describe, expect, it } from "vitest";
import { parseVideoEmbedUrl, type VideoEmbedParseFailure } from "./parseVideoEmbedUrl";

const YT = "dQw4w9WgXcQ";
const LOOM = "0123456789abcdef0123456789abcdef";
const WISTIA = "26sk4lmiix";

function reference(input: string) {
  const result = parseVideoEmbedUrl(input);
  if (!result.ok) throw new Error(`expected ${input} to parse, got ${result.reason}`);
  return result.reference;
}

function failure(input: string): { reason: VideoEmbedParseFailure; provider?: string } {
  const result = parseVideoEmbedUrl(input);
  if (result.ok) throw new Error(`expected ${input} to be refused, got ${JSON.stringify(result.reference)}`);
  return result.provider === undefined ? { reason: result.reason } : { reason: result.reason, provider: result.provider };
}

describe("parseVideoEmbedUrl — YouTube (BC-08.2)", () => {
  it.each([
    [`https://www.youtube.com/watch?v=${YT}`],
    [`https://youtube.com/watch?v=${YT}`],
    [`https://m.youtube.com/watch?v=${YT}`],
    [`https://music.youtube.com/watch?v=${YT}`],
    [`https://www.youtube.com/watch?feature=share&v=${YT}&list=PL123`],
    [`https://youtu.be/${YT}`],
    [`https://youtu.be/${YT}/`],
    [`https://www.youtube.com/shorts/${YT}`],
    [`https://www.youtube.com/live/${YT}`],
    [`https://www.youtube.com/embed/${YT}`],
    [`youtube.com/watch?v=${YT}`],
    [`  youtu.be/${YT}  `],
  ])("%s", (input) => {
    expect(reference(input)).toEqual({ provider: "youtube", videoId: YT });
  });

  it("the nocookie embed host states privacy; the other forms leave it to the caller", () => {
    expect(reference(`https://www.youtube-nocookie.com/embed/${YT}`)).toEqual({ provider: "youtube", videoId: YT, privacy: true });
    expect(reference(`https://youtube-nocookie.com/embed/${YT}`).privacy).toBe(true);
    expect(reference(`https://www.youtube.com/embed/${YT}`).privacy).toBeUndefined();
  });

  it("drops tracking parameters and keeps a start time", () => {
    expect(reference(`https://youtu.be/${YT}?si=TRACKING&utm_source=x&t=90`)).toEqual({ provider: "youtube", videoId: YT, startSeconds: 90 });
    expect(reference(`https://www.youtube.com/watch?v=${YT}&t=1m30s`).startSeconds).toBe(90);
    expect(reference(`https://www.youtube.com/embed/${YT}?start=42&autoplay=1&mute=1`)).toEqual({ provider: "youtube", videoId: YT, startSeconds: 42 });
    expect(reference(`https://youtu.be/${YT}?t=-5`).startSeconds).toBeUndefined();
  });

  it.each([
    [`https://www.youtube.com/watch?v=short`, "invalid-id"],
    [`https://www.youtube.com/watch?v=${YT}x`, "invalid-id"],
    [`https://www.youtube.com/watch`, "invalid-id"],
    [`https://www.youtube.com/watch?v=`, "invalid-id"],
    [`https://www.youtube.com/watch?v=${YT}&v=aaaaaaaaaaa`, "invalid-id"],
    [`https://www.youtube.com/watch?v=%3Cscript%3E`, "invalid-id"],
    [`https://www.youtube.com/watch?v=${YT}"><script>`, "invalid-id"],
    [`https://www.youtube.com/watch?v=abc%2522def`, "invalid-id"],
    [`https://www.youtube.com/embed/videoseries?list=PL1`, "invalid-id"],
    [`https://www.youtube.com/embed%2F${YT}`, "unsupported-path"],
    [`https://www.youtube.com/embed/${YT}%2F..%2F`, "invalid-id"],
    [`https://www.youtube.com/channel/UC123`, "unsupported-path"],
    [`https://www.youtube.com/`, "unsupported-path"],
    [`https://www.youtube.com//watch?v=${YT}`, "unsupported-path"],
    [`https://youtu.be/`, "unsupported-path"],
    [`https://www.youtube-nocookie.com/shorts/${YT}`, "unsupported-path"],
  ])("refuses %s (%s)", (input, reason) => {
    expect(failure(input)).toEqual({ reason, provider: "youtube" });
  });
});

describe("parseVideoEmbedUrl — Vimeo", () => {
  it.each([
    ["https://vimeo.com/76979871", { provider: "vimeo", videoId: "76979871" }],
    ["https://www.vimeo.com/76979871/", { provider: "vimeo", videoId: "76979871" }],
    ["https://vimeo.com/76979871/a1b2c3d4e5", { provider: "vimeo", videoId: "76979871", hash: "a1b2c3d4e5" }],
    ["https://vimeo.com/channels/staffpicks/76979871", { provider: "vimeo", videoId: "76979871" }],
    ["https://vimeo.com/groups/shortfilms/videos/76979871", { provider: "vimeo", videoId: "76979871" }],
    ["https://player.vimeo.com/video/76979871", { provider: "vimeo", videoId: "76979871" }],
    ["https://player.vimeo.com/video/76979871?h=a1b2c3d4e5&badge=0&app_id=58479", { provider: "vimeo", videoId: "76979871", hash: "a1b2c3d4e5" }],
    ["https://player.vimeo.com/video/76979871?dnt=1", { provider: "vimeo", videoId: "76979871", privacy: true }],
    ["https://player.vimeo.com/video/76979871?dnt=0", { provider: "vimeo", videoId: "76979871", privacy: false }],
    ["https://vimeo.com/76979871#t=1m2s", { provider: "vimeo", videoId: "76979871", startSeconds: 62 }],
  ])("%s", (input, expected) => {
    expect(reference(input)).toEqual(expected);
  });

  it.each([
    ["https://vimeo.com/someuser", "unsupported-path"],
    ["https://vimeo.com/showcase/123", "unsupported-path"],
    ["https://vimeo.com/76979871/NOT-A-HASH", "invalid-id"],
    ["https://player.vimeo.com/video/abc", "invalid-id"],
    ["https://player.vimeo.com/video/76979871?h=zz%3Cscript", "invalid-id"],
    ["https://player.vimeo.com/76979871", "unsupported-path"],
    ["https://vimeo.com/channels/staffpicks/abc", "invalid-id"],
  ])("refuses %s (%s)", (input, reason) => {
    expect(failure(input)).toEqual({ reason, provider: "vimeo" });
  });
});

describe("parseVideoEmbedUrl — Loom", () => {
  it.each([
    [`https://www.loom.com/share/${LOOM}`],
    [`https://loom.com/share/${LOOM}?sid=abc-123`],
    [`https://www.loom.com/embed/${LOOM}`],
    [`https://www.loom.com/share/Product-demo-for-the-team-${LOOM}`],
  ])("%s", (input) => {
    expect(reference(input)).toEqual({ provider: "loom", videoId: LOOM });
  });

  it("keeps a start time", () => {
    expect(reference(`https://www.loom.com/share/${LOOM}?t=80s`).startSeconds).toBe(80);
  });

  it.each([
    [`https://www.loom.com/share/${LOOM.slice(1)}`, "invalid-id"],
    [`https://www.loom.com/share/${LOOM.toUpperCase()}`, "invalid-id"],
    [`https://www.loom.com/looms/videos`, "unsupported-path"],
    [`https://www.loom.com/share/${LOOM}/extra`, "unsupported-path"],
  ])("refuses %s (%s)", (input, reason) => {
    expect(failure(input)).toEqual({ reason, provider: "loom" });
  });
});

describe("parseVideoEmbedUrl — Wistia", () => {
  it.each([
    [`https://fast.wistia.net/embed/iframe/${WISTIA}`],
    [`https://fast.wistia.com/embed/medias/${WISTIA}`],
    [`https://support.wistia.com/medias/${WISTIA}`],
    [`https://acme-co.wistia.com/medias/${WISTIA}?wvideo=${WISTIA}`],
    [`https://wi.st/medias/${WISTIA}`],
  ])("%s", (input) => {
    expect(reference(input)).toEqual({ provider: "wistia", videoId: WISTIA });
  });

  it("reads doNotTrack and time", () => {
    expect(reference(`https://fast.wistia.net/embed/iframe/${WISTIA}?doNotTrack=true&time=30`)).toEqual({ provider: "wistia", videoId: WISTIA, privacy: true, startSeconds: 30 });
  });

  it("only Wistia's own hosts: one DNS label under wistia.com, never deeper, never a look-alike", () => {
    expect(failure(`https://a.b.wistia.com/medias/${WISTIA}`)).toEqual({ reason: "unknown-host" });
    expect(failure(`https://wistia.com.evil.example/medias/${WISTIA}`)).toEqual({ reason: "unknown-host" });
    expect(failure(`https://evilwistia.com/medias/${WISTIA}`)).toEqual({ reason: "unknown-host" });
    expect(failure(`https://videos.example.com/medias/${WISTIA}`)).toEqual({ reason: "unknown-host" });
    expect(failure(`https://-bad.wistia.com/medias/${WISTIA}`)).toEqual({ reason: "unknown-host" });
  });

  it.each([
    [`https://fast.wistia.net/embed/iframe/TOO-SHORT`, "invalid-id"],
    [`https://fast.wistia.net/embed/iframe/${WISTIA.toUpperCase()}`, "invalid-id"],
    [`https://acme.wistia.com/projects/${WISTIA}`, "unsupported-path"],
    [`https://fast.wistia.net/${WISTIA}`, "unsupported-path"],
  ])("refuses %s (%s)", (input, reason) => {
    expect(failure(input)).toEqual({ reason, provider: "wistia" });
  });
});

describe("parseVideoEmbedUrl — deferred providers are recognized, never embedded", () => {
  it.each([
    ["https://www.dailymotion.com/video/x84sh87", "dailymotion"],
    ["https://dai.ly/x84sh87", "dailymotion"],
    ["https://geo.dailymotion.com/player/x5zhzj.html?video=x84sh87", "dailymotion"],
    ["https://www.twitch.tv/somechannel", "twitch"],
    ["https://www.twitch.tv/videos/123456789", "twitch"],
    ["https://clips.twitch.tv/SomeClipSlug", "twitch"],
    ["https://player.twitch.tv/?channel=somechannel&parent=example.com", "twitch"],
  ])("%s -> %s", (input, provider) => {
    expect(failure(input)).toEqual({ reason: "deferred-provider", provider });
  });
});

describe("parseVideoEmbedUrl — security (every pasted link is untrusted)", () => {
  it.each([
    // Host spoofing: exact host match only.
    [`https://youtube.com.evil.example/watch?v=${YT}`, "unknown-host"],
    [`https://evil.example/youtube.com/watch?v=${YT}`, "unknown-host"],
    [`https://evil.example/?u=https://youtu.be/${YT}`, "unknown-host"],
    [`https://youtube.com@evil.example/watch?v=${YT}`, "credentials"],
    [`https://evil.example@www.youtube.com/watch?v=${YT}`, "credentials"],
    [`https://user:pass@www.youtube.com/watch?v=${YT}`, "credentials"],
    [`https://www.youtube.com./watch?v=${YT}`, "unknown-host"],
    [`https://www.yоutube.com/watch?v=${YT}`, "unknown-host"], // Cyrillic о -> punycode
    [`https://notyoutube.com/watch?v=${YT}`, "unknown-host"],
    [`https://youtube.co/watch?v=${YT}`, "unknown-host"],
    [`https://bit.ly/3abcdef`, "unknown-host"],
    [`https://example.com/embed/${YT}`, "unknown-host"],
    // Ports.
    [`https://www.youtube.com:8443/watch?v=${YT}`, "port"],
    [`https://player.vimeo.com:444/video/76979871`, "port"],
    // Schemes.
    ["javascript:alert(1)", "unsafe-scheme"],
    ["JaVaScRiPt:alert(1)", "unsafe-scheme"],
    ["java\tscript:alert(1)", "unsafe-scheme"],
    ["data:text/html,<script>alert(1)</script>", "unsafe-scheme"],
    ["data:video/mp4;base64,AAAA", "unsafe-scheme"],
    ["file:///C:/Users/x/video.mp4", "unsafe-scheme"],
    ["blob:https://www.youtube.com/1234-5678", "unsafe-scheme"],
    ["vbscript:msgbox", "unsafe-scheme"],
    [`ftp://www.youtube.com/watch?v=${YT}`, "unsafe-scheme"],
    [`http://www.youtube.com/watch?v=${YT}`, "not-https"],
    [`//www.youtube.com/watch?v=${YT}`, "protocol-relative"],
    [`\\\\www.youtube.com/watch?v=${YT}`, "protocol-relative"],
    // Malformed.
    ["https://", "malformed"],
    ["https://www.you tube.com/", "malformed"],
    ["https://[::1", "malformed"],
    ["https://www.you\u0000tube.com/", "malformed"],
    ["", "empty"],
    ["   ", "empty"],
  ])("refuses %j (%s)", (input, reason) => {
    expect(failure(input).reason).toBe(reason);
  });

  it("an encoded backslash or slash never changes the host", () => {
    expect(failure(`https://evil.example%2F@www.youtube.com/watch?v=${YT}`).reason).toBe("credentials");
    expect(failure(`https://evil.example\\@www.youtube.com/watch?v=${YT}`).reason).toBe("unknown-host");
  });

  it("an IDNA-normalized spelling of the real host is the real host (the output is rebuilt anyway)", () => {
    expect(reference(`https://ＷＷＷ.YouTube.com/watch?v=${YT}`)).toEqual({ provider: "youtube", videoId: YT });
  });
});

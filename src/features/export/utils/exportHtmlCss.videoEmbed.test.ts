import { describe, expect, it } from "vitest";
import { createVideoEmbedNode } from "@/features/editor/factories/elementFactories";
import type { EditorElementNode } from "@/features/editor/types/document";
import { resolveVideoEmbedPlayerConfig } from "@/lib/videoEmbed/videoEmbedPlayerConfig";
import { EXPORTED_PAGE_ORIGIN } from "@/lib/iframeSandbox";
import { exportHtmlCss } from "./exportHtmlCss";

const YT = "dQw4w9WgXcQ";
const SRC = `https://www.youtube-nocookie.com/embed/${YT}?start=30`;

function page(children: EditorElementNode[]): EditorElementNode {
  return { id: "page-root", tag: "page", children };
}

function exported(document: EditorElementNode, mode: "standalone" | "separate" = "standalone") {
  const result = exportHtmlCss(document, { mode });
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  const html = result.files[0].content;
  return { result, html, parsed: new DOMParser().parseFromString(html, "text/html"), codes: result.diagnostics.map((diagnostic) => diagnostic.code) };
}

const video = (extra: Partial<EditorElementNode> = {}): EditorElementNode => ({ ...createVideoEmbedNode(), id: "iframe-video", src: SRC, title: "Product tour", ...extra });

describe("Video Embed export (BC-08.3)", () => {
  it.each(["standalone", "separate"] as const)("%s: a real player iframe with the shared configuration", (mode) => {
    const node = video({ muted: true, autoplay: true, loop: true });
    const { parsed, result } = exported(page([node]), mode);
    const iframe = parsed.querySelector("iframe");
    const config = resolveVideoEmbedPlayerConfig(node, { hostOrigin: EXPORTED_PAGE_ORIGIN, reducedMotion: false, fullscreenAllowed: true });
    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute("sandbox")).toBe("allow-forms allow-popups allow-scripts allow-same-origin");
    expect(iframe?.getAttribute("src")).toBe(config?.stillSrc);
    expect(iframe?.getAttribute("data-ly-video-src")).toBe(config?.src);
    expect(iframe?.getAttribute("data-ly-video-src")).toBe(`https://www.youtube-nocookie.com/embed/${YT}?start=30&autoplay=1&mute=1&loop=1&playlist=${YT}`);
    expect(iframe?.getAttribute("src")).toBe(`https://www.youtube-nocookie.com/embed/${YT}?start=30&mute=1&loop=1&playlist=${YT}`);
    expect(iframe?.getAttribute("title")).toBe("Product tour");
    expect(iframe?.getAttribute("allow")).toBe("fullscreen");
    expect(iframe?.getAttribute("referrerpolicy")).toBe("strict-origin-when-cross-origin");
    expect(iframe?.getAttribute("loading")).toBe("lazy");
    expect(iframe?.hasAttribute("allowfullscreen")).toBe(false);
    // The runtime that manages the player is included.
    if (mode === "standalone") expect(parsed.querySelector("script")?.textContent).toContain("data-ly-video-src");
    else expect(result.files.map((file) => file.path)).toContain("script.js");
  });

  it("muted-only autoplay: unmuted autoplay is never written, and a warning says so", () => {
    const { parsed, codes } = exported(page([video({ autoplay: true, muted: false })]));
    const iframe = parsed.querySelector("iframe");
    expect(iframe?.getAttribute("data-ly-video-src")).toBe(SRC);
    expect(iframe?.getAttribute("src")).toBe(SRC);
    expect(codes).toContain("unmuted-autoplay");
  });

  it("one 'needs a website' info per page, however many players", () => {
    const { codes } = exported(page([video({ id: "iframe-a" }), video({ id: "iframe-b" })]));
    expect(codes.filter((code) => code === "video-embed-needs-website")).toHaveLength(1);
  });

  it("no link, or a link that isn't a supported video: the empty box and a warning, never an iframe", () => {
    for (const src of [undefined, "https://evil.example/embed/x", `https://youtube.com.evil.example/embed/${YT}`, "https://www.twitch.tv/x"]) {
      const { parsed, codes, html } = exported(page([video({ src })]));
      expect(parsed.querySelector("iframe"), String(src)).toBeNull();
      expect(codes).toContain("video-embed-invalid");
      expect(html).not.toContain("evil.example");
      expect(parsed.querySelector("script")).toBeNull();
    }
  });

  it("Vimeo (playback blocked, BC-08.3): the empty box and a warning that says why, never an iframe", () => {
    const { parsed, codes, result } = exported(page([video({ src: "https://player.vimeo.com/video/76979871?dnt=1" })]));
    expect(parsed.querySelector("iframe")).toBeNull();
    expect(codes).toContain("video-embed-blocked");
    expect(result.diagnostics.find((diagnostic) => diagnostic.code === "video-embed-blocked")?.message).toMatch(/encrypted media/);
  });

  it("a generic Embed — even with a YouTube URL — exports exactly as before", () => {
    const generic: EditorElementNode = { id: "iframe-generic", tag: "iframe", src: `https://www.youtube.com/embed/${YT}`, title: "Embedded content" };
    const { parsed, codes } = exported(page([generic]));
    const iframe = parsed.querySelector("iframe");
    expect(iframe?.getAttribute("sandbox")).toBe("allow-forms allow-popups allow-scripts allow-same-origin");
    expect(iframe?.getAttribute("src")).toBe(`https://www.youtube.com/embed/${YT}`);
    for (const name of ["allow", "allowfullscreen", "referrerpolicy", "loading", "data-ly-video-src"]) expect(iframe?.hasAttribute(name), name).toBe(false);
    expect(codes).not.toContain("video-embed-needs-website");
    expect(parsed.querySelector("script")).toBeNull();
  });

  it("exporting never changes the document", () => {
    const document = page([video({ muted: true, autoplay: true })]);
    const snapshot = JSON.stringify(document);
    exportHtmlCss(document, { mode: "standalone" });
    exportHtmlCss(document, { mode: "separate" });
    expect(JSON.stringify(document)).toBe(snapshot);
  });
});

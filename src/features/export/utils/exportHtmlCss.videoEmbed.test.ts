import { describe, expect, it } from "vitest";
import { createVideoEmbedNode } from "@/features/editor/factories/elementFactories";
import type { EditorElementNode } from "@/features/editor/types/document";
import { exportHtmlCss } from "./exportHtmlCss";

const YT = "dQw4w9WgXcQ";

function page(children: EditorElementNode[]): EditorElementNode {
  return { id: "page-root", tag: "page", children };
}

function html(document: EditorElementNode, mode: "standalone" | "separate" = "standalone"): { text: string; codes: string[] } {
  const result = exportHtmlCss(document, { mode });
  if (!result.ok) throw new Error("export failed");
  return { text: result.files[0].content, codes: result.diagnostics.map((diagnostic) => diagnostic.code) };
}

describe("Video Embed export — BC-08.2 interim feature gate", () => {
  it.each(["standalone", "separate"] as const)("%s: no iframe, no provider URL, and a warning that says so", (mode) => {
    const embed: EditorElementNode = { ...createVideoEmbedNode(), id: "iframe-video", src: `https://www.youtube-nocookie.com/embed/${YT}`, muted: true, autoplay: true };
    const { text, codes } = html(page([embed]), mode);
    const parsed = new DOMParser().parseFromString(text, "text/html");
    expect(parsed.querySelector("iframe")).toBeNull();
    expect(text).not.toContain("youtube");
    expect(text).not.toContain(YT);
    expect(codes).toContain("video-embed-not-exported");
    // The layout box is still there, so the page's layout is unchanged.
    expect(parsed.body.querySelectorAll("div").length).toBeGreaterThan(0);
  });

  it("an empty Video Embed exports the same way", () => {
    const { text, codes } = html(page([{ ...createVideoEmbedNode(), id: "iframe-empty" }]));
    expect(new DOMParser().parseFromString(text, "text/html").querySelector("iframe")).toBeNull();
    expect(codes).toEqual(["video-embed-not-exported"]);
  });

  it("a generic Embed — even with a YouTube URL — exports exactly as before: sandboxed iframe, no new attributes", () => {
    const generic: EditorElementNode = { id: "iframe-generic", tag: "iframe", src: `https://www.youtube.com/embed/${YT}`, title: "Embedded content" };
    const { text, codes } = html(page([generic]));
    const iframe = new DOMParser().parseFromString(text, "text/html").querySelector("iframe");
    expect(iframe?.getAttribute("sandbox")).toBe("allow-forms allow-popups allow-scripts allow-same-origin");
    expect(iframe?.getAttribute("src")).toBe(`https://www.youtube.com/embed/${YT}`);
    expect(iframe?.getAttributeNames().sort()).toEqual(["class", "sandbox", "src", "title"].filter((name) => iframe?.hasAttribute(name)).sort());
    expect(iframe?.hasAttribute("allow")).toBe(false);
    expect(iframe?.hasAttribute("allowfullscreen")).toBe(false);
    expect(codes).not.toContain("video-embed-not-exported");
  });
});

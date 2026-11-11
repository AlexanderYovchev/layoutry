import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { EditorElementNode } from "@/features/editor/types/document";
import { exportHtmlCss } from "./exportHtmlCss";

const fixture = (name: string) => readFileSync(path.join(process.cwd(), "test", "fixtures", "images", name));
const dataUrl = (type: string, bytes: Buffer) => `data:${type};base64,${bytes.toString("base64")}`;
const PNG = dataUrl("image/png", fixture("upload-40x30.png"));
const JPEG = dataUrl("image/jpeg", fixture("upload-32x24.jpg"));
const GIF = dataUrl("image/gif", fixture("upload-20x10-animated.gif"));
const SVG_PLACEHOLDER = "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2210%22%20height%3D%2210%22%2F%3E";

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

/** A page mixing uploaded, duplicated, remote, relative and placeholder sources, with alt text, ids, classes, styles and an interaction. */
function mixedDocument(): EditorElementNode {
  return {
    id: "page-root",
    tag: "page",
    children: [
      { id: "img-hero", tag: "img", src: PNG, displayName: `Hero "photo" & <logo>`, htmlId: "hero", className: "hero wide", filters: { opacity: 80 } },
      { id: "img-copy", tag: "img", src: PNG, displayName: "Same photo again" },
      { id: "img-jpeg", tag: "img", src: JPEG, displayName: "Card" },
      { id: "img-remote", tag: "img", src: "https://example.com/remote.png", displayName: "Remote" },
      { id: "img-relative", tag: "img", src: "images/local.png", displayName: "Relative" },
      { id: "img-placeholder", tag: "img", src: SVG_PLACEHOLDER },
      { id: "panel", tag: "div", background: { image: GIF } },
      { id: "banner", tag: "div", background: { image: PNG } },
      { id: "video-1", tag: "video", src: "https://example.com/clip.mp4", poster: JPEG },
      {
        id: "toggle",
        tag: "button",
        text: "Toggle",
        interactions: [{ id: "i-1", trigger: "click", action: "toggle", targetId: "img-jpeg" }],
      },
    ],
  };
}

const htmlOf = (result: ReturnType<typeof exportHtmlCss>) => result.files.find((file) => file.path === "index.html")!.content;
const cssOf = (result: ReturnType<typeof exportHtmlCss>) => result.files.find((file) => file.path === "styles.css")?.content ?? "";

describe("exportHtmlCss image packaging (BC-07.3)", () => {
  const document = deepFreeze(mixedDocument());
  const before = JSON.stringify(document);
  const separate = exportHtmlCss(document, { mode: "separate", title: "Mixed" });
  const html = htmlOf(separate);
  const css = cssOf(separate);

  it("separate files: each distinct uploaded image is one file in assets/, referenced by relative path", () => {
    expect(separate.ok).toBe(true);
    expect(separate.assetFiles.map((file) => [file.path, file.mediaType, file.references])).toEqual([
      ["assets/image-001.png", "image/png", 3], // two <img> and one background
      ["assets/image-002.jpg", "image/jpeg", 2], // an <img> and a video poster
      ["assets/image-003.gif", "image/gif", 1], // a background
    ]);
    expect(Buffer.from(separate.assetFiles[0].bytes).equals(fixture("upload-40x30.png"))).toBe(true);
    expect(Buffer.from(separate.assetFiles[1].bytes).equals(fixture("upload-32x24.jpg"))).toBe(true);
    expect(Buffer.from(separate.assetFiles[2].bytes).equals(fixture("upload-20x10-animated.gif"))).toBe(true);
    expect(html).not.toContain("data:image/png");
    expect(html).not.toContain("data:image/jpeg");
    expect(css).not.toContain("data:image/gif");
  });

  it("rewrites only the packaged sources, through the normal printers: alt, id, class, styles, links and interactions are kept", () => {
    expect(html).toMatch(/<img id="hero" class="[^"]*hero wide" src="assets\/image-001\.png" alt="Hero &quot;photo&quot; &amp; &lt;logo&gt;">/);
    expect(html).toContain(`src="assets/image-001.png" alt="Same photo again"`);
    expect(html).toContain(`src="assets/image-002.jpg" alt="Card"`);
    expect(html).toContain(`poster="assets/image-002.jpg"`);
    expect(html).toContain(`src="https://example.com/remote.png" alt="Remote"`);
    expect(html).toContain(`src="images/local.png" alt="Relative"`);
    expect(html).toContain(`src="${SVG_PLACEHOLDER}"`);
    expect(css).toContain(`background-image: url("assets/image-003.gif")`);
    expect(css).toContain(`background-image: url("assets/image-001.png")`);
    expect(css).toMatch(/opacity: 0\.8/);
    expect(separate.files.map((file) => file.path)).toEqual(["index.html", "styles.css", "script.js"]);
    expect(html).toMatch(/data-ly-toggle|aria-controls/);
  });

  it("lists every reference with its kind for the dialog", () => {
    expect(separate.assets.filter((asset) => asset.kind === "packaged").map((asset) => [asset.nodeId, asset.property, asset.url])).toEqual(
      expect.arrayContaining([
        ["img-hero", "src", "assets/image-001.png"],
        ["img-copy", "src", "assets/image-001.png"],
        ["img-jpeg", "src", "assets/image-002.jpg"],
        ["video-1", "poster", "assets/image-002.jpg"],
        ["panel", "background-image", "assets/image-003.gif"],
        ["banner", "background-image", "assets/image-001.png"],
      ]),
    );
    expect(separate.assets.find((asset) => asset.nodeId === "img-remote")).toMatchObject({ kind: "remote" });
    expect(separate.assets.find((asset) => asset.nodeId === "img-relative")).toMatchObject({ kind: "relative" });
    expect(separate.assets.find((asset) => asset.nodeId === "img-placeholder")).toMatchObject({ kind: "data" });
  });

  it("the single HTML file keeps every image embedded and ships no asset files", () => {
    const standalone = exportHtmlCss(document, { mode: "standalone", title: "Mixed" });
    expect(standalone.assetFiles).toEqual([]);
    expect(htmlOf(standalone)).toContain(`src="${PNG}"`);
    expect(htmlOf(standalone)).toContain(`url("${GIF}")`);
    expect(htmlOf(standalone)).not.toContain("assets/");
  });

  it("is deterministic and never changes the authored document", () => {
    const again = exportHtmlCss(document, { mode: "separate", title: "Mixed" });
    expect(again.files).toEqual(separate.files);
    expect(again.assetFiles).toEqual(separate.assetFiles);
    expect(JSON.stringify(document)).toBe(before);
  });

  it("a page without uploaded images exports exactly as before", () => {
    const plain: EditorElementNode = { id: "page-root", tag: "page", children: [{ id: "img-1", tag: "img", src: SVG_PLACEHOLDER }, { id: "img-2", tag: "img", src: "https://example.com/a.png" }] };
    const result = exportHtmlCss(plain, { mode: "separate", title: "Plain" });
    expect(result.assetFiles).toEqual([]);
    expect(htmlOf(result)).toContain(`src="${SVG_PLACEHOLDER}"`);
    expect(result.files.map((file) => file.path)).toEqual(["index.html", "styles.css"]);
  });

  it("a declared type that doesn't match the bytes is still packaged by its real type, with an info note", () => {
    const result = exportHtmlCss({ id: "page-root", tag: "page", children: [{ id: "img-1", tag: "img", src: dataUrl("image/png", fixture("upload-32x24.jpg")) }] }, { mode: "separate" });
    expect(htmlOf(result)).toContain(`src="assets/image-001.jpg"`);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: "embedded-image-type-mismatch", severity: "info", nodeId: "img-1", property: "src" }));
  });

  /**
   * BC-07.4 fallback audit: every kind of embedded image source an older or
   * hand-edited project can hold, and what each export mode does with it.
   * "packaged" = a file in assets/; "embedded" = the source exactly as
   * authored; "refused" = an error that blocks the export; "dropped" = the
   * URL policy removes it (pre-existing, with its own warning).
   */
  describe("invalid and unusual embedded sources (BC-07.4 fallback audit)", () => {
    const jpegBytes = fixture("upload-32x24.jpg");
    const svgScript = '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script></svg>';
    const cases: [string, string, "packaged" | "refused" | "embedded" | "dropped", "embedded" | "embedded-warned" | "dropped", string | null][] = [
      // name, src, separate outcome, standalone outcome, diagnostic code
      ["a valid legacy PNG", PNG, "packaged", "embedded", null],
      ["a JPEG declared as PNG", dataUrl("image/png", jpegBytes), "packaged", "embedded", "embedded-image-type-mismatch"],
      ["malformed base64 declared PNG", "data:image/png;base64,iVBOR*w0KGgo=", "refused", "embedded-warned", "embedded-image-invalid"],
      ["a truncated JPEG", dataUrl("image/jpeg", jpegBytes.subarray(0, 300)), "refused", "embedded-warned", "embedded-image-invalid"],
      ["a truncated WebP", dataUrl("image/webp", fixture("upload-24x16.webp").subarray(0, 200)), "refused", "embedded-warned", "embedded-image-invalid"],
      ["HTML and script declared as PNG", dataUrl("image/png", Buffer.from("<!doctype html><script>alert(1)</script>")), "refused", "embedded-warned", "embedded-image-invalid"],
      ["oversized decoded data", "data:image/png;base64," + "A".repeat(Math.ceil((16 * 1024 * 1024) / 3) * 4 + 4), "refused", "embedded-warned", "embedded-image-invalid"],
      ["an SVG data URL with script", `data:image/svg+xml;base64,${Buffer.from(svgScript).toString("base64")}`, "embedded", "embedded", null],
      ["an unsupported format (BMP)", "data:image/bmp;base64,Qk0=", "embedded", "embedded", null],
      ["an HTML data URL", "data:text/html,<script>alert(1)</script>", "dropped", "dropped", "unsafe-url"],
    ];

    it.each(cases)("%s", (_name, src, separateOutcome, standaloneOutcome, code) => {
      const document: EditorElementNode = { id: "page-root", tag: "page", children: [{ id: "img-1", tag: "img", src, displayName: "Case" }] };
      const separate = exportHtmlCss(document, { mode: "separate" });
      const standalone = exportHtmlCss(document, { mode: "standalone" });
      const diagnostic = (result: ReturnType<typeof exportHtmlCss>) => result.diagnostics.find((entry) => entry.nodeId === "img-1" && entry.property === "src");

      if (separateOutcome === "refused") {
        expect(separate.ok).toBe(false);
        expect(separate.files).toEqual([]);
        expect(separate.assetFiles).toEqual([]);
        expect(diagnostic(separate)).toMatchObject({ code, severity: "error", message: expect.stringContaining("Replace or remove this image") });
      } else {
        expect(separate.ok).toBe(true);
        const html = htmlOf(separate);
        if (separateOutcome === "packaged") expect(html).toMatch(/src="assets\/image-001\.(png|jpg)" alt="Case"/);
        if (separateOutcome === "embedded") expect(html).toContain(`src="${src}" alt="Case"`);
        if (separateOutcome === "dropped") expect(html).not.toContain("data:text/html");
        if (code) expect(diagnostic(separate)).toMatchObject({ code });
        else expect(diagnostic(separate)).toBeUndefined();
      }

      expect(standalone.ok).toBe(true);
      expect(standalone.assetFiles).toEqual([]);
      const standaloneHtml = htmlOf(standalone);
      if (standaloneOutcome === "dropped") expect(standaloneHtml).not.toContain("data:text/html");
      else expect(standaloneHtml).toContain(`src="${src}" alt="Case"`);
      if (standaloneOutcome === "embedded-warned") expect(diagnostic(standalone)).toMatchObject({ code: "embedded-image-invalid", severity: "warning", message: expect.stringContaining("broken image") });
      // An embedded image never makes a single-file export claim it's a different type.
      if (standaloneOutcome === "embedded") expect(diagnostic(standalone)).toBeUndefined();
    });
  });

  it("a refused export ships no asset files", () => {
    const result = exportHtmlCss({ id: "page-root", tag: "page", children: [{ id: "x", tag: "script" } as unknown as EditorElementNode] }, { mode: "separate" });
    expect(result.ok).toBe(false);
    expect(result.assetFiles).toEqual([]);
  });
});

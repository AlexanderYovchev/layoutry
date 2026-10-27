import { describe, expect, it } from "vitest";
import type { EditorElementNode } from "@/features/editor/types/document";
import { exportHtmlCss } from "@/features/export";
import { EXPORT_INTERACTION_RUNTIME } from "@/features/export/utils/exportInteractionRuntime";
import type { HtmlCssExportResult } from "@/features/export/types/exportResult";
import { catalogDocument, VISUAL_PARITY_DOCUMENTS } from "../../../../test/fixtures/export/exportFixtureDocuments";

function file(result: HtmlCssExportResult, path: string): string {
  const match = result.files.find((candidate) => candidate.path === path);
  if (!match) throw new Error(`no ${path} in ${result.files.map((candidate) => candidate.path).join(", ")}`);
  return match.content;
}

function embeddedCss(html: string): string {
  const start = html.indexOf("<style>\n") + "<style>\n".length;
  return html.slice(start, html.indexOf("</style>"));
}

/** Reverses every object's key order, deeply — same document, different insertion order. */
function reverseKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseKeys);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).reverse().map(([key, entry]) => [key, reverseKeys(entry)]));
  return value;
}

const hostileDocument: EditorElementNode = {
  id: "page-root",
  tag: "page",
  children: [
    { id: "h-1", tag: "h1", text: `</h1><script>alert("text")</script><img src=x onerror=alert(1)>`, htmlId: `x" onclick="alert(1)`, className: `"><script>alert(1)</script>` },
    { id: "a-1", tag: "a", text: "link", href: "  JaVa\tScRiPt:alert(document.cookie)" },
    { id: "a-2", tag: "a", text: "data", href: "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==" },
    // The project schema already refuses a plain `javascript:` src/href; these
    // obfuscated forms pass it, so they exercise export's own stricter policy.
    { id: "img-1", tag: "img", src: "java\nscript:alert(1)", displayName: `" onload="alert(1)` },
    { id: "frame-1", tag: "iframe", src: "data:text/html,<script>alert(1)</script>", title: `</title><script>alert(1)</script>` },
    {
      id: "p-1",
      tag: "p",
      text: "styled",
      typography: { color: "red;}</style><script>alert(1)</script><style>", fontFamily: "x}body{background:url(javascript:alert(1))" },
      background: { color: "expression(alert(1))", sourceType: "image", image: "javascript:alert(1)" },
    },
    { id: "t-1", tag: "textarea", value: "</textarea><script>alert(1)</script>" },
    { id: "s-1", tag: "svg", svgFill: "url(javascript:alert(1))", svgStroke: "red\" onload=\"alert(1)" },
  ],
};

describe("exportHtmlCss — document shape", () => {
  it("writes a complete HTML5 document with the stylesheet embedded in standalone mode", () => {
    const result = exportHtmlCss(VISUAL_PARITY_DOCUMENTS[0].build(), { mode: "standalone", title: "My <Page>" });
    expect(result.ok).toBe(true);
    expect(result.files.map((candidate) => candidate.path)).toEqual(["index.html"]);
    const html = file(result, "index.html");
    expect(html.startsWith('<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>My &lt;Page&gt;</title>\n<style>\n')).toBe(true);
    expect(html).not.toContain("<link");
    expect(html).not.toContain("<script");
  });

  it("keeps a static page to index.html + styles.css, with no script in either mode", () => {
    const document = VISUAL_PARITY_DOCUMENTS[1].build();
    const separate = exportHtmlCss(document, { mode: "separate" });
    expect(separate.files.map((candidate) => candidate.path)).toEqual(["index.html", "styles.css"]);
    expect(file(separate, "index.html")).not.toContain("<script");
    expect(file(exportHtmlCss(document, { mode: "standalone" }), "index.html")).not.toContain("<script");
  });

  it("links styles.css (and script.js for an interactive page) relatively, with exactly what standalone embeds", () => {
    const document = catalogDocument();
    const standalone = exportHtmlCss(document, { mode: "standalone" });
    const separate = exportHtmlCss(document, { mode: "separate" });
    expect(separate.files.map((candidate) => [candidate.path, candidate.mediaType])).toEqual([
      ["index.html", "text/html; charset=utf-8"],
      ["styles.css", "text/css; charset=utf-8"],
      ["script.js", "text/javascript; charset=utf-8"],
    ]);
    expect(file(separate, "script.js")).toBe(EXPORT_INTERACTION_RUNTIME);
    expect(file(separate, "index.html")).toContain('<script src="script.js"></script>\n</body>');
    expect(file(standalone, "index.html")).toContain(`<script>\n${EXPORT_INTERACTION_RUNTIME}</script>\n</body>`);
    expect(file(separate, "styles.css")).toBe(embeddedCss(file(standalone, "index.html")));
    expect(file(separate, "index.html")).toContain('<link rel="stylesheet" href="styles.css">');
    // Apart from how the stylesheet and script are attached, the two documents are identical.
    const standaloneHtml = file(standalone, "index.html")
      .replace(/<style>\n[\s\S]*<\/style>/, "STYLESHEET")
      .replace(/<script>\n[\s\S]*<\/script>/, "SCRIPT");
    const separateHtml = file(separate, "index.html")
      .replace('<link rel="stylesheet" href="styles.css">', "STYLESHEET")
      .replace('<script src="script.js"></script>', "SCRIPT");
    expect(separateHtml).toBe(standaloneHtml);
  });

  it("prints void and boolean attributes correctly and keeps a textarea's leading newline", () => {
    const result = exportHtmlCss(
      { id: "page-root", tag: "page", children: [{ id: "i-1", tag: "input", inputType: "checkbox", checked: true }, { id: "t-1", tag: "textarea", value: "\nsecond line" }, { id: "hr-1", tag: "hr" }] },
      { mode: "standalone" },
    );
    const html = file(result, "index.html");
    expect(html).toMatch(/<input class="[^"]+" type="checkbox" checked>/);
    expect(html).not.toContain("</input>");
    expect(html).toMatch(/<textarea class="[^"]+">\n\nsecond line<\/textarea>/);
    expect(html).toMatch(/<hr class="[^"]+">/);
    const parsed = new DOMParser().parseFromString(html, "text/html");
    expect(parsed.querySelector("textarea")?.value).toBe("\nsecond line");
  });

  it("never leaks editor-only markup or Canvas classes into the output", () => {
    const result = exportHtmlCss(catalogDocument(), { mode: "standalone" });
    const html = file(result, "index.html");
    for (const editorOnly of ["data-node-id", "data-parent-id", "contenteditable", "draggable", "opacity-40", "readonly", "zinc-", "dark:", "aria-hidden"]) {
      expect(html, editorOnly).not.toContain(editorOnly);
    }
    const parsed = new DOMParser().parseFromString(html, "text/html");
    for (const element of Array.from(parsed.body.querySelectorAll("[class]"))) {
      for (const token of Array.from(element.classList)) expect(token.startsWith("ly-") || token === "").toBe(true);
    }
  });

  it("refuses a document the project schema rejects, such as a plain javascript: source", () => {
    const result = exportHtmlCss({ id: "page-root", tag: "page", children: [{ id: "img-1", tag: "img", src: "javascript:alert(1)" }] }, { mode: "standalone" });
    expect(result).toMatchObject({ ok: false, files: [], diagnostics: [{ code: "invalid-document" }] });
  });

  it("refuses an invalid document with an error and produces no files", () => {
    const result = exportHtmlCss({ id: "page-root", tag: "page", children: [{ id: "x", tag: "marquee" }] }, { mode: "separate" });
    expect(result).toMatchObject({ ok: false, files: [], diagnostics: [{ severity: "error", code: "invalid-document" }] });
  });
});

describe("exportHtmlCss — determinism", () => {
  it.each(["standalone", "separate"] as const)("produces byte-identical %s output for identical documents, whatever their key order", (mode) => {
    for (const { build } of VISUAL_PARITY_DOCUMENTS) {
      const document = build();
      const first = exportHtmlCss(document, { mode });
      expect(exportHtmlCss(document, { mode })).toEqual(first);
      expect(exportHtmlCss(build(), { mode })).toEqual(first);
      expect(exportHtmlCss(reverseKeys(document) as EditorElementNode, { mode }).files).toEqual(first.files);
    }
  });

  it("does not mutate the input document", () => {
    const document = catalogDocument();
    const snapshot = structuredClone(document);
    exportHtmlCss(document, { mode: "separate" });
    expect(document).toEqual(snapshot);
  });
});

describe("exportHtmlCss — hostile documents", () => {
  const result = exportHtmlCss(hostileDocument, { mode: "standalone" });
  const html = file(result, "index.html");
  const parsed = new DOMParser().parseFromString(html, "text/html");

  it("produces no script, no event-handler attribute and no executable URL", () => {
    expect(parsed.querySelectorAll("script")).toHaveLength(0);
    for (const element of Array.from(parsed.querySelectorAll("*"))) {
      for (const { name, value } of Array.from(element.attributes)) {
        expect(name.startsWith("on"), `${element.tagName} ${name}`).toBe(false);
        if (name === "href" || name === "src") expect(value.replace(/[\s\u0000-\u001f]/g, "").toLowerCase()).not.toMatch(/^(javascript|vbscript|data:text)/);
      }
    }
  });

  it("keeps hostile text as inert text", () => {
    expect(parsed.querySelector("h1")?.textContent).toBe(hostileDocument.children?.[0].text);
    expect(parsed.querySelector("h1")?.getAttribute("id")).toBeNull();
    expect(parsed.querySelector("textarea")?.value).toBe("</textarea><script>alert(1)</script>");
    expect(parsed.querySelector("iframe")?.getAttribute("title")).toBe("</title><script>alert(1)</script>");
  });

  it("cannot terminate the embedded stylesheet or inject CSS", () => {
    const css = embeddedCss(html);
    expect(css.toLowerCase()).not.toContain("</style");
    expect(css).not.toContain("javascript");
    expect(css).not.toContain("expression(");
    expect(parsed.querySelectorAll("style")).toHaveLength(1);
  });

  it("reports every dropped or replaced value", () => {
    const codes = result.diagnostics.map((diagnostic) => `${diagnostic.nodeId}:${diagnostic.code}`).sort();
    expect(codes).toEqual(
      expect.arrayContaining(["a-1:unsafe-url", "a-2:unsafe-url", "img-1:unsafe-url", "frame-1:unsafe-url", "p-1:invalid-css-value", "p-1:invalid-color", "p-1:unsafe-url", "s-1:invalid-svg-paint", "h-1:invalid-html-id"]),
    );
    expect(result.ok).toBe(true);
  });
});

describe("exportHtmlCss — scale", () => {
  function wideDocument(count: number): EditorElementNode {
    const children: EditorElementNode[] = [];
    for (let index = 0; index < count; index++) {
      children.push({ id: `p-${index}`, tag: "p", text: `Paragraph ${index}`, typography: { color: "#334155", fontSize: { value: 14 + (index % 5), unit: "px" } }, spacing: { margin: { top: 4, right: 0, bottom: 4, left: 0 }, padding: { top: 0, right: 0, bottom: 0, left: 0 } } });
    }
    return { id: "page-root", tag: "page", children };
  }

  it("exports a maximum-size document (19,999 elements) within budget and deterministically", () => {
    const document = wideDocument(19_999);
    const heapBefore = process.memoryUsage().heapUsed;
    const started = performance.now();
    const first = exportHtmlCss(document, { mode: "separate" });
    const elapsed = performance.now() - started;
    const heapDelta = process.memoryUsage().heapUsed - heapBefore;
    expect(first.ok).toBe(true);
    const htmlBytes = first.files[0].content.length;
    const cssBytes = first.files[1].content.length;
    console.info(`EXPORT-1.2 scale: 20,000 nodes in ${elapsed.toFixed(0)} ms; html ${(htmlBytes / 1024).toFixed(0)} KiB, css ${(cssBytes / 1024).toFixed(0)} KiB; heap delta ~${(heapDelta / 1024 / 1024).toFixed(0)} MiB`);
    expect(elapsed).toBeLessThan(15_000);
    expect(exportHtmlCss(document, { mode: "separate" }).files).toEqual(first.files);
  });

  it("exports a 100-level-deep document without overflowing the stack", () => {
    let deep: EditorElementNode = { id: "leaf", tag: "p", text: "bottom" };
    for (let level = 0; level < 98; level++) deep = { id: `div-${level}`, tag: "div", children: [deep] };
    const started = performance.now();
    const result = exportHtmlCss({ id: "page-root", tag: "page", children: [deep] }, { mode: "standalone" });
    console.info(`EXPORT-1.2 scale: depth-100 document in ${(performance.now() - started).toFixed(0)} ms`);
    expect(result.ok).toBe(true);
    expect(new DOMParser().parseFromString(file(result, "index.html"), "text/html").querySelector("p")?.textContent).toBe("bottom");
  });

  it("measures small and medium documents", () => {
    for (const [label, document] of [["small (fixture)", VISUAL_PARITY_DOCUMENTS[0].build()], ["medium (81-entry catalog)", catalogDocument()], ["large (2,000 nodes)", wideDocument(1_999)]] as const) {
      const started = performance.now();
      const result = exportHtmlCss(document, { mode: "standalone" });
      console.info(`EXPORT-1.2 scale: ${label} in ${(performance.now() - started).toFixed(1)} ms, ${(result.files[0].content.length / 1024).toFixed(1)} KiB`);
      expect(result.ok).toBe(true);
    }
  });
});

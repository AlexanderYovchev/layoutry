import { describe, expect, it } from "vitest";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { ExportDiagnostic } from "@/features/export/types/exportDiagnostic";
import { countExportDiagnostics, describeExportDiagnostics, summarizeExportDiagnostics } from "@/features/export/utils/describeExportDiagnostics";
import { boundExportPreview } from "@/features/export/utils/exportPreviewText";
import { joinFileNames } from "@/features/export/utils/joinFileNames";
import { summarizeExportAssets } from "@/features/export/utils/summarizeExportAssets";

const document: EditorElementNode = {
  id: "page-root",
  tag: "page",
  children: [
    { id: "button-1", tag: "button", displayName: "Primary Button", text: "Go" },
    { id: "section-1", tag: "section", children: [{ id: "img-1", tag: "img" }] },
  ],
};

describe("describeExportDiagnostics", () => {
  it("orders by severity, keeps every diagnostic and names the element and property", () => {
    const diagnostics: ExportDiagnostic[] = [
      { code: "relative-url", severity: "info", nodeId: "img-1", property: "src", message: "relative" },
      { code: "unsafe-url", severity: "warning", nodeId: "button-1", property: "href", message: "unsafe" },
      { code: "document-too-deep", severity: "error", message: "too deep" },
      { code: "invalid-css-value", severity: "warning", nodeId: "gone", property: "width", message: "invalid" },
      { code: "duplicate-html-id", severity: "warning", nodeId: "page-root", message: "page" },
    ];
    expect(describeExportDiagnostics(diagnostics, document)).toEqual([
      { key: "2", severity: "error", severityLabel: "Error", message: "too deep", element: undefined, property: undefined },
      { key: "1", severity: "warning", severityLabel: "Warning", message: "unsafe", element: "Primary Button (button)", property: "href" },
      { key: "3", severity: "warning", severityLabel: "Warning", message: "invalid", element: "An element that is no longer in the design", property: "width" },
      { key: "4", severity: "warning", severityLabel: "Warning", message: "page", element: "Page", property: undefined },
      { key: "0", severity: "info", severityLabel: "Note", message: "relative", element: "Image (img)", property: "src" },
    ]);
    expect(summarizeExportDiagnostics(countExportDiagnostics(diagnostics))).toBe("1 error, 3 warnings, 1 note");
    expect(summarizeExportDiagnostics(countExportDiagnostics([]))).toBeNull();
  });
});

describe("boundExportPreview", () => {
  it("shows short files whole and counts lines", () => {
    expect(boundExportPreview("a\nb\n")).toEqual({ text: "a\nb\n", truncated: false, totalLines: 2, shownLines: 2 });
    expect(boundExportPreview("")).toEqual({ text: "", truncated: false, totalLines: 0, shownLines: 0 });
  });

  it("cuts long files at a line boundary, for display only", () => {
    const content = "line one\nline two\nline three\n";
    expect(boundExportPreview(content, 15)).toEqual({ text: "line one\n", truncated: true, totalLines: 3, shownLines: 1 });
    // One huge line: cut at the limit.
    expect(boundExportPreview("x".repeat(20), 8)).toEqual({ text: "x".repeat(8), truncated: true, totalLines: 1, shownLines: 1 });
  });
});

describe("summarizeExportAssets", () => {
  it("lists distinct remote and relative URLs, and ignores embedded data: URLs", () => {
    expect(
      summarizeExportAssets([
        { nodeId: "a", property: "src", url: "https://cdn.example/a.png", kind: "remote" },
        { nodeId: "b", property: "background-image", url: "https://cdn.example/a.png", kind: "remote" },
        { nodeId: "c", property: "src", url: "images/b.png", kind: "relative" },
        { nodeId: "d", property: "src", url: "data:image/png;base64,AAAA", kind: "data" },
      ]),
    ).toEqual({ remote: ["https://cdn.example/a.png"], relative: ["images/b.png"] });
  });
});

describe("joinFileNames", () => {
  it("reads naturally", () => {
    expect(joinFileNames([])).toBe("");
    expect(joinFileNames(["index.html"])).toBe("index.html");
    expect(joinFileNames(["index.html", "styles.css"])).toBe("index.html and styles.css");
    expect(joinFileNames(["index.html", "styles.css", "script.js"])).toBe("index.html, styles.css and script.js");
  });
});

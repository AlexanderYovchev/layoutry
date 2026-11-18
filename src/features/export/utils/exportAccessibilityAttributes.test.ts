import { describe, expect, it } from "vitest";
import { createBreadcrumbsNode, createPaginationNode } from "@/features/editor/factories/navigationCompositions";
import {
  addPaginationPage,
  setPaginationControlVisible,
  setPaginationCurrentPage,
  setPaginationPageHref,
  setPaginationPageLabel,
} from "@/features/editor/commands/paginationCommands";
import { getPaginationParts } from "@/features/editor/types/pagination";
import type { EditorElementNode } from "@/features/editor/types/document";
import { exportHtmlCss } from "@/features/export/utils/exportHtmlCss";

/**
 * BC-09.2 — Export writes the generic format 3 accessibility fields as
 * static HTML attributes, exactly as the Preview renders them
 * (accessibilityAttributes.test.tsx), and a new Pagination needs no
 * JavaScript.
 */

function exported(children: EditorElementNode[], mode: "separate" | "standalone" = "separate") {
  const result = exportHtmlCss({ id: "page-root", tag: "page", children }, { mode });
  const html = result.files.find((file) => file.path === "index.html")?.content ?? "";
  return { result, html, paths: result.files.map((file) => file.path) };
}

const tagOf = (html: string, text: string) => html.match(new RegExp(`<a[^>]*>${text}</a>`))?.[0] ?? "";

describe("Export — accessibility fields (BC-09.2)", () => {
  it("exports a new Pagination as a named nav with one current page, a disabled Previous and real links", () => {
    const { html, paths, result } = exported([createPaginationNode()]);
    expect(html).toMatch(/<nav class="[^"]*" aria-label="Pagination">/);
    expect(tagOf(html, "Previous")).toMatch(/^<a class="[^"]*" role="link" aria-disabled="true">Previous<\/a>$/);
    expect(tagOf(html, "1")).toMatch(/^<a class="[^"]*" aria-current="page">1<\/a>$/);
    for (const page of ["2", "3", "Next"]) expect(tagOf(html, page)).toMatch(/^<a class="[^"]*" href="#">/);
    expect(html.match(/aria-current=/g)).toHaveLength(1);
    // No Pagination-specific runtime: no script at all, and no diagnostics.
    expect(paths).not.toContain("script.js");
    expect(html).not.toContain("<script");
    expect(result.diagnostics).toEqual([]);
  });

  it("writes the same markup in a standalone file", () => {
    const pagination = createPaginationNode();
    const separate = exported([pagination]).html;
    const standalone = exported([pagination], "standalone").html;
    for (const text of ["Previous", "1", "2", "Next"]) expect(tagOf(standalone, text)).toBe(tagOf(separate, text));
  });

  it("gives a disabled button the native disabled attribute", () => {
    const { html } = exported([{ id: "b-1", tag: "button", text: "Next", disabled: true }]);
    expect(html).toMatch(/<button class="[^"]*" disabled type="button">Next<\/button>/);
  });

  it("escapes a label as an attribute value", () => {
    const { html } = exported([{ id: "nav-1", tag: "nav", ariaLabel: `"><script>alert(1)</script>&` }]);
    expect(html).toContain(`aria-label="&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;&amp;"`);
    expect(html).not.toContain("<script>alert");
  });

  it("never writes the stored href of a current or disabled link", () => {
    const { html, result } = exported([
      { id: "a-1", tag: "a", text: "1", href: "/blog/page/1", ariaCurrent: "page" },
      { id: "a-2", tag: "a", text: "Prev", href: "https://example.com/?p=0", disabled: true },
    ]);
    expect(html.match(/<a [^>]*>/g)).toHaveLength(2);
    expect(html.match(/<a [^>]*href=/g)).toBeNull();
    expect(result.diagnostics).toEqual([]);
  });

  it("still validates the stored href of a link that doesn't render it: a javascript: URL refuses the document", () => {
    const { html, result } = exported([{ id: "a-1", tag: "a", text: "1", href: "javascript:alert(1)", ariaCurrent: "page" }]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(["invalid-document"]);
    expect(html).not.toContain("javascript:");
  });

  it("still refuses an unsafe href on an ordinary link, as before", () => {
    const { html, result } = exported([{ id: "a-1", tag: "a", text: "x", href: "java\tscript:alert(1)" }]);
    expect(html).not.toContain("script:");
    expect(result.diagnostics.map((diagnostic) => diagnostic.nodeId)).toContain("a-1");
  });

  it("keeps a current-step link navigable (only aria-current=page removes the href)", () => {
    const { html } = exported([{ id: "a-1", tag: "a", text: "Step 2", href: "#step-2", ariaCurrent: "step" }]);
    expect(tagOf(html, "Step 2")).toMatch(/href="#step-2"/);
    expect(tagOf(html, "Step 2")).toMatch(/aria-current="step"/);
  });

  it("adds nothing to an element without the new fields", () => {
    const { html } = exported([{ id: "nav-1", tag: "nav", children: [{ id: "a-1", tag: "a", text: "Home", href: "/" }, { id: "b-1", tag: "button", text: "Go" }] }]);
    expect(html).not.toMatch(/aria-label|aria-current|aria-disabled|role=|disabled/);
  });
});

/** BC-09.4 — a managed Pagination: derived ellipsis semantics and one serializer for every mode. */
describe("Export — managed Pagination (BC-09.4)", () => {
  function managed(): EditorElementNode {
    const nav = createPaginationNode();
    let root: EditorElementNode = { id: "page-root", tag: "page", children: [nav] };
    for (let count = 3; count < 6; count++) root = addPaginationPage(root, nav.id);
    root = setPaginationControlVisible(root, nav.id, "first", true);
    root = setPaginationControlVisible(root, nav.id, "last", true);
    root = setPaginationControlVisible(root, nav.id, "ellipsis", true);
    const pages = getPaginationParts(root.children![0]).pages;
    root = setPaginationPageLabel(root, nav.id, pages[5].id, "20");
    pages.forEach((page, index) => {
      root = setPaginationPageHref(root, nav.id, page.id, `/p/${index + 1}`);
    });
    return setPaginationCurrentPage(root, nav.id, pages[2].id);
  }

  it("the ellipsis is aria-hidden; nothing else in the nav is hidden", () => {
    const { html } = exported(managed().children!);
    expect(html.match(/<p[^>]*>…<\/p>/)?.[0]).toMatch(/aria-hidden="true"/);
    expect(html.match(/aria-hidden=/g)).toHaveLength(1);
  });

  it("Breadcrumbs separators and an unmarked nav's '…' paragraph are not hidden", () => {
    const unmarked = { ...createPaginationNode(), component: undefined };
    const { html } = exported([createBreadcrumbsNode(), { ...unmarked, children: [...unmarked.children!, { id: "p-dots", tag: "p", text: "…", displayName: "Ellipsis" }] }]);
    expect(html).not.toContain("aria-hidden");
  });

  it("writes the same nav markup in standalone and separate files, with no script", () => {
    const document = managed();
    const nav = (html: string) => html.match(/<nav[\s\S]*<\/nav>/)?.[0];
    const separate = exportHtmlCss(document, { mode: "separate" });
    const standalone = exportHtmlCss(document, { mode: "standalone" });
    const separateHtml = separate.files.find((file) => file.path === "index.html")!.content;
    expect(nav(separateHtml)).toBeDefined();
    expect(nav(standalone.files[0].content)).toBe(nav(separateHtml));
    expect(separate.files.map((file) => file.path)).not.toContain("script.js");
    expect(standalone.files[0].content).not.toContain("<script");
  });
});

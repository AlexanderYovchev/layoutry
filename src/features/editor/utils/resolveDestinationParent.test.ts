import { describe, expect, it } from "vitest";
import { resolveDestinationParent } from "./resolveDestinationParent";
import type { EditorElementNode } from "@/features/editor/types/document";

const tree: EditorElementNode = {
  id: "page-root",
  tag: "page",
  children: [
    {
      id: "section-1",
      tag: "section",
      children: [{ id: "heading-1", tag: "h1", text: "Title" }],
    },
    { id: "section-2", tag: "section", children: [{ id: "image-1", tag: "img" }] },
  ],
};

describe("resolveDestinationParent", () => {
  it("targets the selected node itself when it can contain children", () => {
    expect(resolveDestinationParent(tree, "section-1")).toBe("section-1");
  });

  it("targets the selected node's parent when the selection is a leaf", () => {
    expect(resolveDestinationParent(tree, "image-1")).toBe("section-2");
  });

  it("falls back to the given fallback parent when nothing is selected", () => {
    expect(resolveDestinationParent(tree, null, "section-1")).toBe("section-1");
  });

  it("falls back to the document root when nothing is selected and no fallback is given", () => {
    expect(resolveDestinationParent(tree, null)).toBe("page-root");
  });

  it("falls back to the document root when the fallback parent no longer exists", () => {
    expect(resolveDestinationParent(tree, null, "does-not-exist")).toBe("page-root");
  });

  it("falls back to the document root when the selected id no longer resolves", () => {
    expect(resolveDestinationParent(tree, "does-not-exist")).toBe("page-root");
  });

  it("prefers the current selection over the fallback parent", () => {
    expect(resolveDestinationParent(tree, "section-1", "section-2")).toBe("section-1");
  });
});

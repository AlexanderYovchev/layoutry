import { describe, expect, it } from "vitest";
import { setElementMargin, setElementPadding } from "./spacingCommands";
import type { EditorElementNode } from "@/features/editor/types/document";

function tree(): EditorElementNode {
  return {
    id: "root",
    tag: "page",
    children: [
      { id: "container-1", tag: "div", children: [{ id: "heading-1", tag: "h1" }] },
    ],
  };
}

describe("setElementMargin", () => {
  it("sets margin on exactly one node, leaving padding untouched", () => {
    const root = tree();
    const result = setElementMargin(root, "container-1", { top: 10, right: 20, bottom: 10, left: 20 });
    const node = result.children?.find((c) => c.id === "container-1");
    expect(node?.spacing?.margin).toEqual({ top: 10, right: 20, bottom: 10, left: 20 });
    expect(node?.spacing?.padding).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it("preserves existing padding when only margin changes", () => {
    const root = tree();
    const withPadding = setElementPadding(root, "container-1", { top: 16, right: 16, bottom: 16, left: 16 });
    const result = setElementMargin(withPadding, "container-1", { top: 5, right: 5, bottom: 5, left: 5 });
    const node = result.children?.find((c) => c.id === "container-1");
    expect(node?.spacing?.padding).toEqual({ top: 16, right: 16, bottom: 16, left: 16 });
  });

  it("is a no-op (same reference) if nodeId doesn't exist", () => {
    const root = tree();
    const result = setElementMargin(root, "does-not-exist", { top: 1, right: 1, bottom: 1, left: 1 });
    expect(result).toBe(root);
  });

  it("keeps unrelated branches referentially unchanged", () => {
    const root: EditorElementNode = {
      id: "root",
      tag: "page",
      children: [
        { id: "a", tag: "div", children: [] },
        { id: "b", tag: "div", children: [] },
      ],
    };
    const result = setElementMargin(root, "a", { top: 1, right: 1, bottom: 1, left: 1 });
    expect(result.children?.find((c) => c.id === "b")).toBe(root.children?.find((c) => c.id === "b"));
  });
});

describe("setElementPadding", () => {
  it("sets padding on a plain (non-Free) node with no side effects", () => {
    const root = tree();
    const result = setElementPadding(root, "container-1", { top: 24, right: 24, bottom: 24, left: 24 });
    const node = result.children?.find((c) => c.id === "container-1");
    expect(node?.spacing?.padding).toEqual({ top: 24, right: 24, bottom: 24, left: 24 });
  });

  it("is a no-op (same reference) if nodeId doesn't exist", () => {
    const root = tree();
    const result = setElementPadding(root, "does-not-exist", { top: 1, right: 1, bottom: 1, left: 1 });
    expect(result).toBe(root);
  });

  describe("containment — Free container with children", () => {
    function freeTree(): EditorElementNode {
      return {
        id: "root",
        tag: "page",
        children: [
          {
            id: "section-1",
            tag: "section",
            layoutMode: "free",
            dimensions: { preferredWidth: 400, preferredHeight: 300, offsetX: 0, offsetY: 0 },
            children: [
              { id: "image-1", tag: "img", freeLayout: { x: 16, y: 16, width: 100, height: 80 } },
              { id: "paragraph-1", tag: "p", freeLayout: { x: 250, y: 150, width: 120, height: 80 } },
            ],
          },
        ],
      };
    }

    it("increasing padding shrinks the content bounds and re-clamps children that no longer fit", () => {
      const root = freeTree();
      // Outer 400x300; padding 100 on all sides leaves only 200x100 of content.
      const result = setElementPadding(root, "section-1", { top: 100, right: 100, bottom: 100, left: 100 });

      const section = result.children?.find((c) => c.id === "section-1");
      const image = section?.children?.find((c) => c.id === "image-1");
      const paragraph = section?.children?.find((c) => c.id === "paragraph-1");

      // Neither child may exceed the new 200x100 content box.
      expect(image!.freeLayout!.x + image!.freeLayout!.width).toBeLessThanOrEqual(200);
      expect(image!.freeLayout!.y + image!.freeLayout!.height).toBeLessThanOrEqual(100);
      expect(paragraph!.freeLayout!.x + paragraph!.freeLayout!.width).toBeLessThanOrEqual(200);
      expect(paragraph!.freeLayout!.y + paragraph!.freeLayout!.height).toBeLessThanOrEqual(100);
    });

    it("decreasing padding (more room) preserves every child's exact position/size", () => {
      const root = freeTree();
      const result = setElementPadding(root, "section-1", { top: 0, right: 0, bottom: 0, left: 0 });

      const section = result.children?.find((c) => c.id === "section-1");
      expect(section?.children?.find((c) => c.id === "image-1")?.freeLayout).toEqual({
        x: 16,
        y: 16,
        width: 100,
        height: 80,
      });
      expect(section?.children?.find((c) => c.id === "paragraph-1")?.freeLayout).toEqual({
        x: 250,
        y: 150,
        width: 120,
        height: 80,
      });
    });

    it("never scales children proportionally — clamps only, unlike a container resize under the scale policy", () => {
      const root = freeTree();
      root.children![0].childResizePolicy = "scale"; // even with scale policy active for resizes, padding must still just clamp
      const result = setElementPadding(root, "section-1", { top: 50, right: 50, bottom: 50, left: 50 });

      const image = result.children?.[0].children?.find((c) => c.id === "image-1");
      // Untouched (100x80 still fits inside the new 300x200 content box at x:16,y:16) — not scaled down.
      expect(image?.freeLayout).toEqual({ x: 16, y: 16, width: 100, height: 80 });
    });

    it("does nothing extra for a Flow-mode container (no children field manipulation)", () => {
      const root: EditorElementNode = {
        id: "root",
        tag: "page",
        children: [{ id: "section-1", tag: "section", children: [{ id: "heading-1", tag: "h1" }] }],
      };
      const result = setElementPadding(root, "section-1", { top: 32, right: 32, bottom: 32, left: 32 });
      const section = result.children?.find((c) => c.id === "section-1");
      expect(section?.children).toEqual(root.children?.[0].children);
    });

    it("is a no-op on children when the Free container has no explicit outer size yet", () => {
      const root: EditorElementNode = {
        id: "root",
        tag: "page",
        children: [
          {
            id: "section-1",
            tag: "section",
            layoutMode: "free",
            children: [{ id: "image-1", tag: "img", freeLayout: { x: 16, y: 16, width: 100, height: 80 } }],
          },
        ],
      };
      const result = setElementPadding(root, "section-1", { top: 200, right: 200, bottom: 200, left: 200 });
      const section = result.children?.find((c) => c.id === "section-1");
      expect(section?.children?.[0].freeLayout).toEqual({ x: 16, y: 16, width: 100, height: 80 });
    });
  });
});

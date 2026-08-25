import { describe, expect, it } from "vitest";
import {
  createButtonNode,
  createContainerNode,
  createElementNode,
  createHeadingNode,
  createImageNode,
  createLinkNode,
  createListItemNode,
  createOrderedListNode,
  createParagraphNode,
  createSectionNode,
  createUnorderedListNode,
  isInsertableElementType,
} from "./elementFactories";

describe("element factories", () => {
  it("createContainerNode produces an empty, childable div", () => {
    const node = createContainerNode();
    expect(node.tag).toBe("div");
    expect(node.children).toEqual([]);
    expect(node.id).toMatch(/^div-/);
  });

  it("createContainerNode defaults to Block display with 16px padding and zero margin (Checkpoint 3.5)", () => {
    const node = createContainerNode();
    expect(node.flowLayout).toEqual({ display: "block" });
    expect(node.spacing).toEqual({
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      padding: { top: 16, right: 16, bottom: 16, left: 16 },
    });
  });

  it("createSectionNode produces an empty, childable section (Checkpoint 1.2)", () => {
    const node = createSectionNode();
    expect(node.tag).toBe("section");
    expect(node.children).toEqual([]);
    expect(node.id).toMatch(/^section-/);
  });

  it("createSectionNode shares Container's exact structural defaults", () => {
    const section = createSectionNode();
    const container = createContainerNode();
    expect(section.flowLayout).toEqual(container.flowLayout);
    expect(section.spacing).toEqual(container.spacing);
  });

  it("leaf factories leave flowLayout/spacing unset (defaults come from the resolver, not stamped data)", () => {
    expect(createHeadingNode().flowLayout).toBeUndefined();
    expect(createHeadingNode().spacing).toBeUndefined();
  });

  it("createHeadingNode produces default heading text", () => {
    const node = createHeadingNode();
    expect(node.tag).toBe("h1");
    expect(node.text).toBe("New Heading");
  });

  it("createParagraphNode produces default paragraph text", () => {
    const node = createParagraphNode();
    expect(node.tag).toBe("p");
    expect(node.text).toBe("New paragraph text.");
  });

  it("createButtonNode produces default button text", () => {
    const node = createButtonNode();
    expect(node.tag).toBe("button");
    expect(node.text).toBe("Button");
  });

  it("createImageNode produces a plain image node", () => {
    const node = createImageNode();
    expect(node.tag).toBe("img");
  });

  it("createImageNode defaults to a placeholder src with a real 4:3 intrinsic aspect ratio (Checkpoint 3.5.1)", () => {
    const node = createImageNode();
    expect(node.src).toMatch(/^data:image\/svg\+xml/);
    expect(node.src).toContain("width%3D%22400%22");
    expect(node.src).toContain("height%3D%22300%22");
    expect(node.mediaFit).toBeUndefined();
  });

  it("createLinkNode produces a real anchor with default text and a safe destination (Checkpoint 1.4)", () => {
    const node = createLinkNode();
    expect(node.tag).toBe("a");
    expect(node.text).toBe("Link text");
    expect(node.href).toBe("#");
    expect(node.id).toMatch(/^a-/);
  });

  it("createLinkNode leaves flowLayout/spacing unset, matching every other leaf primitive", () => {
    expect(createLinkNode().flowLayout).toBeUndefined();
    expect(createLinkNode().spacing).toBeUndefined();
  });

  it("every factory produces a unique id per call", () => {
    const first = createButtonNode();
    const second = createButtonNode();
    expect(first.id).not.toBe(second.id);
  });

  it("createListItemNode produces a real, text-bearing leaf <li> (Checkpoint 1.6)", () => {
    const node = createListItemNode();
    expect(node.tag).toBe("li");
    expect(node.text).toBe("List item");
    expect(node.id).toMatch(/^li-/);
    expect(node.children).toBeUndefined();
  });

  it("createUnorderedListNode produces a <ul> with three starter <li> children as one logical node (Checkpoint 1.6)", () => {
    const node = createUnorderedListNode();
    expect(node.tag).toBe("ul");
    expect(node.children).toHaveLength(3);
    expect(node.children?.every((child) => child.tag === "li")).toBe(true);
  });

  it("createOrderedListNode produces an <ol> with three starter <li> children (Checkpoint 1.6)", () => {
    const node = createOrderedListNode();
    expect(node.tag).toBe("ol");
    expect(node.children).toHaveLength(3);
    expect(node.children?.every((child) => child.tag === "li")).toBe(true);
  });

  it("createUnorderedListNode/createOrderedListNode share Container's exact structural defaults", () => {
    const ul = createUnorderedListNode();
    const container = createContainerNode();
    expect(ul.flowLayout).toEqual(container.flowLayout);
    expect(ul.spacing).toEqual(container.spacing);
  });

  it("every starter list item gets its own fresh, unique id", () => {
    const node = createUnorderedListNode();
    const ids = node.children?.map((child) => child.id) ?? [];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("two separately created lists never share starter item ids", () => {
    const first = createUnorderedListNode();
    const second = createUnorderedListNode();
    const firstIds = first.children?.map((child) => child.id) ?? [];
    const secondIds = second.children?.map((child) => child.id) ?? [];
    expect(firstIds.some((id) => secondIds.includes(id))).toBe(false);
  });

  describe("createElementNode", () => {
    it("dispatches to the matching factory for every insertable type", () => {
      expect(createElementNode("container").tag).toBe("div");
      expect(createElementNode("section").tag).toBe("section");
      expect(createElementNode("heading").tag).toBe("h1");
      expect(createElementNode("paragraph").tag).toBe("p");
      expect(createElementNode("button").tag).toBe("button");
      expect(createElementNode("image").tag).toBe("img");
      expect(createElementNode("link").tag).toBe("a");
      expect(createElementNode("unorderedList").tag).toBe("ul");
      expect(createElementNode("orderedList").tag).toBe("ol");
      expect(createElementNode("listItem").tag).toBe("li");
    });
  });

  describe("isInsertableElementType", () => {
    it("recognizes every real insertable type", () => {
      for (const type of [
        "container",
        "section",
        "heading",
        "paragraph",
        "button",
        "image",
        "link",
        "unorderedList",
        "orderedList",
        "listItem",
      ]) {
        expect(isInsertableElementType(type)).toBe(true);
      }
    });

    it("rejects unknown strings", () => {
      expect(isInsertableElementType("video")).toBe(false);
      expect(isInsertableElementType("")).toBe(false);
    });
  });
});

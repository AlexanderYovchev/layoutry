import { describe, expect, it } from "vitest";
import {
  createButtonNode,
  createContainerNode,
  createElementNode,
  createHeadingNode,
  createImageNode,
  createParagraphNode,
  isInsertableElementType,
} from "./elementFactories";

describe("element factories", () => {
  it("createContainerNode produces an empty, childable div", () => {
    const node = createContainerNode();
    expect(node.tag).toBe("div");
    expect(node.children).toEqual([]);
    expect(node.id).toMatch(/^div-/);
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

  it("every factory produces a unique id per call", () => {
    const first = createButtonNode();
    const second = createButtonNode();
    expect(first.id).not.toBe(second.id);
  });

  describe("createElementNode", () => {
    it("dispatches to the matching factory for every insertable type", () => {
      expect(createElementNode("container").tag).toBe("div");
      expect(createElementNode("heading").tag).toBe("h1");
      expect(createElementNode("paragraph").tag).toBe("p");
      expect(createElementNode("button").tag).toBe("button");
      expect(createElementNode("image").tag).toBe("img");
    });
  });

  describe("isInsertableElementType", () => {
    it("recognizes every real insertable type", () => {
      for (const type of ["container", "heading", "paragraph", "button", "image"]) {
        expect(isInsertableElementType(type)).toBe(true);
      }
    });

    it("rejects unknown strings", () => {
      expect(isInsertableElementType("video")).toBe(false);
      expect(isInsertableElementType("")).toBe(false);
    });
  });
});

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

  it("createContainerNode defaults to Block display with 16px padding and zero margin (Checkpoint 3.5)", () => {
    const node = createContainerNode();
    expect(node.flowLayout).toEqual({ display: "block" });
    expect(node.spacing).toEqual({
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      padding: { top: 16, right: 16, bottom: 16, left: 16 },
    });
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

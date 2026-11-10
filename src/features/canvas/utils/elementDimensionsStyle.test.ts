import { describe, expect, it } from "vitest";
import { elementDimensionsStyle, elementPositionStyle, freeChildStyle } from "./elementDimensionsStyle";
import type { EditorElementNode } from "@/features/editor/types/document";

describe("elementDimensionsStyle", () => {
  it("returns undefined when there are no dimensions", () => {
    expect(elementDimensionsStyle(undefined)).toBeUndefined();
  });

  it("converts dimensions into inline width/height with flexShrink pinned to 0, no margin when offset is zero (Checkpoint 5.7: maxWidth/maxHeight ownership moved to resolveSizeConstraintsStyle)", () => {
    expect(
      elementDimensionsStyle({ preferredWidth: 320, preferredHeight: 180, offsetX: 0, offsetY: 0 }),
    ).toEqual({
      width: 320,
      height: 180,
      flexShrink: 0,
    });
  });

  it("adds marginLeft/marginTop when offsetX/offsetY are non-zero (west/north-anchored resize)", () => {
    expect(
      elementDimensionsStyle({ preferredWidth: 320, preferredHeight: 180, offsetX: -40, offsetY: -20 }),
    ).toEqual({
      width: 320,
      height: 180,
      flexShrink: 0,
      marginLeft: -40,
      marginTop: -20,
    });
  });

  it("adds only the margin for the axis that's actually offset", () => {
    const style = elementDimensionsStyle({
      preferredWidth: 320,
      preferredHeight: 180,
      offsetX: 0,
      offsetY: -20,
    });

    expect(style?.marginLeft).toBeUndefined();
    expect(style?.marginTop).toBe(-20);
  });

  it("never uses transform for the anchor offset (margin, not transform, is what keeps sibling flow correct)", () => {
    const style = elementDimensionsStyle({
      preferredWidth: 320,
      preferredHeight: 180,
      offsetX: -40,
      offsetY: -20,
    });

    expect(style?.transform).toBeUndefined();
  });

  it("adds overflow: hidden only when clipOverflowY is requested (text elements)", () => {
    const dimensions = { preferredWidth: 320, preferredHeight: 180, offsetX: 0, offsetY: 0 };

    expect(elementDimensionsStyle(dimensions)?.overflow).toBeUndefined();
    expect(elementDimensionsStyle(dimensions, { clipOverflowY: true })?.overflow).toBe("hidden");
  });
});

describe("freeChildStyle", () => {
  it("returns undefined when there is no geometry", () => {
    expect(freeChildStyle(undefined)).toBeUndefined();
  });

  it("converts geometry into position: absolute with left/top/width/height, no margin/maxWidth clamp", () => {
    expect(freeChildStyle({ x: 20, y: 30, width: 100, height: 80 })).toEqual({
      position: "absolute",
      left: 20,
      top: 30,
      width: 100,
      height: 80,
    });
  });

  it("adds overflow: hidden only when clipOverflowY is requested", () => {
    const geometry = { x: 0, y: 0, width: 100, height: 80 };
    expect(freeChildStyle(geometry)?.overflow).toBeUndefined();
    expect(freeChildStyle(geometry, { clipOverflowY: true })?.overflow).toBe("hidden");
  });
});

describe("elementPositionStyle", () => {
  it("uses elementDimensionsStyle (dimensions) when the parent is Flow", () => {
    const node: EditorElementNode = {
      id: "n1",
      tag: "p",
      dimensions: { preferredWidth: 320, preferredHeight: 180, offsetX: 0, offsetY: 0 },
      freeLayout: { x: 999, y: 999, width: 999, height: 999 },
    };

    expect(elementPositionStyle(node, "flow")).toEqual({
      width: 320,
      height: 180,
      flexShrink: 0,
    });
  });

  it("uses freeChildStyle (freeLayout) when the parent is Free, ignoring dimensions entirely", () => {
    const node: EditorElementNode = {
      id: "n1",
      tag: "p",
      dimensions: { preferredWidth: 320, preferredHeight: 180, offsetX: -40, offsetY: 0 },
      freeLayout: { x: 16, y: 16, width: 240, height: 80 },
    };

    expect(elementPositionStyle(node, "free")).toEqual({
      position: "absolute",
      left: 16,
      top: 16,
      width: 240,
      height: 80,
    });
  });

  it("returns undefined for a Free child with no freeLayout yet", () => {
    const node: EditorElementNode = { id: "n1", tag: "p" };
    expect(elementPositionStyle(node, "free")).toBeUndefined();
  });
});

describe("elementPositionStyle — spacing (Checkpoint 3.5)", () => {
  it("applies padding regardless of whether the node has been resized/positioned", () => {
    const node: EditorElementNode = {
      id: "n1",
      tag: "div",
      spacing: { padding: { top: 8, right: 16, bottom: 8, left: 16 } },
    };
    expect(elementPositionStyle(node, "flow")).toEqual({
      paddingTop: 8,
      paddingRight: 16,
      paddingBottom: 8,
      paddingLeft: 16,
    });
  });

  it("applies right/bottom margin directly (no offsetX/Y interaction on those axes)", () => {
    const node: EditorElementNode = {
      id: "n1",
      tag: "div",
      spacing: { margin: { right: 12, bottom: 24 } },
    };
    expect(elementPositionStyle(node, "flow")).toEqual({ marginRight: 12, marginBottom: 24 });
  });

  it("composes spacing.margin.left/top additively with offsetX/offsetY instead of one overwriting the other", () => {
    const node: EditorElementNode = {
      id: "n1",
      tag: "div",
      dimensions: { preferredWidth: 200, preferredHeight: 100, offsetX: -40, offsetY: -10 },
      spacing: { margin: { top: 5, left: 8 } },
    };
    const style = elementPositionStyle(node, "flow");
    expect(style?.marginLeft).toBe(-32); // -40 (offsetX) + 8 (spacing.margin.left)
    expect(style?.marginTop).toBe(-5); // -10 (offsetY) + 5 (spacing.margin.top)
  });

  it("applies margin even to a Free child (margin still applies to absolutely-positioned boxes)", () => {
    const node: EditorElementNode = {
      id: "n1",
      tag: "div",
      freeLayout: { x: 16, y: 16, width: 100, height: 80 },
      spacing: { margin: { top: 4, left: 4 } },
    };
    const style = elementPositionStyle(node, "free");
    expect(style).toEqual({
      position: "absolute",
      left: 16,
      top: 16,
      width: 100,
      height: 80,
      marginLeft: 4,
      marginTop: 4,
    });
  });

  it("returns undefined when neither geometry nor any authored spacing is present", () => {
    const node: EditorElementNode = { id: "n1", tag: "div" };
    expect(elementPositionStyle(node, "flow")).toBeUndefined();
    expect(elementPositionStyle({ ...node, spacing: {} }, "flow")).toBeUndefined();
  });
});

describe("elementPositionStyle — authored zero (BC-05.3)", () => {
  it("writes an authored 0 padding as a real declaration", () => {
    const node: EditorElementNode = { id: "b", tag: "button", spacing: { padding: { top: 0, right: 0, bottom: 0, left: 0 } } };
    expect(elementPositionStyle(node, "flow")).toEqual({ paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 });
  });

  it("writes only the authored sides, so unset sides keep their default", () => {
    const node: EditorElementNode = { id: "b", tag: "button", spacing: { padding: { left: 0, top: 12 } } };
    expect(elementPositionStyle(node, "flow")).toEqual({ paddingTop: 12, paddingLeft: 0 });
  });

  it("writes an authored 0 margin on every side, including the offset-composed left and top", () => {
    const node: EditorElementNode = { id: "h", tag: "h1", spacing: { margin: { top: 0, right: 0, bottom: 0, left: 0 } } };
    expect(elementPositionStyle(node, "flow")).toEqual({ marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0 });
  });

  it("composes an authored 0 margin with the resize-anchor offset", () => {
    const node: EditorElementNode = {
      id: "h",
      tag: "h1",
      dimensions: { preferredWidth: 200, preferredHeight: 100, offsetX: -40, offsetY: 0 },
      spacing: { margin: { left: 0 } },
    };
    const style = elementPositionStyle(node, "flow");
    expect(style?.marginLeft).toBe(-40);
    expect(style).not.toHaveProperty("marginTop");
  });

  it("writes an authored 0 margin on a Free child", () => {
    const node: EditorElementNode = { id: "n", tag: "div", freeLayout: { x: 1, y: 2, width: 3, height: 4 }, spacing: { margin: { top: 0 } } };
    expect(elementPositionStyle(node, "free")).toMatchObject({ marginTop: 0 });
    expect(elementPositionStyle(node, "free")).not.toHaveProperty("marginLeft");
  });
});

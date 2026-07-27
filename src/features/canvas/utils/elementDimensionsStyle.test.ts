import { describe, expect, it } from "vitest";
import { elementDimensionsStyle, elementPositionStyle, freeChildStyle } from "./elementDimensionsStyle";
import type { EditorElementNode } from "@/features/editor/types/document";

describe("elementDimensionsStyle", () => {
  it("returns undefined when there are no dimensions", () => {
    expect(elementDimensionsStyle(undefined)).toBeUndefined();
  });

  it("converts dimensions into inline width/height with a 100% max clamp and flexShrink pinned to 0, no margin when offset is zero", () => {
    expect(
      elementDimensionsStyle({ preferredWidth: 320, preferredHeight: 180, offsetX: 0, offsetY: 0 }),
    ).toEqual({
      width: 320,
      height: 180,
      maxWidth: "100%",
      maxHeight: "100%",
      flexShrink: 0,
    });
  });

  it("adds marginLeft/marginTop when offsetX/offsetY are non-zero (west/north-anchored resize)", () => {
    expect(
      elementDimensionsStyle({ preferredWidth: 320, preferredHeight: 180, offsetX: -40, offsetY: -20 }),
    ).toEqual({
      width: 320,
      height: 180,
      maxWidth: "100%",
      maxHeight: "100%",
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
      maxWidth: "100%",
      maxHeight: "100%",
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

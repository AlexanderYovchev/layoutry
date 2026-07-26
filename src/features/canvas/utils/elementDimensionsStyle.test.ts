import { describe, expect, it } from "vitest";
import { elementDimensionsStyle } from "./elementDimensionsStyle";

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

import { describe, expect, it } from "vitest";
import {
  applyBorderRadiusPreset,
  borderRadiusCornersEqual,
  getBorderRadiusCorner,
  getBorderRadiusSettings,
  isValidBorderRadiusCornerValue,
  isValidBorderRadiusValue,
  withBorderRadiusAllCorners,
  withBorderRadiusCorner,
  type BorderRadiusSettings,
} from "./borderRadius";

describe("getBorderRadiusSettings", () => {
  it("returns an empty object for a node with no radius", () => {
    expect(getBorderRadiusSettings({})).toEqual({});
  });

  it("returns the node's stored radius verbatim", () => {
    const borderRadius: BorderRadiusSettings = { topLeft: { value: 4, unit: "px" } };
    expect(getBorderRadiusSettings({ borderRadius })).toBe(borderRadius);
  });
});

describe("getBorderRadiusCorner", () => {
  it("returns undefined for an unset corner", () => {
    expect(getBorderRadiusCorner({}, "topLeft")).toBeUndefined();
  });

  it("returns the corner's own value when set", () => {
    const radius: BorderRadiusSettings = { bottomRight: { value: 8, unit: "px" } };
    expect(getBorderRadiusCorner(radius, "bottomRight")).toEqual({ value: 8, unit: "px" });
  });
});

describe("borderRadiusCornersEqual", () => {
  it("is true when every corner is unset", () => {
    expect(borderRadiusCornersEqual({})).toBe(true);
  });

  it("is true when all four corners hold an identical value", () => {
    const value = { value: 8, unit: "px" as const };
    expect(
      borderRadiusCornersEqual({ topLeft: value, topRight: value, bottomRight: value, bottomLeft: value }),
    ).toBe(true);
  });

  it("is false when one corner differs", () => {
    const value = { value: 8, unit: "px" as const };
    expect(
      borderRadiusCornersEqual({
        topLeft: value,
        topRight: value,
        bottomRight: value,
        bottomLeft: { value: 4, unit: "px" },
      }),
    ).toBe(false);
  });

  it("is false when only some corners are set", () => {
    expect(borderRadiusCornersEqual({ topLeft: { value: 8, unit: "px" } })).toBe(false);
  });
});

describe("withBorderRadiusCorner", () => {
  it("sets one corner while leaving the others untouched", () => {
    const radius: BorderRadiusSettings = { topLeft: { value: 4, unit: "px" } };
    expect(withBorderRadiusCorner(radius, "topRight", { value: 8, unit: "px" })).toEqual({
      topLeft: { value: 4, unit: "px" },
      topRight: { value: 8, unit: "px" },
    });
  });

  it("clears one corner, collapsing to undefined once every corner is empty", () => {
    const radius: BorderRadiusSettings = { topLeft: { value: 4, unit: "px" } };
    expect(withBorderRadiusCorner(radius, "topLeft", undefined)).toBeUndefined();
  });

  it("clearing one corner preserves the others", () => {
    const radius: BorderRadiusSettings = { topLeft: { value: 4, unit: "px" }, topRight: { value: 8, unit: "px" } };
    expect(withBorderRadiusCorner(radius, "topLeft", undefined)).toEqual({ topRight: { value: 8, unit: "px" } });
  });
});

describe("withBorderRadiusAllCorners", () => {
  it("writes the value to all four corners", () => {
    expect(withBorderRadiusAllCorners({ value: 8, unit: "px" })).toEqual({
      topLeft: { value: 8, unit: "px" },
      topRight: { value: 8, unit: "px" },
      bottomRight: { value: 8, unit: "px" },
      bottomLeft: { value: 8, unit: "px" },
    });
  });

  it("clears every corner when given undefined", () => {
    expect(withBorderRadiusAllCorners(undefined)).toBeUndefined();
  });
});

describe("isValidBorderRadiusValue", () => {
  it("accepts zero and positive finite numbers", () => {
    expect(isValidBorderRadiusValue(0)).toBe(true);
    expect(isValidBorderRadiusValue(50)).toBe(true);
  });

  it("rejects negative, NaN, and Infinity", () => {
    expect(isValidBorderRadiusValue(-1)).toBe(false);
    expect(isValidBorderRadiusValue(NaN)).toBe(false);
    expect(isValidBorderRadiusValue(Infinity)).toBe(false);
  });
});

describe("isValidBorderRadiusCornerValue", () => {
  it("accepts a well-formed corner value", () => {
    expect(isValidBorderRadiusCornerValue({ value: 8, unit: "px" })).toBe(true);
  });

  it("rejects a non-object", () => {
    expect(isValidBorderRadiusCornerValue("8px")).toBe(false);
    expect(isValidBorderRadiusCornerValue(null)).toBe(false);
  });

  it("rejects a negative value", () => {
    expect(isValidBorderRadiusCornerValue({ value: -8, unit: "px" })).toBe(false);
  });

  it("rejects a missing unit", () => {
    expect(isValidBorderRadiusCornerValue({ value: 8 })).toBe(false);
  });
});

describe("applyBorderRadiusPreset", () => {
  it("'none' clears the radius entirely", () => {
    expect(applyBorderRadiusPreset("none")).toBeUndefined();
  });

  it("'small' applies 4px to every corner", () => {
    const radius = applyBorderRadiusPreset("small");
    expect(radius).toEqual({
      topLeft: { value: 4, unit: "px" },
      topRight: { value: 4, unit: "px" },
      bottomRight: { value: 4, unit: "px" },
      bottomLeft: { value: 4, unit: "px" },
    });
  });

  it("'medium' applies 8px, 'large' applies 16px", () => {
    expect(applyBorderRadiusPreset("medium")?.topLeft).toEqual({ value: 8, unit: "px" });
    expect(applyBorderRadiusPreset("large")?.topLeft).toEqual({ value: 16, unit: "px" });
  });

  it("'pill' applies a large fixed pixel value to every corner", () => {
    const radius = applyBorderRadiusPreset("pill");
    expect(radius?.topLeft).toEqual({ value: 9999, unit: "px" });
    expect(radius?.bottomRight).toEqual({ value: 9999, unit: "px" });
  });

  it("'circle' applies 50% to every corner", () => {
    const radius = applyBorderRadiusPreset("circle");
    expect(radius).toEqual({
      topLeft: { value: 50, unit: "%" },
      topRight: { value: 50, unit: "%" },
      bottomRight: { value: 50, unit: "%" },
      bottomLeft: { value: 50, unit: "%" },
    });
  });
});

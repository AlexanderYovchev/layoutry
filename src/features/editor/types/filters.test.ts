import { describe, expect, it } from "vitest";
import {
  getFilterSettings,
  isValidBlurValue,
  isValidBrightnessValue,
  isValidContrastValue,
  isValidFilterFieldValue,
  isValidGrayscaleValue,
  isValidHueRotateValue,
  isValidInvertValue,
  isValidOpacityValue,
  isValidSaturateValue,
  isValidSepiaValue,
  normalizeHueRotateValue,
  withFilterField,
} from "./filters";

describe("getFilterSettings", () => {
  it("returns an empty object for a node with no filters set", () => {
    expect(getFilterSettings({})).toEqual({});
  });

  it("returns the stored settings verbatim", () => {
    const filters = { opacity: 50 };
    expect(getFilterSettings({ filters })).toBe(filters);
  });
});

describe("withFilterField", () => {
  it("sets a field", () => {
    expect(withFilterField({}, "opacity", 80)).toEqual({ opacity: 80 });
  });

  it("preserves other fields when setting one", () => {
    expect(withFilterField({ opacity: 80 }, "brightness", 120)).toEqual({ opacity: 80, brightness: 120 });
  });

  it("clears a field when value is undefined", () => {
    expect(withFilterField({ opacity: 80, brightness: 120 }, "opacity", undefined)).toEqual({ brightness: 120 });
  });

  it("collapses to undefined once every field has been cleared", () => {
    expect(withFilterField({ opacity: 80 }, "opacity", undefined)).toBeUndefined();
  });
});

describe("isValidOpacityValue", () => {
  it("accepts the full 0-100 range, including the boundaries", () => {
    expect(isValidOpacityValue(0)).toBe(true);
    expect(isValidOpacityValue(100)).toBe(true);
    expect(isValidOpacityValue(50)).toBe(true);
  });

  it("rejects negative and > 100", () => {
    expect(isValidOpacityValue(-1)).toBe(false);
    expect(isValidOpacityValue(101)).toBe(false);
  });

  it("rejects non-finite input", () => {
    expect(isValidOpacityValue(Number.NaN)).toBe(false);
  });
});

describe("isValidBlurValue", () => {
  it("accepts zero and positive values", () => {
    expect(isValidBlurValue(0)).toBe(true);
    expect(isValidBlurValue(12)).toBe(true);
  });

  it("rejects a negative value", () => {
    expect(isValidBlurValue(-1)).toBe(false);
  });
});

describe("isValidBrightnessValue / isValidContrastValue / isValidSaturateValue", () => {
  it("accept zero and any positive value, with no fixed upper bound", () => {
    expect(isValidBrightnessValue(0)).toBe(true);
    expect(isValidBrightnessValue(300)).toBe(true);
    expect(isValidBrightnessValue(500)).toBe(true);
    expect(isValidContrastValue(1000)).toBe(true);
    expect(isValidSaturateValue(1000)).toBe(true);
  });

  it("reject a negative value", () => {
    expect(isValidBrightnessValue(-1)).toBe(false);
    expect(isValidContrastValue(-1)).toBe(false);
    expect(isValidSaturateValue(-1)).toBe(false);
  });
});

describe("isValidGrayscaleValue / isValidInvertValue / isValidSepiaValue", () => {
  it("accept the full 0-100 range", () => {
    expect(isValidGrayscaleValue(0)).toBe(true);
    expect(isValidGrayscaleValue(100)).toBe(true);
    expect(isValidInvertValue(50)).toBe(true);
    expect(isValidSepiaValue(50)).toBe(true);
  });

  it("reject a value beyond 100", () => {
    expect(isValidGrayscaleValue(101)).toBe(false);
    expect(isValidInvertValue(101)).toBe(false);
    expect(isValidSepiaValue(101)).toBe(false);
  });

  it("reject a negative value", () => {
    expect(isValidGrayscaleValue(-1)).toBe(false);
    expect(isValidInvertValue(-1)).toBe(false);
    expect(isValidSepiaValue(-1)).toBe(false);
  });
});

describe("isValidHueRotateValue", () => {
  it("accepts any finite number, including outside 0-360 and negative", () => {
    expect(isValidHueRotateValue(0)).toBe(true);
    expect(isValidHueRotateValue(720)).toBe(true);
    expect(isValidHueRotateValue(-90)).toBe(true);
  });

  it("rejects non-finite input", () => {
    expect(isValidHueRotateValue(Number.NaN)).toBe(false);
    expect(isValidHueRotateValue(Number.POSITIVE_INFINITY)).toBe(false);
  });
});

describe("normalizeHueRotateValue", () => {
  it("wraps an angle >= 360 back into [0, 360)", () => {
    expect(normalizeHueRotateValue(370)).toBe(10);
    expect(normalizeHueRotateValue(720)).toBe(0);
  });

  it("wraps a negative angle into the positive range", () => {
    expect(normalizeHueRotateValue(-90)).toBe(270);
  });

  it("leaves an in-range angle unchanged", () => {
    expect(normalizeHueRotateValue(180)).toBe(180);
  });
});

describe("isValidFilterFieldValue", () => {
  it("validates each percentage field using its own rule", () => {
    expect(isValidFilterFieldValue("opacity", 50)).toBe(true);
    expect(isValidFilterFieldValue("opacity", 150)).toBe(false);
    expect(isValidFilterFieldValue("brightness", 500)).toBe(true);
    expect(isValidFilterFieldValue("grayscale", 150)).toBe(false);
  });

  it("validates blur as a CssLengthValue shape, not a plain number", () => {
    expect(isValidFilterFieldValue("blur", { value: 8, unit: "px" })).toBe(true);
    expect(isValidFilterFieldValue("blur", { value: -8, unit: "px" })).toBe(false);
    expect(isValidFilterFieldValue("blur", 8)).toBe(false);
  });

  it("rejects a non-number value for every percentage field", () => {
    expect(isValidFilterFieldValue("opacity", "50")).toBe(false);
    expect(isValidFilterFieldValue("hueRotate", null)).toBe(false);
  });
});

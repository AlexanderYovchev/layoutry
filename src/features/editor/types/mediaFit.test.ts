import { describe, expect, it } from "vitest";
import {
  DEFAULT_OBJECT_FIT,
  DEFAULT_OBJECT_POSITION_AXIS,
  OBJECT_FIT_PRESETS,
  OBJECT_POSITION_PRESETS,
  clearMediaFitPosition,
  detectObjectPositionPreset,
  getMediaFitSettings,
  isValidObjectFitValue,
  isValidObjectPositionAxis,
  withMediaFitField,
  withMediaFitPosition,
} from "./mediaFit";

describe("getMediaFitSettings", () => {
  it("returns an empty object when mediaFit is unset — no synthesized default is stored", () => {
    expect(getMediaFitSettings({})).toEqual({});
  });

  it("returns the node's own explicit settings when set", () => {
    const mediaFit = { objectFit: "cover" as const };
    expect(getMediaFitSettings({ mediaFit })).toBe(mediaFit);
  });
});

describe("isValidObjectFitValue", () => {
  it("accepts every supported value", () => {
    for (const value of ["fill", "contain", "cover", "none", "scale-down"]) {
      expect(isValidObjectFitValue(value)).toBe(true);
    }
  });

  it("rejects global CSS keywords and arbitrary strings", () => {
    for (const value of ["inherit", "initial", "unset", "revert", "revert-layer", "auto", "", 5, null, undefined, {}, []]) {
      expect(isValidObjectFitValue(value)).toBe(false);
    }
  });
});

describe("isValidObjectPositionAxis", () => {
  it("accepts a finite percentage, including negative and over-100 values", () => {
    expect(isValidObjectPositionAxis({ value: 50, unit: "%" })).toBe(true);
    expect(isValidObjectPositionAxis({ value: -20, unit: "%" })).toBe(true);
    expect(isValidObjectPositionAxis({ value: 120, unit: "%" })).toBe(true);
    expect(isValidObjectPositionAxis({ value: 37.5, unit: "%" })).toBe(true);
    expect(isValidObjectPositionAxis({ value: 0, unit: "%" })).toBe(true);
  });

  it("rejects NaN and Infinity", () => {
    expect(isValidObjectPositionAxis({ value: NaN, unit: "%" })).toBe(false);
    expect(isValidObjectPositionAxis({ value: Infinity, unit: "%" })).toBe(false);
    expect(isValidObjectPositionAxis({ value: -Infinity, unit: "%" })).toBe(false);
  });

  it("rejects an unsupported unit", () => {
    expect(isValidObjectPositionAxis({ value: 50, unit: "px" })).toBe(false);
    expect(isValidObjectPositionAxis({ value: 50, unit: "" })).toBe(false);
  });

  it("rejects malformed objects, raw strings, and arrays", () => {
    expect(isValidObjectPositionAxis("50%")).toBe(false);
    expect(isValidObjectPositionAxis(50)).toBe(false);
    expect(isValidObjectPositionAxis(null)).toBe(false);
    expect(isValidObjectPositionAxis(undefined)).toBe(false);
    expect(isValidObjectPositionAxis([50, "%"])).toBe(false);
    expect(isValidObjectPositionAxis({ value: "50", unit: "%" })).toBe(false);
    expect(isValidObjectPositionAxis({})).toBe(false);
  });
});

describe("detectObjectPositionPreset", () => {
  it("recognizes all nine exact grid positions", () => {
    expect(detectObjectPositionPreset(0, 0)).toBe("top-left");
    expect(detectObjectPositionPreset(50, 0)).toBe("top-center");
    expect(detectObjectPositionPreset(100, 0)).toBe("top-right");
    expect(detectObjectPositionPreset(0, 50)).toBe("center-left");
    expect(detectObjectPositionPreset(50, 50)).toBe("center");
    expect(detectObjectPositionPreset(100, 50)).toBe("center-right");
    expect(detectObjectPositionPreset(0, 100)).toBe("bottom-left");
    expect(detectObjectPositionPreset(50, 100)).toBe("bottom-center");
    expect(detectObjectPositionPreset(100, 100)).toBe("bottom-right");
  });

  it("returns undefined for a custom position matching no preset", () => {
    expect(detectObjectPositionPreset(37, 68)).toBeUndefined();
  });

  it("returns undefined for an out-of-range position, never false-matching a preset", () => {
    expect(detectObjectPositionPreset(-20, 120)).toBeUndefined();
  });

  it("does not treat a near-miss as a match (49/50 is not Center)", () => {
    expect(detectObjectPositionPreset(49, 50)).toBeUndefined();
  });
});

describe("withMediaFitField", () => {
  it("sets a field immutably, leaving the original object untouched", () => {
    const current = {};
    const next = withMediaFitField(current, "objectFit", "cover");
    expect(next).toEqual({ objectFit: "cover" });
    expect(current).toEqual({});
  });

  it("preserves unrelated fields when setting one field", () => {
    const current = { objectFit: "cover" as const, objectPositionX: { value: 10, unit: "%" as const } };
    const next = withMediaFitField(current, "objectPositionY", { value: 90, unit: "%" });
    expect(next).toEqual({ objectFit: "cover", objectPositionX: { value: 10, unit: "%" }, objectPositionY: { value: 90, unit: "%" } });
  });

  it("clearing a field with undefined removes exactly that key", () => {
    const current = { objectFit: "cover" as const, objectPositionX: { value: 10, unit: "%" as const } };
    const next = withMediaFitField(current, "objectFit", undefined);
    expect(next).toEqual({ objectPositionX: { value: 10, unit: "%" } });
    expect(next && "objectFit" in next).toBe(false);
  });

  it("collapses to undefined once the last field is cleared", () => {
    const current = { objectFit: "cover" as const };
    expect(withMediaFitField(current, "objectFit", undefined)).toBeUndefined();
  });
});

describe("withMediaFitPosition", () => {
  it("sets both axes in one write, preserving objectFit", () => {
    const current = { objectFit: "contain" as const };
    const next = withMediaFitPosition(current, { value: 0, unit: "%" }, { value: 100, unit: "%" });
    expect(next).toEqual({ objectFit: "contain", objectPositionX: { value: 0, unit: "%" }, objectPositionY: { value: 100, unit: "%" } });
  });
});

describe("clearMediaFitPosition", () => {
  it("removes both axes together, preserving objectFit", () => {
    const current = { objectFit: "cover" as const, objectPositionX: { value: 37, unit: "%" as const }, objectPositionY: { value: 68, unit: "%" as const } };
    const next = clearMediaFitPosition(current);
    expect(next).toEqual({ objectFit: "cover" });
  });

  it("collapses to undefined if nothing but position was set", () => {
    const current = { objectPositionX: { value: 37, unit: "%" as const }, objectPositionY: { value: 68, unit: "%" as const } };
    expect(clearMediaFitPosition(current)).toBeUndefined();
  });

  it("is a no-op shape-wise when no position was set", () => {
    const current = { objectFit: "fill" as const };
    expect(clearMediaFitPosition(current)).toEqual({ objectFit: "fill" });
  });
});

describe("structured metadata", () => {
  it("OBJECT_FIT_PRESETS covers exactly the five supported values with a label and description each", () => {
    expect(OBJECT_FIT_PRESETS).toHaveLength(5);
    for (const preset of OBJECT_FIT_PRESETS) {
      expect(preset.label.length).toBeGreaterThan(0);
      expect(preset.description.length).toBeGreaterThan(0);
    }
  });

  it("OBJECT_POSITION_PRESETS covers exactly the nine grid positions", () => {
    expect(OBJECT_POSITION_PRESETS).toHaveLength(9);
  });

  it("defaults match documented CSS/product behavior", () => {
    expect(DEFAULT_OBJECT_FIT).toBe("contain");
    expect(DEFAULT_OBJECT_POSITION_AXIS).toEqual({ value: 50, unit: "%" });
  });
});

import { describe, expect, it } from "vitest";
import { detectAspectRatioPreset, isValidAspectRatioValue, ASPECT_RATIO_PRESETS } from "./aspectRatio";

describe("aspect ratio model", () => {
  describe("isValidAspectRatioValue", () => {
    it("accepts explicit auto", () => {
      expect(isValidAspectRatioValue({ mode: "auto" })).toBe(true);
    });

    it("accepts every documented preset ratio", () => {
      expect(isValidAspectRatioValue({ mode: "ratio", width: 1, height: 1 })).toBe(true);
      expect(isValidAspectRatioValue({ mode: "ratio", width: 4, height: 3 })).toBe(true);
      expect(isValidAspectRatioValue({ mode: "ratio", width: 16, height: 9 })).toBe(true);
      expect(isValidAspectRatioValue({ mode: "ratio", width: 3, height: 4 })).toBe(true);
    });

    it("accepts an arbitrary custom ratio", () => {
      expect(isValidAspectRatioValue({ mode: "ratio", width: 3, height: 2 })).toBe(true);
    });

    it("accepts a decimal ratio", () => {
      expect(isValidAspectRatioValue({ mode: "ratio", width: 2.39, height: 1 })).toBe(true);
    });

    it("rejects a zero numerator", () => {
      expect(isValidAspectRatioValue({ mode: "ratio", width: 0, height: 1 })).toBe(false);
    });

    it("rejects a zero denominator", () => {
      expect(isValidAspectRatioValue({ mode: "ratio", width: 1, height: 0 })).toBe(false);
    });

    it("rejects 0:0", () => {
      expect(isValidAspectRatioValue({ mode: "ratio", width: 0, height: 0 })).toBe(false);
    });

    it("rejects a negative numerator", () => {
      expect(isValidAspectRatioValue({ mode: "ratio", width: -1, height: 1 })).toBe(false);
    });

    it("rejects a negative denominator", () => {
      expect(isValidAspectRatioValue({ mode: "ratio", width: 1, height: -1 })).toBe(false);
    });

    it("rejects NaN", () => {
      expect(isValidAspectRatioValue({ mode: "ratio", width: NaN, height: 1 })).toBe(false);
      expect(isValidAspectRatioValue({ mode: "ratio", width: 1, height: NaN })).toBe(false);
    });

    it("rejects Infinity", () => {
      expect(isValidAspectRatioValue({ mode: "ratio", width: Infinity, height: 1 })).toBe(false);
      expect(isValidAspectRatioValue({ mode: "ratio", width: 1, height: Infinity })).toBe(false);
    });

    it("rejects numeric strings", () => {
      expect(isValidAspectRatioValue({ mode: "ratio", width: "16", height: "9" })).toBe(false);
    });

    it("rejects a malformed object with an unknown mode", () => {
      expect(isValidAspectRatioValue({ mode: "weird", width: 1, height: 1 })).toBe(false);
    });

    it("rejects a missing mode", () => {
      expect(isValidAspectRatioValue({ width: 1, height: 1 })).toBe(false);
    });

    it("rejects arrays", () => {
      expect(isValidAspectRatioValue([1, 1])).toBe(false);
    });

    it("rejects null and primitives", () => {
      expect(isValidAspectRatioValue(null)).toBe(false);
      expect(isValidAspectRatioValue(undefined)).toBe(false);
      expect(isValidAspectRatioValue("16 / 9")).toBe(false);
      expect(isValidAspectRatioValue(1.7777777778)).toBe(false);
    });
  });

  describe("detectAspectRatioPreset", () => {
    it("recognizes auto", () => {
      expect(detectAspectRatioPreset({ mode: "auto" })).toBe("auto");
    });

    it("recognizes 1:1 as Square", () => {
      expect(detectAspectRatioPreset({ mode: "ratio", width: 1, height: 1 })).toBe("square");
    });

    it("recognizes 4:3 as Landscape", () => {
      expect(detectAspectRatioPreset({ mode: "ratio", width: 4, height: 3 })).toBe("landscape");
    });

    it("recognizes 16:9 as Widescreen", () => {
      expect(detectAspectRatioPreset({ mode: "ratio", width: 16, height: 9 })).toBe("widescreen");
    });

    it("recognizes 3:4 as Portrait", () => {
      expect(detectAspectRatioPreset({ mode: "ratio", width: 3, height: 4 })).toBe("portrait");
    });

    it("recognizes 8:6 as Landscape — mathematically equivalent to 4:3", () => {
      expect(detectAspectRatioPreset({ mode: "ratio", width: 8, height: 6 })).toBe("landscape");
    });

    it("recognizes 32:18 as Widescreen — mathematically equivalent to 16:9", () => {
      expect(detectAspectRatioPreset({ mode: "ratio", width: 32, height: 18 })).toBe("widescreen");
    });

    it("treats an arbitrary ratio (3:2) as custom", () => {
      expect(detectAspectRatioPreset({ mode: "ratio", width: 3, height: 2 })).toBe("custom");
    });

    it("treats a decimal ratio (2.39:1) as custom", () => {
      expect(detectAspectRatioPreset({ mode: "ratio", width: 2.39, height: 1 })).toBe("custom");
    });

    it("does not mutate the input value", () => {
      const value = { mode: "ratio" as const, width: 8, height: 6 };
      const snapshot = { ...value };
      detectAspectRatioPreset(value);
      expect(value).toEqual(snapshot);
    });
  });

  describe("ASPECT_RATIO_PRESETS", () => {
    it("defines exactly the six documented presets, each with a label and description", () => {
      const keys = ASPECT_RATIO_PRESETS.map((preset) => preset.key);
      expect(keys).toEqual(["auto", "square", "landscape", "widescreen", "portrait", "custom"]);
      for (const preset of ASPECT_RATIO_PRESETS) {
        expect(preset.label.length).toBeGreaterThan(0);
        expect(preset.description.length).toBeGreaterThan(0);
      }
    });

    it("gives every named preset except custom a canonical value", () => {
      for (const preset of ASPECT_RATIO_PRESETS) {
        if (preset.key === "custom") {
          expect(preset.value).toBeNull();
        } else {
          expect(preset.value).not.toBeNull();
        }
      }
    });
  });
});

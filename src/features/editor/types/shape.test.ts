import { describe, expect, it } from "vitest";
import {
  getClipPathForShapePreset,
  getShapePreset,
  getShapePresetDefinition,
  isValidShapePreset,
  SHAPE_PRESET_IDS,
  SHAPE_PRESETS,
  type ShapePreset,
} from "./shape";

describe("shape presets", () => {
  it("every preset has a non-empty label and a unique id", () => {
    const seen = new Set<string>();
    for (const preset of SHAPE_PRESETS) {
      expect(preset.label.length).toBeGreaterThan(0);
      expect(seen.has(preset.id)).toBe(false);
      seen.add(preset.id);
    }
    expect(seen.size).toBe(SHAPE_PRESETS.length);
  });

  it("Rectangle (\"none\") maps to no clip-path at all", () => {
    expect(getClipPathForShapePreset("none")).toBeUndefined();
  });

  it("every non-rectangle preset maps to a real, non-empty clip-path value", () => {
    for (const preset of SHAPE_PRESETS) {
      if (preset.id === "none") continue;
      expect(preset.clipPath).toBeTruthy();
      expect(preset.clipPath).toMatch(/^(circle|ellipse|polygon)\(/);
    }
  });

  it("SHAPE_PRESET_IDS matches SHAPE_PRESETS exactly, in order", () => {
    expect(SHAPE_PRESET_IDS).toEqual(SHAPE_PRESETS.map((preset) => preset.id));
  });

  it("getShapePresetDefinition resolves every listed id", () => {
    for (const id of SHAPE_PRESET_IDS) {
      expect(getShapePresetDefinition(id).id).toBe(id);
    }
  });

  it("isValidShapePreset accepts every listed id and rejects garbage", () => {
    for (const id of SHAPE_PRESET_IDS) {
      expect(isValidShapePreset(id)).toBe(true);
    }
    expect(isValidShapePreset("not-a-shape")).toBe(false);
    expect(isValidShapePreset(undefined)).toBe(false);
    expect(isValidShapePreset(42)).toBe(false);
  });

  describe("getShapePreset", () => {
    it("resolves an unset field to \"none\"", () => {
      expect(getShapePreset({})).toBe("none");
    });

    it("resolves an explicit valid preset", () => {
      expect(getShapePreset({ shape: "hexagon" })).toBe("hexagon");
    });

    it("resolves malformed/unrecognized loaded data to \"none\" rather than throwing", () => {
      const node = { shape: "not-a-real-shape" } as unknown as { shape?: ShapePreset };
      expect(getShapePreset(node)).toBe("none");
    });
  });
});

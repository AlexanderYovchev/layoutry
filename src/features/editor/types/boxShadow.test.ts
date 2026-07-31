import { describe, expect, it } from "vitest";
import {
  addShadowLayer,
  applyShadowPreset,
  createDefaultShadowLayer,
  duplicateShadowLayer,
  formatShadowLayerCss,
  generateShadowLayerId,
  getBoxShadowLayers,
  isValidShadowBlurValue,
  isValidShadowLayer,
  isValidShadowOffsetValue,
  isValidShadowSpreadValue,
  normalizeBoxShadowSettings,
  removeShadowLayer,
  reorderShadowLayer,
  updateShadowLayer,
  MAX_SHADOW_LAYERS,
  SHADOW_PRESETS,
  type ShadowLayer,
} from "./boxShadow";

function layer(overrides: Partial<ShadowLayer> = {}): ShadowLayer {
  return { id: generateShadowLayerId(), enabled: true, inset: false, ...overrides };
}

describe("generateShadowLayerId", () => {
  it("produces unique, shadow-prefixed ids", () => {
    const a = generateShadowLayerId();
    const b = generateShadowLayerId();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^shadow-/);
  });
});

describe("getBoxShadowLayers", () => {
  it("returns an empty array for a node with no shadow set", () => {
    expect(getBoxShadowLayers({})).toEqual([]);
  });

  it("returns the stored layers verbatim", () => {
    const layers = [layer()];
    expect(getBoxShadowLayers({ boxShadow: layers })).toBe(layers);
  });
});

describe("normalizeBoxShadowSettings", () => {
  it("collapses an empty list to undefined", () => {
    expect(normalizeBoxShadowSettings([])).toBeUndefined();
  });

  it("returns a non-empty list verbatim", () => {
    const layers = [layer()];
    expect(normalizeBoxShadowSettings(layers)).toBe(layers);
  });
});

describe("createDefaultShadowLayer", () => {
  it("creates a fully-configured, enabled, non-inset layer with a fresh id", () => {
    const a = createDefaultShadowLayer();
    const b = createDefaultShadowLayer();
    expect(a.id).not.toBe(b.id);
    expect(a.enabled).toBe(true);
    expect(a.inset).toBe(false);
    expect(a.offsetX).toEqual({ value: 0, unit: "px" });
    expect(a.offsetY).toEqual({ value: 4, unit: "px" });
    expect(a.blur).toEqual({ value: 8, unit: "px" });
    expect(a.spread).toEqual({ value: 0, unit: "px" });
    expect(a.color).toBe("rgba(0, 0, 0, 0.25)");
  });
});

describe("addShadowLayer", () => {
  it("appends a layer", () => {
    const first = layer();
    const second = layer();
    expect(addShadowLayer([first], second)).toEqual([first, second]);
  });

  it("no-ops once MAX_SHADOW_LAYERS is reached", () => {
    const layers = Array.from({ length: MAX_SHADOW_LAYERS }, () => layer());
    expect(addShadowLayer(layers, layer())).toBe(layers);
  });
});

describe("removeShadowLayer", () => {
  it("removes a layer by id", () => {
    const a = layer();
    const b = layer();
    expect(removeShadowLayer([a, b], a.id)).toEqual([b]);
  });

  it("is a no-op (same reference) if the id doesn't exist", () => {
    const layers = [layer()];
    expect(removeShadowLayer(layers, "does-not-exist")).toBe(layers);
  });

  it("can remove down to zero layers", () => {
    const a = layer();
    expect(removeShadowLayer([a], a.id)).toEqual([]);
  });
});

describe("duplicateShadowLayer", () => {
  it("inserts a copy with a fresh id directly after the original", () => {
    const a = layer({ color: "#ff0000" });
    const b = layer({ color: "#00ff00" });
    const result = duplicateShadowLayer([a, b], a.id);

    expect(result).toHaveLength(3);
    expect(result[0]).toBe(a);
    expect(result[1].id).not.toBe(a.id);
    expect(result[1].color).toBe("#ff0000");
    expect(result[2]).toBe(b);
  });

  it("is a no-op (same reference) if the id doesn't exist", () => {
    const layers = [layer()];
    expect(duplicateShadowLayer(layers, "does-not-exist")).toBe(layers);
  });

  it("no-ops once MAX_SHADOW_LAYERS is reached", () => {
    const layers = Array.from({ length: MAX_SHADOW_LAYERS }, () => layer());
    expect(duplicateShadowLayer(layers, layers[0].id)).toBe(layers);
  });
});

describe("reorderShadowLayer", () => {
  it("moves a layer to a later index", () => {
    const a = layer();
    const b = layer();
    const c = layer();
    expect(reorderShadowLayer([a, b, c], a.id, 2)).toEqual([b, c, a]);
  });

  it("moves a layer to an earlier index", () => {
    const a = layer();
    const b = layer();
    const c = layer();
    expect(reorderShadowLayer([a, b, c], c.id, 0)).toEqual([c, a, b]);
  });

  it("clamps an out-of-range target index", () => {
    const a = layer();
    const b = layer();
    expect(reorderShadowLayer([a, b], a.id, 99)).toEqual([b, a]);
  });

  it("is a no-op (same reference) if the target index equals the current index", () => {
    const layers = [layer(), layer()];
    expect(reorderShadowLayer(layers, layers[0].id, 0)).toBe(layers);
  });

  it("is a no-op (same reference) if the id doesn't exist", () => {
    const layers = [layer()];
    expect(reorderShadowLayer(layers, "does-not-exist", 0)).toBe(layers);
  });
});

describe("updateShadowLayer", () => {
  it("patches a single field on the matching layer, leaving others untouched", () => {
    const a = layer({ color: "#000000" });
    const b = layer({ color: "#ffffff" });
    const result = updateShadowLayer([a, b], a.id, { color: "#3366ff" });

    expect(result[0].color).toBe("#3366ff");
    expect(result[1]).toBe(b);
  });

  it("clears a field entirely when the patch sets it to undefined", () => {
    const a = layer({ color: "#000000" });
    const result = updateShadowLayer([a], a.id, { color: undefined });
    expect(result[0].color).toBeUndefined();
  });

  it("clears multiple fields in one patch (Reset Geometry)", () => {
    const a = layer({
      offsetX: { value: 1, unit: "px" },
      offsetY: { value: 2, unit: "px" },
      blur: { value: 3, unit: "px" },
      spread: { value: 4, unit: "px" },
    });
    const result = updateShadowLayer([a], a.id, {
      offsetX: undefined,
      offsetY: undefined,
      blur: undefined,
      spread: undefined,
    });
    expect(result[0].offsetX).toBeUndefined();
    expect(result[0].offsetY).toBeUndefined();
    expect(result[0].blur).toBeUndefined();
    expect(result[0].spread).toBeUndefined();
  });

  it("is a no-op (same reference) if the id doesn't exist", () => {
    const layers = [layer()];
    expect(updateShadowLayer(layers, "does-not-exist", { color: "#000000" })).toBe(layers);
  });
});

describe("isValidShadowOffsetValue / isValidShadowSpreadValue", () => {
  it("accept any finite number, including negative", () => {
    expect(isValidShadowOffsetValue(-10)).toBe(true);
    expect(isValidShadowOffsetValue(0)).toBe(true);
    expect(isValidShadowSpreadValue(-5)).toBe(true);
  });

  it("reject non-finite input", () => {
    expect(isValidShadowOffsetValue(Number.NaN)).toBe(false);
    expect(isValidShadowOffsetValue(Number.POSITIVE_INFINITY)).toBe(false);
  });
});

describe("isValidShadowBlurValue", () => {
  it("accepts zero and positive values", () => {
    expect(isValidShadowBlurValue(0)).toBe(true);
    expect(isValidShadowBlurValue(12)).toBe(true);
  });

  it("rejects a negative value", () => {
    expect(isValidShadowBlurValue(-1)).toBe(false);
  });
});

describe("isValidShadowLayer", () => {
  it("accepts a well-formed layer with every optional field present", () => {
    expect(isValidShadowLayer(createDefaultShadowLayer())).toBe(true);
  });

  it("accepts a well-formed layer with every optional field absent", () => {
    expect(isValidShadowLayer({ id: "shadow-1", enabled: true, inset: false })).toBe(true);
  });

  it("rejects a non-object value", () => {
    expect(isValidShadowLayer(null)).toBe(false);
    expect(isValidShadowLayer("shadow")).toBe(false);
  });

  it("rejects a missing or empty id", () => {
    expect(isValidShadowLayer({ id: "", enabled: true, inset: false })).toBe(false);
    expect(isValidShadowLayer({ enabled: true, inset: false })).toBe(false);
  });

  it("rejects a non-boolean enabled/inset", () => {
    expect(isValidShadowLayer({ id: "shadow-1", enabled: "yes", inset: false })).toBe(false);
    expect(isValidShadowLayer({ id: "shadow-1", enabled: true, inset: "no" })).toBe(false);
  });

  it("rejects a negative blur", () => {
    expect(
      isValidShadowLayer({ id: "shadow-1", enabled: true, inset: false, blur: { value: -1, unit: "px" } }),
    ).toBe(false);
  });

  it("accepts a negative offset/spread", () => {
    expect(
      isValidShadowLayer({
        id: "shadow-1",
        enabled: true,
        inset: false,
        offsetX: { value: -10, unit: "px" },
        spread: { value: -4, unit: "px" },
      }),
    ).toBe(true);
  });

  it("rejects an invalid color string", () => {
    expect(isValidShadowLayer({ id: "shadow-1", enabled: true, inset: false, color: "not-a-color" })).toBe(false);
  });
});

describe("formatShadowLayerCss", () => {
  it("renders every geometry field and the color, space-separated", () => {
    const layerValue = layer({
      offsetX: { value: 2, unit: "px" },
      offsetY: { value: 4, unit: "px" },
      blur: { value: 8, unit: "px" },
      spread: { value: 1, unit: "px" },
      color: "#3366ff",
    });
    expect(formatShadowLayerCss(layerValue)).toBe("2px 4px 8px 1px #3366ff");
  });

  it("prefixes 'inset' for an inset layer", () => {
    const layerValue = layer({ inset: true, offsetX: { value: 0, unit: "px" }, offsetY: { value: 2, unit: "px" } });
    expect(formatShadowLayerCss(layerValue)).toBe("inset 0px 2px 0px 0px currentcolor");
  });

  it("falls back to CSS's own initial 0/currentcolor for every unset field", () => {
    expect(formatShadowLayerCss(layer())).toBe("0px 0px 0px 0px currentcolor");
  });
});

describe("applyShadowPreset", () => {
  it("returns a single, fully-configured layer with a fresh id for every preset", () => {
    for (const { preset } of SHADOW_PRESETS) {
      const result = applyShadowPreset(preset);
      expect(result).toHaveLength(1);
      expect(result[0].id).toMatch(/^shadow-/);
      expect(result[0].enabled).toBe(true);
    }
  });

  it("produces an inset layer for the 'inner' preset only", () => {
    expect(applyShadowPreset("inner")[0].inset).toBe(true);
    expect(applyShadowPreset("small")[0].inset).toBe(false);
  });

  it("gives the 'floatingCard' preset a negative spread", () => {
    const result = applyShadowPreset("floatingCard")[0];
    expect(result.spread?.value).toBeLessThan(0);
  });

  it("returns a fresh id on every call, never reusing a prior preset's layer", () => {
    const first = applyShadowPreset("medium")[0];
    const second = applyShadowPreset("medium")[0];
    expect(first.id).not.toBe(second.id);
  });
});

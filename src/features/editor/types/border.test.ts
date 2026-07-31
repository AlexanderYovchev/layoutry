import { describe, expect, it } from "vitest";
import {
  applyBorderPreset,
  borderSidesEqual,
  getBorderSettings,
  getBorderSide,
  isValidBorderSideSettings,
  isValidBorderStyleValue,
  isValidBorderWidthValue,
  withBorderAllSidesField,
  withBorderSide,
  withBorderSideField,
  type BorderSettings,
} from "./border";

describe("getBorderSettings", () => {
  it("returns an empty object for a node with no border", () => {
    expect(getBorderSettings({})).toEqual({});
  });

  it("returns the node's stored border verbatim", () => {
    const border: BorderSettings = { top: { color: "#ff0000" } };
    expect(getBorderSettings({ border })).toBe(border);
  });
});

describe("getBorderSide", () => {
  it("returns an empty object for an unset side", () => {
    expect(getBorderSide({}, "top")).toEqual({});
  });

  it("returns the side's own settings when set", () => {
    const border: BorderSettings = { left: { style: "dashed" } };
    expect(getBorderSide(border, "left")).toEqual({ style: "dashed" });
  });
});

describe("borderSidesEqual", () => {
  it("is true when every side is unset", () => {
    expect(borderSidesEqual({})).toBe(true);
  });

  it("is true when all four sides hold identical settings", () => {
    const side = { width: { value: 2, unit: "px" as const }, style: "solid" as const, color: "#000" };
    expect(borderSidesEqual({ top: side, right: side, bottom: side, left: side })).toBe(true);
  });

  it("is false when one side differs", () => {
    const side = { width: { value: 2, unit: "px" as const }, style: "solid" as const };
    expect(borderSidesEqual({ top: side, right: side, bottom: side, left: { ...side, style: "dashed" } })).toBe(false);
  });
});

describe("withBorderSideField", () => {
  it("sets a field on an empty side", () => {
    expect(withBorderSideField({}, "style", "solid")).toEqual({ style: "solid" });
  });

  it("clears a field via undefined, collapsing to undefined once empty", () => {
    expect(withBorderSideField({ style: "solid" }, "style", undefined)).toBeUndefined();
  });

  it("leaves other fields on the side untouched", () => {
    expect(withBorderSideField({ style: "solid", color: "#fff" }, "color", "#000")).toEqual({
      style: "solid",
      color: "#000",
    });
  });
});

describe("withBorderSide", () => {
  it("sets one side while leaving the others untouched", () => {
    const border: BorderSettings = { top: { style: "solid" } };
    expect(withBorderSide(border, "left", { style: "dashed" })).toEqual({
      top: { style: "solid" },
      left: { style: "dashed" },
    });
  });

  it("clears one side, collapsing the whole object to undefined once every side is empty", () => {
    const border: BorderSettings = { top: { style: "solid" } };
    expect(withBorderSide(border, "top", undefined)).toBeUndefined();
  });

  it("clearing one side preserves the others", () => {
    const border: BorderSettings = { top: { style: "solid" }, left: { style: "dashed" } };
    expect(withBorderSide(border, "top", undefined)).toEqual({ left: { style: "dashed" } });
  });
});

describe("withBorderAllSidesField", () => {
  it("writes the field to all four sides in one call", () => {
    const next = withBorderAllSidesField({}, "style", "dotted");
    expect(next).toEqual({
      top: { style: "dotted" },
      right: { style: "dotted" },
      bottom: { style: "dotted" },
      left: { style: "dotted" },
    });
  });

  it("preserves each side's own other fields", () => {
    const border: BorderSettings = { top: { color: "#111" }, right: { color: "#222" } };
    const next = withBorderAllSidesField(border, "style", "solid");
    expect(next).toEqual({
      top: { color: "#111", style: "solid" },
      right: { color: "#222", style: "solid" },
      bottom: { style: "solid" },
      left: { style: "solid" },
    });
  });

  it("collapses to undefined when clearing the only field every side had", () => {
    const border: BorderSettings = {
      top: { style: "solid" },
      right: { style: "solid" },
      bottom: { style: "solid" },
      left: { style: "solid" },
    };
    expect(withBorderAllSidesField(border, "style", undefined)).toBeUndefined();
  });
});

describe("applyBorderPreset", () => {
  it("'none' clears the border entirely", () => {
    expect(applyBorderPreset({ top: { style: "solid" } }, "none")).toBeUndefined();
  });

  it("'thin' applies 1px solid to every side", () => {
    const next = applyBorderPreset({}, "thin");
    for (const side of ["top", "right", "bottom", "left"] as const) {
      expect(next?.[side]).toEqual({ width: { value: 1, unit: "px" }, style: "solid" });
    }
  });

  it("'outline' applies 2px dashed to every side", () => {
    const next = applyBorderPreset({}, "outline");
    expect(next?.top).toEqual({ width: { value: 2, unit: "px" }, style: "dashed" });
  });

  it("preserves each side's existing color", () => {
    const border: BorderSettings = { top: { color: "#3366ff" } };
    const next = applyBorderPreset(border, "medium");
    expect(next?.top).toEqual({ color: "#3366ff", width: { value: 2, unit: "px" }, style: "solid" });
    expect(next?.right).toEqual({ width: { value: 2, unit: "px" }, style: "solid" });
  });
});

describe("isValidBorderWidthValue", () => {
  it("accepts zero and positive finite numbers", () => {
    expect(isValidBorderWidthValue(0)).toBe(true);
    expect(isValidBorderWidthValue(4)).toBe(true);
  });

  it("rejects negative, NaN, and Infinity", () => {
    expect(isValidBorderWidthValue(-1)).toBe(false);
    expect(isValidBorderWidthValue(NaN)).toBe(false);
    expect(isValidBorderWidthValue(Infinity)).toBe(false);
  });
});

describe("isValidBorderStyleValue", () => {
  it("accepts every supported style", () => {
    for (const style of ["none", "solid", "dashed", "dotted", "double", "groove", "ridge", "inset", "outset"]) {
      expect(isValidBorderStyleValue(style)).toBe(true);
    }
  });

  it("rejects an unsupported string", () => {
    expect(isValidBorderStyleValue("wavy")).toBe(false);
  });
});

describe("isValidBorderSideSettings", () => {
  it("accepts an empty object", () => {
    expect(isValidBorderSideSettings({})).toBe(true);
  });

  it("accepts a fully valid side", () => {
    expect(isValidBorderSideSettings({ width: { value: 2, unit: "px" }, style: "solid", color: "#fff" })).toBe(true);
  });

  it("rejects a non-object", () => {
    expect(isValidBorderSideSettings("solid")).toBe(false);
    expect(isValidBorderSideSettings(null)).toBe(false);
  });

  it("rejects a malformed width (negative value)", () => {
    expect(isValidBorderSideSettings({ width: { value: -2, unit: "px" } })).toBe(false);
  });

  it("rejects a malformed width (missing unit)", () => {
    expect(isValidBorderSideSettings({ width: { value: 2 } })).toBe(false);
  });

  it("rejects an unsupported style keyword", () => {
    expect(isValidBorderSideSettings({ style: "wavy" })).toBe(false);
  });

  it("rejects an invalid color string", () => {
    expect(isValidBorderSideSettings({ color: "not-a-color" })).toBe(false);
  });
});

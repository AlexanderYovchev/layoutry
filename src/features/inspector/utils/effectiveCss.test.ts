import { describe, expect, it } from "vitest";
import {
  absoluteAuthoredColor,
  colorFieldValue,
  commonAuthored,
  effectiveRowState,
  effectiveValueOf,
  normalizeCssColor,
  normalizeCssPx,
  normalizeCssValue,
  pxFieldValue,
  resolveSharedEffective,
  type MeasuredStyles,
} from "./effectiveCss";

/** BC-10.3 — effective-value normalization and Mixed/Unresolved aggregation. */

describe("normalization", () => {
  it.each([
    ["#f00", "rgba(255, 0, 0, 1)"],
    ["#FF0000", "rgba(255, 0, 0, 1)"],
    ["#ff000080", "rgba(255, 0, 0, 0.502)"],
    ["rgb(255, 0, 0)", "rgba(255, 0, 0, 1)"],
    ["rgb(255 0 0 / 50%)", "rgba(255, 0, 0, 0.5)"],
    ["rgba(255,0,0,.5)", "rgba(255, 0, 0, 0.5)"],
    ["rgb(100%, 0%, 0%)", "rgba(255, 0, 0, 1)"],
    ["transparent", "rgba(0, 0, 0, 0)"],
  ])("colour %s → %s", (input, output) => {
    expect(normalizeCssColor(input)).toBe(output);
  });

  it("never guesses a colour it can't read context-free", () => {
    for (const value of ["red", "hsl(0 100% 50%)", "oklch(0.6 0.2 30)", "currentColor", "color-mix(in srgb, red, blue)", "#ff000"]) {
      expect(normalizeCssColor(value)).toBeUndefined();
    }
    // Compared exactly as text instead (a named colour equals itself only).
    expect(normalizeCssValue("Red", "color")).toBe("red");
  });

  it("px lengths lose insignificant digits; other units are left alone (1em is not 16px)", () => {
    expect(normalizeCssPx("16px")).toBe("16px");
    expect(normalizeCssPx("16.00px")).toBe("16px");
    expect(normalizeCssPx("22.5px")).toBe("22.5px");
    expect(normalizeCssPx("16.004px")).toBe("16px");
    expect(normalizeCssPx("1em")).toBeUndefined();
    expect(normalizeCssValue("50%", "length")).toBe("50%");
    expect(normalizeCssValue("1em", "length")).toBe("1em");
  });

  it("numbers and keywords", () => {
    expect(normalizeCssValue("700", "number")).toBe("700");
    expect(normalizeCssValue("700.0", "number")).toBe("700");
    expect(normalizeCssValue(" Inline-Block ", "keyword")).toBe("inline-block");
  });

  it("authored colours that depend on context are not absolute", () => {
    expect(absoluteAuthoredColor("#123456")).toBe("#123456");
    expect(absoluteAuthoredColor("red")).toBe("red");
    for (const value of ["currentColor", "inherit", "unset", "revert", "var(--brand)", "", undefined]) expect(absoluteAuthoredColor(value)).toBeUndefined();
  });
});

describe("one element's effective value", () => {
  const FONT_SIZE = { cssProperties: ["font-size"], kind: "length" } as const;
  const CORNERS = { cssProperties: ["a", "b", "c", "d"], kind: "length" } as const;
  const measured: MeasuredStyles = new Map<string, Record<string, string>>([
    ["h1", { "font-size": "32px" }],
    ["p", { "font-size": "16.00px" }],
    ["round", { a: "6px", b: "6px", c: "6px", d: "6px" }],
    ["uneven", { a: "6px", b: "0px", c: "6px", d: "6px" }],
    ["blank", { "font-size": "" }],
  ]);

  it("prefers the measured value, normalized", () => {
    expect(effectiveValueOf("h1", FONT_SIZE, measured, () => ["16px"])).toBe("32px");
    expect(effectiveValueOf("p", FONT_SIZE, measured, () => undefined)).toBe("16px");
  });

  it("falls back to an authored absolute value only when the element can't be measured", () => {
    expect(effectiveValueOf("missing", FONT_SIZE, measured, () => ["20px"])).toBe("20px");
    expect(effectiveValueOf("blank", FONT_SIZE, measured, () => ["20px"])).toBe("20px");
    expect(effectiveValueOf("missing", FONT_SIZE, null, () => ["20px"])).toBe("20px");
  });

  it("is unknown when neither works: never a default", () => {
    expect(effectiveValueOf("missing", FONT_SIZE, measured, () => undefined)).toBeUndefined();
    expect(effectiveValueOf("missing", FONT_SIZE, null, () => undefined)).toBeUndefined();
  });

  it("several properties: equal sides give one value, unequal sides a sides token", () => {
    expect(effectiveValueOf("round", CORNERS, measured, () => undefined)).toBe("6px");
    expect(effectiveValueOf("uneven", CORNERS, measured, () => undefined)).toBe("sides:6px|0px|6px|6px");
  });
});

describe("aggregation across the selection", () => {
  it("same, mixed, unresolved and same-other", () => {
    expect(resolveSharedEffective(["16px", "16px"], pxFieldValue)).toEqual({ kind: "same", value: 16 });
    expect(resolveSharedEffective(["32px", "16px"], pxFieldValue)).toEqual({ kind: "mixed" });
    expect(resolveSharedEffective(["16px", undefined], pxFieldValue)).toEqual({ kind: "unresolved" });
    expect(resolveSharedEffective([undefined, undefined], pxFieldValue)).toEqual({ kind: "unresolved" });
    expect(resolveSharedEffective(["50%", "50%"], pxFieldValue)).toEqual({ kind: "same-other", label: "50%" });
    expect(resolveSharedEffective(["sides:1px|0px|1px|0px", "sides:1px|0px|1px|0px"], pxFieldValue)).toEqual({ kind: "same-other", label: "Varies by side" });
  });

  it("known differences win over unknown ones: Mixed is still the truth", () => {
    expect(resolveSharedEffective(["32px", undefined, "16px"], pxFieldValue)).toEqual({ kind: "mixed" });
  });

  it("50% and 50px are different", () => {
    expect(resolveSharedEffective(["50%", "50px"], pxFieldValue)).toEqual({ kind: "mixed" });
  });

  it("field formatting", () => {
    expect(colorFieldValue("rgba(24, 24, 27, 1)")).toBe("#18181b");
    expect(colorFieldValue("rgba(24, 24, 27, 0.5)")).toBe("rgba(24, 24, 27, 0.5)");
    expect(colorFieldValue("oklch(0.6 0.2 30)")).toBe("oklch(0.6 0.2 30)");
    expect(pxFieldValue("22.5px")).toBe(22.5);
    expect(pxFieldValue("auto")).toBeUndefined();
    expect(commonAuthored(["#f00", "#f00"])).toBe("#f00");
    expect(commonAuthored(["#f00", undefined])).toBeUndefined();
  });

  it("row state: mixed by effective values, otherwise set/unset by authored data", () => {
    expect(effectiveRowState({ kind: "mixed" }, false)).toBe("mixed");
    expect(effectiveRowState({ kind: "same", value: 16 }, false)).toBe("unset");
    expect(effectiveRowState({ kind: "unresolved" }, true)).toBe("set");
    expect(effectiveRowState({ kind: "same", value: 16 }, true, "bad")).toBe("invalid");
  });
});

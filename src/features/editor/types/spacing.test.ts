import { describe, expect, it } from "vitest";
import { clampEdgeValues, clampSpacingValue, getElementSpacing } from "@/features/editor/types/spacing";

describe("clampSpacingValue", () => {
  it("passes through a value already within range", () => {
    expect(clampSpacingValue(24)).toBe(24);
  });

  it("floors at 0", () => {
    expect(clampSpacingValue(-10)).toBe(0);
  });

  it("ceilings at 500", () => {
    expect(clampSpacingValue(9999)).toBe(500);
  });

  it("rejects NaN", () => {
    expect(clampSpacingValue(NaN)).toBeNull();
  });

  it("rejects Infinity", () => {
    expect(clampSpacingValue(Infinity)).toBeNull();
  });
});

describe("clampEdgeValues", () => {
  it("clamps every side independently", () => {
    expect(clampEdgeValues({ top: -5, right: 24, bottom: 9999, left: 0 })).toEqual({
      top: 0,
      right: 24,
      bottom: 500,
      left: 0,
    });
  });

  it("rejects the whole update if any single side is invalid (atomic)", () => {
    expect(clampEdgeValues({ top: 10, right: NaN, bottom: 10, left: 10 })).toBeNull();
  });
});

describe("getElementSpacing", () => {
  it("returns zero margin/padding when unset", () => {
    expect(getElementSpacing({})).toEqual({
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
    });
  });

  it("returns the node's own spacing when set", () => {
    const spacing = {
      margin: { top: 1, right: 2, bottom: 3, left: 4 },
      padding: { top: 5, right: 6, bottom: 7, left: 8 },
    };
    expect(getElementSpacing({ spacing })).toBe(spacing);
  });
});

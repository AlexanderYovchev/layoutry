import { describe, expect, it } from "vitest";
import { getSizeConstraints, isValidSizeConstraintValue, withSizeConstraintField } from "./sizeConstraints";

describe("getSizeConstraints", () => {
  it("returns an empty object when sizeConstraints is unset — no synthesized default", () => {
    expect(getSizeConstraints({})).toEqual({});
  });

  it("returns the node's own explicit constraints when set", () => {
    const sizeConstraints = { minWidth: 100 };
    expect(getSizeConstraints({ sizeConstraints })).toBe(sizeConstraints);
  });
});

describe("isValidSizeConstraintValue", () => {
  it("accepts a finite non-negative number, including zero", () => {
    expect(isValidSizeConstraintValue(0)).toBe(true);
    expect(isValidSizeConstraintValue(100)).toBe(true);
    expect(isValidSizeConstraintValue(37.5)).toBe(true);
  });

  it("rejects negative numbers", () => {
    expect(isValidSizeConstraintValue(-1)).toBe(false);
  });

  it("rejects NaN and Infinity", () => {
    expect(isValidSizeConstraintValue(NaN)).toBe(false);
    expect(isValidSizeConstraintValue(Infinity)).toBe(false);
    expect(isValidSizeConstraintValue(-Infinity)).toBe(false);
  });

  it("rejects non-number values", () => {
    expect(isValidSizeConstraintValue("100")).toBe(false);
    expect(isValidSizeConstraintValue(null)).toBe(false);
    expect(isValidSizeConstraintValue(undefined)).toBe(false);
    expect(isValidSizeConstraintValue({})).toBe(false);
  });
});

describe("withSizeConstraintField", () => {
  it("sets a field immutably", () => {
    const current = {};
    const next = withSizeConstraintField(current, "minWidth", 100);
    expect(next).toEqual({ minWidth: 100 });
    expect(current).toEqual({});
  });

  it("preserves unrelated fields when setting one field", () => {
    const current = { minWidth: 100, maxWidth: 400 };
    const next = withSizeConstraintField(current, "minHeight", 50);
    expect(next).toEqual({ minWidth: 100, maxWidth: 400, minHeight: 50 });
  });

  it("clearing a field with undefined removes exactly that key", () => {
    const current = { minWidth: 100, maxWidth: 400 };
    const next = withSizeConstraintField(current, "minWidth", undefined);
    expect(next).toEqual({ maxWidth: 400 });
    expect(next && "minWidth" in next).toBe(false);
  });

  it("collapses to undefined once the last field is cleared", () => {
    const current = { maxHeight: 300 };
    expect(withSizeConstraintField(current, "maxHeight", undefined)).toBeUndefined();
  });

  it("does not enforce any relationship between min and max — both can be set to any independent value", () => {
    const current = {};
    const withMin = withSizeConstraintField(current, "minWidth", 500);
    const withBoth = withSizeConstraintField(withMin!, "maxWidth", 100);
    expect(withBoth).toEqual({ minWidth: 500, maxWidth: 100 });
  });
});

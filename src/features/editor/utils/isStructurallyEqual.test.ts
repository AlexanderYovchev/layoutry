import { describe, expect, it } from "vitest";
import { isStructurallyEqual } from "./isStructurallyEqual";

describe("isStructurallyEqual", () => {
  it("compares primitives, arrays and nested objects by value", () => {
    expect(isStructurallyEqual(1, 1)).toBe(true);
    expect(isStructurallyEqual("a", "b")).toBe(false);
    expect(isStructurallyEqual([1, { a: [2] }], [1, { a: [2] }])).toBe(true);
    expect(isStructurallyEqual([1, 2], [1, 2, 3])).toBe(false);
    expect(isStructurallyEqual({ a: { b: 1 } }, { a: { b: 2 } })).toBe(false);
  });

  it("ignores key order and treats an undefined-valued key as absent, the way the document serializes", () => {
    expect(isStructurallyEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(isStructurallyEqual({ id: "x", typography: undefined }, { id: "x" })).toBe(true);
    expect(isStructurallyEqual({ id: "x", typography: {} }, { id: "x" })).toBe(false);
  });

  it("does not confuse arrays with objects, or null with an object", () => {
    expect(isStructurallyEqual([], {})).toBe(false);
    expect(isStructurallyEqual(null, {})).toBe(false);
    expect(isStructurallyEqual(null, null)).toBe(true);
  });
});

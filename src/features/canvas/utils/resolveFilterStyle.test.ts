import { describe, expect, it } from "vitest";
import { resolveFilterStyle } from "./resolveFilterStyle";
import type { EditorElementNode } from "@/features/editor/types/document";

describe("resolveFilterStyle", () => {
  it("returns an empty style object for a node with no filters set", () => {
    const node: EditorElementNode = { id: "n1", tag: "div" };
    expect(resolveFilterStyle(node)).toEqual({});
  });

  it("resolves opacity via the standalone CSS property, converting 0-100 to 0-1", () => {
    const node: EditorElementNode = { id: "n1", tag: "div", filters: { opacity: 50 } };
    expect(resolveFilterStyle(node)).toEqual({ opacity: 0.5 });
  });

  it("never emits filter: opacity() — opacity is excluded from the filter function list", () => {
    const node: EditorElementNode = { id: "n1", tag: "div", filters: { opacity: 50 } };
    expect(resolveFilterStyle(node).filter).toBeUndefined();
  });

  it("resolves blur as a filter function with its own unit", () => {
    const node: EditorElementNode = { id: "n1", tag: "div", filters: { blur: { value: 8, unit: "px" } } };
    expect(resolveFilterStyle(node)).toEqual({ filter: "blur(8px)" });
  });

  it("resolves every percentage-based filter function with a % suffix", () => {
    const node: EditorElementNode = {
      id: "n1",
      tag: "div",
      filters: { brightness: 150, contrast: 120, grayscale: 100, invert: 50, saturate: 200, sepia: 30 },
    };
    expect(resolveFilterStyle(node).filter).toBe(
      "brightness(150%) contrast(120%) grayscale(100%) invert(50%) saturate(200%) sepia(30%)",
    );
  });

  it("resolves hue-rotate with a deg suffix", () => {
    const node: EditorElementNode = { id: "n1", tag: "div", filters: { hueRotate: 90 } };
    expect(resolveFilterStyle(node).filter).toBe("hue-rotate(90deg)");
  });

  it("combines multiple filters in one fixed, stable order regardless of insertion order", () => {
    const a: EditorElementNode = { id: "n1", tag: "div", filters: { sepia: 10, blur: { value: 2, unit: "px" }, brightness: 110 } };
    const b: EditorElementNode = { id: "n1", tag: "div", filters: { brightness: 110, sepia: 10, blur: { value: 2, unit: "px" } } };
    expect(resolveFilterStyle(a).filter).toBe(resolveFilterStyle(b).filter);
    expect(resolveFilterStyle(a).filter).toBe("blur(2px) brightness(110%) sepia(10%)");
  });

  it("returns {} when every field is absent", () => {
    const node: EditorElementNode = { id: "n1", tag: "div", filters: {} };
    expect(resolveFilterStyle(node)).toEqual({});
  });

  it("never throws on malformed filter data, and omits only the malformed field", () => {
    const node = {
      id: "n1",
      tag: "div",
      filters: { opacity: 150, brightness: 120, blur: "8px" },
    } as unknown as EditorElementNode;
    expect(() => resolveFilterStyle(node)).not.toThrow();
    expect(resolveFilterStyle(node)).toEqual({ filter: "brightness(120%)" });
  });

  it("never emits a duplicate filter function", () => {
    const node: EditorElementNode = { id: "n1", tag: "div", filters: { blur: { value: 4, unit: "px" } } };
    const filter = resolveFilterStyle(node).filter ?? "";
    expect(filter.match(/blur\(/g)).toHaveLength(1);
  });
});

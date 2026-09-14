import { describe, expect, it } from "vitest";
import { setSvgFill, setSvgKind, setSvgStroke, setSvgStrokeWidth, setSvgViewBox } from "./svgCommands";
import type { EditorElementNode } from "@/features/editor/types/document";

function tree(): EditorElementNode {
  return {
    id: "root",
    tag: "div",
    children: [
      {
        id: "a",
        tag: "svg",
        svgKind: "rectangle",
        svgFill: "#3b82f6",
        children: [{ id: "b", tag: "p", text: "hi" }],
      },
    ],
  };
}

describe("setSvgKind", () => {
  it("Rectangle -> Circle -> Triangle -> Star round-trips correctly", () => {
    let root = tree();
    root = setSvgKind(root, "a", "circle");
    expect(root.children![0].svgKind).toBe("circle");
    root = setSvgKind(root, "a", "triangle");
    expect(root.children![0].svgKind).toBe("triangle");
    root = setSvgKind(root, "a", "star");
    expect(root.children![0].svgKind).toBe("star");
  });

  it("never changes the tag itself", () => {
    const root = setSvgKind(tree(), "a", "star");
    expect(root.children![0].tag).toBe("svg");
  });

  it("is a true no-op (same reference) when the value doesn't change", () => {
    const root = tree();
    expect(setSvgKind(root, "a", "rectangle")).toBe(root);
  });

  it("preserves unrelated fields (fill, child subtree)", () => {
    const root = setSvgKind(tree(), "a", "star");
    expect(root.children![0].svgFill).toBe("#3b82f6");
    expect(root.children![0].children![0].text).toBe("hi");
  });

  it("is a no-op (same reference) when nodeId doesn't exist", () => {
    const root = tree();
    expect(setSvgKind(root, "missing", "star")).toBe(root);
  });
});

describe("setSvgViewBox", () => {
  it("sets a custom viewBox, including a negative min", () => {
    const root = setSvgViewBox(tree(), "a", { minX: -10, minY: -10, width: 50, height: 50 });
    expect(root.children![0].svgViewBox).toEqual({ minX: -10, minY: -10, width: 50, height: 50 });
  });

  it("floors width/height at 1 rather than storing a non-positive value", () => {
    const root = setSvgViewBox(tree(), "a", { minX: 0, minY: 0, width: 0, height: -5 });
    expect(root.children![0].svgViewBox).toEqual({ minX: 0, minY: 0, width: 1, height: 1 });
  });

  it("is a no-op (same reference) when the effective value doesn't change", () => {
    const withViewBox = setSvgViewBox(tree(), "a", { minX: 0, minY: 0, width: 100, height: 100 });
    const again = setSvgViewBox(withViewBox, "a", { minX: 0, minY: 0, width: 100, height: 100 });
    expect(again).toBe(withViewBox);
  });
});

describe("setSvgFill", () => {
  it("sets and clears fill", () => {
    let root = setSvgFill(tree(), "a", "#ff0000");
    expect(root.children![0].svgFill).toBe("#ff0000");
    root = setSvgFill(root, "a", undefined);
    expect(root.children![0].svgFill).toBeUndefined();
  });

  it("is a no-op (same reference) when the value doesn't change", () => {
    const root = tree();
    expect(setSvgFill(root, "a", "#3b82f6")).toBe(root);
  });
});

describe("setSvgStroke", () => {
  it("None -> color -> different color -> None", () => {
    let root = tree();
    expect(root.children![0].svgStroke).toBeUndefined();
    root = setSvgStroke(root, "a", "#000000");
    expect(root.children![0].svgStroke).toBe("#000000");
    root = setSvgStroke(root, "a", "#ffffff");
    expect(root.children![0].svgStroke).toBe("#ffffff");
    root = setSvgStroke(root, "a", undefined);
    expect(root.children![0].svgStroke).toBeUndefined();
  });

  it("never touches svgStrokeWidth when toggled to None", () => {
    let root = tree();
    root = setSvgStrokeWidth(root, "a", 3);
    root = setSvgStroke(root, "a", "#000000");
    root = setSvgStroke(root, "a", undefined);
    expect(root.children![0].svgStrokeWidth).toBe(3);
  });
});

describe("setSvgStrokeWidth", () => {
  it("sets a stroke width and preserves it independently of stroke", () => {
    const root = setSvgStrokeWidth(tree(), "a", 5);
    expect(root.children![0].svgStrokeWidth).toBe(5);
  });

  it("floors at 0 rather than storing a negative width", () => {
    const root = setSvgStrokeWidth(tree(), "a", -3);
    expect(root.children![0].svgStrokeWidth).toBe(0);
  });

  it("is a no-op (same reference) when the value doesn't change", () => {
    const withWidth = setSvgStrokeWidth(tree(), "a", 2);
    const again = setSvgStrokeWidth(withWidth, "a", 2);
    expect(again).toBe(withWidth);
  });
});

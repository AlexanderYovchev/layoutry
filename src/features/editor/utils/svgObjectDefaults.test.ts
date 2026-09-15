import { describe, expect, it } from "vitest";
import { resolveSvgObjectCreationStyle } from "./svgObjectDefaults";
import type { EditorElementNode } from "@/features/editor/types/document";

function svgNode(overrides: Partial<EditorElementNode> = {}): EditorElementNode {
  return { id: "svg1", tag: "svg", ...overrides };
}

describe("resolveSvgObjectCreationStyle", () => {
  it("seeds a non-Line object from the SVG's own current fill/stroke/strokeWidth", () => {
    const node = svgNode({ svgFill: "#ff0000", svgStroke: "#000000", svgStrokeWidth: 3 });
    expect(resolveSvgObjectCreationStyle(node, "rect")).toEqual({ fill: "#ff0000", stroke: "#000000", strokeWidth: 3 });
  });

  it("seeds a non-Line object with no stroke when the SVG has none (never invents strokeWidth)", () => {
    const node = svgNode({ svgFill: "#ff0000" });
    expect(resolveSvgObjectCreationStyle(node, "ellipse")).toEqual({ fill: "#ff0000", stroke: undefined, strokeWidth: undefined });
  });

  it("a Line never gets a fill, even if the SVG has one", () => {
    const node = svgNode({ svgFill: "#ff0000" });
    expect(resolveSvgObjectCreationStyle(node, "line").fill).toBeUndefined();
  });

  it("a Line uses the SVG's own stroke when it has one", () => {
    const node = svgNode({ svgStroke: "#123456", svgStrokeWidth: 5 });
    expect(resolveSvgObjectCreationStyle(node, "line")).toEqual({ fill: undefined, stroke: "#123456", strokeWidth: 5 });
  });

  it("a Line falls back to a visible default stroke when the SVG has none — never invisible", () => {
    const node = svgNode({});
    const style = resolveSvgObjectCreationStyle(node, "line");
    expect(style.stroke).toBeTruthy();
    expect(style.strokeWidth).toBeGreaterThan(0);
  });
});

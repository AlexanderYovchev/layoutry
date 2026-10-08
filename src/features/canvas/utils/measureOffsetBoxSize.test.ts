import { describe, expect, it } from "vitest";
import { measureOffsetBoxSize } from "./measureOffsetBoxSize";

function buildCanvasRoot(nodeId: string, offsetWidth: number, offsetHeight: number): HTMLElement {
  const root = document.createElement("div");
  const target = document.createElement("div");
  target.setAttribute("data-node-id", nodeId);
  Object.defineProperty(target, "offsetWidth", { value: offsetWidth, configurable: true });
  Object.defineProperty(target, "offsetHeight", { value: offsetHeight, configurable: true });
  root.appendChild(target);
  return root;
}

describe("measureOffsetBoxSize", () => {
  it("returns the live element's offsetWidth/offsetHeight", () => {
    const root = buildCanvasRoot("node-1", 240, 120);
    expect(measureOffsetBoxSize(root, "node-1")).toEqual({ width: 240, height: 120 });
  });

  it("returns null when the canvas root is null", () => {
    expect(measureOffsetBoxSize(null, "node-1")).toBeNull();
  });

  it("returns null when the node isn't found in the canvas root", () => {
    const root = buildCanvasRoot("node-1", 240, 120);
    expect(measureOffsetBoxSize(root, "missing")).toBeNull();
  });
});

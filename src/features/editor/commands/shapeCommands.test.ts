import { describe, expect, it } from "vitest";
import { setElementShape } from "./shapeCommands";
import type { EditorElementNode } from "@/features/editor/types/document";

function tree(): EditorElementNode {
  return {
    id: "root",
    tag: "div",
    children: [
      {
        id: "a",
        tag: "div",
        border: { top: { width: { value: 2, unit: "px" }, style: "solid", color: "#000000" } },
        children: [{ id: "b", tag: "p", text: "hi" }],
      },
    ],
  };
}

describe("setElementShape", () => {
  it("sets a preset on the target node", () => {
    const root = tree();
    const next = setElementShape(root, "a", "circle");
    expect(next.children![0].shape).toBe("circle");
  });

  it("Rectangle -> Circle -> Hexagon -> Rectangle round-trips correctly", () => {
    let root = tree();
    root = setElementShape(root, "a", "circle");
    expect(root.children![0].shape).toBe("circle");
    root = setElementShape(root, "a", "hexagon");
    expect(root.children![0].shape).toBe("hexagon");
    root = setElementShape(root, "a", "none");
    expect(root.children![0].shape).toBeUndefined();
  });

  it("\"none\" normalizes to an undefined field rather than a stored literal", () => {
    const root = setElementShape(tree(), "a", "none");
    expect(root.children![0].shape).toBeUndefined();
  });

  it("is a true no-op (same reference) when the value doesn't change", () => {
    const withShape = setElementShape(tree(), "a", "hexagon");
    const again = setElementShape(withShape, "a", "hexagon");
    expect(again).toBe(withShape);
  });

  it("setting to \"none\" on a node that's already unset is a no-op", () => {
    const root = tree();
    expect(setElementShape(root, "a", "none")).toBe(root);
  });

  it("works on a nested node, preserving structural sharing for untouched siblings", () => {
    const root = tree();
    const next = setElementShape(root, "b", "star");
    expect(next.children![0].children![0].shape).toBe("star");
    // The parent's own untouched fields (border) are preserved by reference.
    expect(next.children![0].border).toBe(root.children![0].border);
  });

  it("preserves every unrelated style field already on the node", () => {
    const root = tree();
    const next = setElementShape(root, "a", "diamond");
    expect(next.children![0].border).toEqual(root.children![0].border);
  });

  it("is a no-op (same reference) when nodeId doesn't exist", () => {
    const root = tree();
    expect(setElementShape(root, "missing", "circle")).toBe(root);
  });
});

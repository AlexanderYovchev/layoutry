import { describe, expect, it } from "vitest";
import type { EditorElementNode } from "@/features/editor/types/document";
import { getTransformBlockingAncestor } from "./transformGeometrySafety";

const tree: EditorElementNode = {
  id: "root",
  tag: "page",
  children: [
    {
      id: "rotated-container",
      tag: "div",
      transform: { rotateDeg: 20 },
      children: [{ id: "child", tag: "p" }],
    },
  ],
};

describe("getTransformBlockingAncestor", () => {
  it("returns undefined when no ancestor has a non-identity rotate/scale", () => {
    const plainTree: EditorElementNode = { id: "root", tag: "page", children: [{ id: "a", tag: "div", children: [{ id: "b", tag: "p" }] }] };
    expect(getTransformBlockingAncestor(plainTree, "b")).toBeUndefined();
  });

  it("finds a rotated ancestor", () => {
    expect(getTransformBlockingAncestor(tree, "child")?.id).toBe("rotated-container");
  });

  it("finds a scaled ancestor", () => {
    const scaledTree: EditorElementNode = {
      id: "root",
      tag: "page",
      children: [{ id: "scaled", tag: "div", transform: { scale: 1.5 }, children: [{ id: "child", tag: "p" }] }],
    };
    expect(getTransformBlockingAncestor(scaledTree, "child")?.id).toBe("scaled");
  });

  it("does NOT block for a translate-only ancestor", () => {
    const translatedTree: EditorElementNode = {
      id: "root",
      tag: "page",
      children: [{ id: "translated", tag: "div", transform: { translateX: 50 }, children: [{ id: "child", tag: "p" }] }],
    };
    expect(getTransformBlockingAncestor(translatedTree, "child")).toBeUndefined();
  });

  it("does NOT block a node against its own rotate/scale (ancestors only, never the node itself)", () => {
    const selfRotated: EditorElementNode = {
      id: "root",
      tag: "page",
      children: [{ id: "self", tag: "div", transform: { rotateDeg: 15 } }],
    };
    expect(getTransformBlockingAncestor(selfRotated, "self")).toBeUndefined();
  });

  it("finds the closest blocking ancestor through a deeper chain", () => {
    const deepTree: EditorElementNode = {
      id: "root",
      tag: "page",
      children: [
        {
          id: "outer-rotated",
          tag: "div",
          transform: { rotateDeg: 10 },
          children: [{ id: "inner-plain", tag: "div", children: [{ id: "target", tag: "p" }] }],
        },
      ],
    };
    expect(getTransformBlockingAncestor(deepTree, "target")?.id).toBe("outer-rotated");
  });

  it("returns undefined for an unknown nodeId", () => {
    expect(getTransformBlockingAncestor(tree, "missing")).toBeUndefined();
  });
});

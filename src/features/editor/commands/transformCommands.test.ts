import { describe, expect, it } from "vitest";
import type { EditorElementNode } from "@/features/editor/types/document";
import { setElementTransform } from "./transformCommands";

const tree: EditorElementNode = {
  id: "root",
  tag: "page",
  children: [{ id: "child-1", tag: "div" }],
};

describe("setElementTransform", () => {
  it("sets the targeted node's transform, leaving the rest of the tree untouched (same reference)", () => {
    const next = setElementTransform(tree, "child-1", { rotateDeg: 15 });
    expect(next.children?.[0].transform).toEqual({ rotateDeg: 15 });
    expect(next).not.toBe(tree);
  });

  it("clears the transform when given undefined", () => {
    const withTransform: EditorElementNode = { ...tree, children: [{ id: "child-1", tag: "div", transform: { rotateDeg: 15 } }] };
    const next = setElementTransform(withTransform, "child-1", undefined);
    expect(next.children?.[0].transform).toBeUndefined();
  });

  it("is a no-op (same reference) when committing the same value", () => {
    const withTransform: EditorElementNode = { ...tree, children: [{ id: "child-1", tag: "div", transform: { rotateDeg: 15 } }] };
    const next = setElementTransform(withTransform, "child-1", { rotateDeg: 15 });
    expect(next).toBe(withTransform);
  });

  it("is a no-op when clearing an already-absent transform", () => {
    const next = setElementTransform(tree, "child-1", undefined);
    expect(next).toBe(tree);
  });

  it("is a no-op for an unknown nodeId", () => {
    const next = setElementTransform(tree, "missing", { rotateDeg: 15 });
    expect(next).toBe(tree);
  });

  it("treats an identity-only value as equal to absent (no-op)", () => {
    const next = setElementTransform(tree, "child-1", { translateX: 0, scale: 1 });
    expect(next).toBe(tree);
  });
});

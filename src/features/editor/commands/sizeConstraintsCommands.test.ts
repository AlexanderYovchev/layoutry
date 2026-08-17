import { describe, expect, it } from "vitest";
import { setSizeConstraints } from "./sizeConstraintsCommands";
import type { EditorElementNode } from "@/features/editor/types/document";

function tree(): EditorElementNode {
  return {
    id: "root",
    tag: "page",
    children: [
      { id: "box-1", tag: "div" },
      { id: "box-2", tag: "div" },
    ],
  };
}

describe("setSizeConstraints", () => {
  it("sets exactly one node's sizeConstraints, leaving siblings untouched", () => {
    const root = tree();
    const constraints = { minWidth: 100, maxWidth: 400 };
    const result = setSizeConstraints(root, "box-1", constraints);

    expect(result.children?.find((c) => c.id === "box-1")?.sizeConstraints).toEqual(constraints);
    expect(result.children?.find((c) => c.id === "box-2")?.sizeConstraints).toBeUndefined();
  });

  it("keeps unrelated branches referentially unchanged", () => {
    const root = tree();
    const result = setSizeConstraints(root, "box-1", { minWidth: 100 });

    expect(result.children?.find((c) => c.id === "box-2")).toBe(root.children?.find((c) => c.id === "box-2"));
  });

  it("is a no-op (same reference) if the node doesn't exist", () => {
    const root = tree();
    const result = setSizeConstraints(root, "does-not-exist", { minWidth: 100 });
    expect(result).toBe(root);
  });

  it("overwrites previously-set constraints rather than merging", () => {
    const root: EditorElementNode = { id: "box-1", tag: "div", sizeConstraints: { minWidth: 100 } };
    const result = setSizeConstraints(root, "box-1", { maxWidth: 400 });
    expect(result.sizeConstraints).toEqual({ maxWidth: 400 });
  });

  it("clears sizeConstraints entirely when passed undefined", () => {
    const root: EditorElementNode = { id: "box-1", tag: "div", sizeConstraints: { minWidth: 100 } };
    const result = setSizeConstraints(root, "box-1", undefined);
    expect(result.sizeConstraints).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import { setBorderRadiusSettings } from "./borderRadiusCommands";
import type { EditorElementNode } from "@/features/editor/types/document";

function tree(): EditorElementNode {
  return {
    id: "root",
    tag: "page",
    children: [
      { id: "container-1", tag: "div" },
      { id: "container-2", tag: "div" },
    ],
  };
}

describe("setBorderRadiusSettings", () => {
  it("sets exactly one node's border radius, leaving siblings untouched", () => {
    const root = tree();
    const borderRadius = { topLeft: { value: 8, unit: "px" as const } };
    const result = setBorderRadiusSettings(root, "container-1", borderRadius);

    expect(result.children?.find((c) => c.id === "container-1")?.borderRadius).toEqual(borderRadius);
    expect(result.children?.find((c) => c.id === "container-2")?.borderRadius).toBeUndefined();
  });

  it("keeps unrelated branches referentially unchanged", () => {
    const root = tree();
    const result = setBorderRadiusSettings(root, "container-1", { topLeft: { value: 4, unit: "px" } });

    expect(result.children?.find((c) => c.id === "container-2")).toBe(
      root.children?.find((c) => c.id === "container-2"),
    );
  });

  it("is a no-op (same reference) if the node doesn't exist", () => {
    const root = tree();
    const result = setBorderRadiusSettings(root, "does-not-exist", { topLeft: { value: 4, unit: "px" } });
    expect(result).toBe(root);
  });

  it("overwrites previously-set border radius rather than merging", () => {
    const root: EditorElementNode = {
      id: "container-1",
      tag: "div",
      borderRadius: { topLeft: { value: 4, unit: "px" }, bottomLeft: { value: 2, unit: "px" } },
    };
    const result = setBorderRadiusSettings(root, "container-1", { topLeft: { value: 8, unit: "px" } });
    expect(result.borderRadius).toEqual({ topLeft: { value: 8, unit: "px" } });
  });

  it("clears border radius entirely when given undefined", () => {
    const root: EditorElementNode = { id: "container-1", tag: "div", borderRadius: { topLeft: { value: 4, unit: "px" } } };
    const result = setBorderRadiusSettings(root, "container-1", undefined);
    expect(result.borderRadius).toBeUndefined();
  });
});

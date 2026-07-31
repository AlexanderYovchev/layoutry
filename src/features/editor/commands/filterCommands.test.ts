import { describe, expect, it } from "vitest";
import { setFilterSettings } from "./filterCommands";
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

describe("setFilterSettings", () => {
  it("sets exactly one node's filters, leaving siblings untouched", () => {
    const root = tree();
    const filters = { opacity: 50 };
    const result = setFilterSettings(root, "container-1", filters);

    expect(result.children?.find((c) => c.id === "container-1")?.filters).toEqual(filters);
    expect(result.children?.find((c) => c.id === "container-2")?.filters).toBeUndefined();
  });

  it("keeps unrelated branches referentially unchanged", () => {
    const root = tree();
    const result = setFilterSettings(root, "container-1", { opacity: 50 });

    expect(result.children?.find((c) => c.id === "container-2")).toBe(
      root.children?.find((c) => c.id === "container-2"),
    );
  });

  it("is a no-op (same reference) if the node doesn't exist", () => {
    const root = tree();
    const result = setFilterSettings(root, "does-not-exist", { opacity: 50 });
    expect(result).toBe(root);
  });

  it("overwrites previously-set filters rather than merging", () => {
    const root: EditorElementNode = { id: "container-1", tag: "div", filters: { opacity: 50, blur: { value: 4, unit: "px" } } };
    const result = setFilterSettings(root, "container-1", { brightness: 120 });
    expect(result.filters).toEqual({ brightness: 120 });
  });

  it("clears filters entirely when given undefined", () => {
    const root: EditorElementNode = { id: "container-1", tag: "div", filters: { opacity: 50 } };
    const result = setFilterSettings(root, "container-1", undefined);
    expect(result.filters).toBeUndefined();
  });
});

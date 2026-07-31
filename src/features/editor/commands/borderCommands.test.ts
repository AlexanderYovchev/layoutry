import { describe, expect, it } from "vitest";
import { setBorderSettings } from "./borderCommands";
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

describe("setBorderSettings", () => {
  it("sets exactly one node's border, leaving siblings untouched", () => {
    const root = tree();
    const border = { top: { style: "solid" as const } };
    const result = setBorderSettings(root, "container-1", border);

    expect(result.children?.find((c) => c.id === "container-1")?.border).toEqual(border);
    expect(result.children?.find((c) => c.id === "container-2")?.border).toBeUndefined();
  });

  it("keeps unrelated branches referentially unchanged", () => {
    const root = tree();
    const result = setBorderSettings(root, "container-1", { top: { style: "dashed" } });

    expect(result.children?.find((c) => c.id === "container-2")).toBe(
      root.children?.find((c) => c.id === "container-2"),
    );
  });

  it("is a no-op (same reference) if the node doesn't exist", () => {
    const root = tree();
    const result = setBorderSettings(root, "does-not-exist", { top: { style: "solid" } });
    expect(result).toBe(root);
  });

  it("overwrites previously-set border rather than merging", () => {
    const root: EditorElementNode = {
      id: "container-1",
      tag: "div",
      border: { top: { style: "solid" }, left: { style: "dotted" } },
    };
    const result = setBorderSettings(root, "container-1", { top: { style: "dashed" } });
    expect(result.border).toEqual({ top: { style: "dashed" } });
  });

  it("clears border entirely when given undefined", () => {
    const root: EditorElementNode = { id: "container-1", tag: "div", border: { top: { style: "solid" } } };
    const result = setBorderSettings(root, "container-1", undefined);
    expect(result.border).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import { setTypographySettings } from "./typographyCommands";
import type { EditorElementNode } from "@/features/editor/types/document";

function tree(): EditorElementNode {
  return {
    id: "root",
    tag: "page",
    children: [
      { id: "heading-1", tag: "h1", text: "Title" },
      { id: "heading-2", tag: "h1", text: "Other" },
    ],
  };
}

describe("setTypographySettings", () => {
  it("sets exactly one node's typography, leaving siblings untouched", () => {
    const root = tree();
    const typography = { fontSize: { value: 32, unit: "px" as const } };
    const result = setTypographySettings(root, "heading-1", typography);

    expect(result.children?.find((c) => c.id === "heading-1")?.typography).toEqual(typography);
    expect(result.children?.find((c) => c.id === "heading-2")?.typography).toBeUndefined();
  });

  it("keeps unrelated branches referentially unchanged", () => {
    const root = tree();
    const result = setTypographySettings(root, "heading-1", { fontWeight: 700 });

    expect(result.children?.find((c) => c.id === "heading-2")).toBe(
      root.children?.find((c) => c.id === "heading-2"),
    );
  });

  it("is a no-op (same reference) if the node doesn't exist", () => {
    const root = tree();
    const result = setTypographySettings(root, "does-not-exist", { fontWeight: 700 });
    expect(result).toBe(root);
  });

  it("overwrites previously-set typography rather than merging", () => {
    const root: EditorElementNode = {
      id: "heading-1",
      tag: "h1",
      typography: { fontWeight: 700, color: "#000000" },
    };
    const result = setTypographySettings(root, "heading-1", { fontWeight: 400 });
    expect(result.typography).toEqual({ fontWeight: 400 });
  });

  it("clears typography entirely when given undefined", () => {
    const root: EditorElementNode = { id: "heading-1", tag: "h1", typography: { fontWeight: 700 } };
    const result = setTypographySettings(root, "heading-1", undefined);
    expect(result.typography).toBeUndefined();
  });
});

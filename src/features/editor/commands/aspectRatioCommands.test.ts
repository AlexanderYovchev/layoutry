import { describe, expect, it } from "vitest";
import { setAspectRatio } from "./aspectRatioCommands";
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

describe("setAspectRatio", () => {
  it("sets exactly one node's aspect ratio, leaving siblings untouched", () => {
    const root = tree();
    const aspectRatio = { mode: "ratio" as const, width: 16, height: 9 };
    const result = setAspectRatio(root, "container-1", aspectRatio);

    expect(result.children?.find((c) => c.id === "container-1")?.aspectRatio).toEqual(aspectRatio);
    expect(result.children?.find((c) => c.id === "container-2")?.aspectRatio).toBeUndefined();
  });

  it("keeps unrelated branches referentially unchanged", () => {
    const root = tree();
    const result = setAspectRatio(root, "container-1", { mode: "auto" });

    expect(result.children?.find((c) => c.id === "container-2")).toBe(
      root.children?.find((c) => c.id === "container-2"),
    );
  });

  it("is a no-op (same reference) if the node doesn't exist", () => {
    const root = tree();
    const result = setAspectRatio(root, "does-not-exist", { mode: "auto" });
    expect(result).toBe(root);
  });

  it("overwrites a previously-set aspect ratio rather than merging", () => {
    const root: EditorElementNode = { id: "container-1", tag: "div", aspectRatio: { mode: "ratio", width: 1, height: 1 } };
    const result = setAspectRatio(root, "container-1", { mode: "ratio", width: 16, height: 9 });
    expect(result.aspectRatio).toEqual({ mode: "ratio", width: 16, height: 9 });
  });

  it("clears aspect ratio entirely when given undefined", () => {
    const root: EditorElementNode = { id: "container-1", tag: "div", aspectRatio: { mode: "ratio", width: 16, height: 9 } };
    const result = setAspectRatio(root, "container-1", undefined);
    expect(result.aspectRatio).toBeUndefined();
  });

  it("preserves an explicit auto value distinctly from undefined", () => {
    const root: EditorElementNode = { id: "container-1", tag: "div" };
    const result = setAspectRatio(root, "container-1", { mode: "auto" });
    expect(result.aspectRatio).toEqual({ mode: "auto" });
    expect(result.aspectRatio).not.toBeUndefined();
  });
});

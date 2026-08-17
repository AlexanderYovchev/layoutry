import { describe, expect, it } from "vitest";
import { setMediaFitSettings } from "./mediaFitCommands";
import type { EditorElementNode } from "@/features/editor/types/document";

function tree(): EditorElementNode {
  return {
    id: "root",
    tag: "page",
    children: [
      { id: "image-1", tag: "img", src: "a.png" },
      { id: "image-2", tag: "img", src: "b.png" },
    ],
  };
}

describe("setMediaFitSettings", () => {
  it("sets exactly one node's mediaFit, leaving siblings untouched", () => {
    const root = tree();
    const settings = { objectFit: "cover" as const };
    const result = setMediaFitSettings(root, "image-1", settings);

    expect(result.children?.find((c) => c.id === "image-1")?.mediaFit).toEqual(settings);
    expect(result.children?.find((c) => c.id === "image-2")?.mediaFit).toBeUndefined();
  });

  it("keeps unrelated branches referentially unchanged", () => {
    const root = tree();
    const settings = { objectFit: "cover" as const };
    const result = setMediaFitSettings(root, "image-1", settings);

    expect(result.children?.find((c) => c.id === "image-2")).toBe(
      root.children?.find((c) => c.id === "image-2"),
    );
  });

  it("is a no-op (same reference) if the node doesn't exist", () => {
    const root = tree();
    const result = setMediaFitSettings(root, "does-not-exist", { objectFit: "cover" });
    expect(result).toBe(root);
  });

  it("overwrites a previously-set mediaFit rather than merging", () => {
    const root: EditorElementNode = {
      id: "image-1",
      tag: "img",
      mediaFit: { objectFit: "contain" },
    };
    const result = setMediaFitSettings(root, "image-1", { objectFit: "fill", objectPositionX: { value: 0, unit: "%" } });
    expect(result.mediaFit).toEqual({ objectFit: "fill", objectPositionX: { value: 0, unit: "%" } });
  });

  it("clears mediaFit entirely when passed undefined", () => {
    const root: EditorElementNode = { id: "image-1", tag: "img", mediaFit: { objectFit: "cover" } };
    const result = setMediaFitSettings(root, "image-1", undefined);
    expect(result.mediaFit).toBeUndefined();
  });
});

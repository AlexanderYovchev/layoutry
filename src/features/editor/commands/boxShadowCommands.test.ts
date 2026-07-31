import { describe, expect, it } from "vitest";
import { setBoxShadowSettings } from "./boxShadowCommands";
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

describe("setBoxShadowSettings", () => {
  it("sets exactly one node's box shadow, leaving siblings untouched", () => {
    const root = tree();
    const boxShadow = [{ id: "shadow-1", enabled: true, inset: false, color: "#000000" }];
    const result = setBoxShadowSettings(root, "container-1", boxShadow);

    expect(result.children?.find((c) => c.id === "container-1")?.boxShadow).toEqual(boxShadow);
    expect(result.children?.find((c) => c.id === "container-2")?.boxShadow).toBeUndefined();
  });

  it("keeps unrelated branches referentially unchanged", () => {
    const root = tree();
    const result = setBoxShadowSettings(root, "container-1", [{ id: "shadow-1", enabled: true, inset: false }]);

    expect(result.children?.find((c) => c.id === "container-2")).toBe(
      root.children?.find((c) => c.id === "container-2"),
    );
  });

  it("is a no-op (same reference) if the node doesn't exist", () => {
    const root = tree();
    const result = setBoxShadowSettings(root, "does-not-exist", [{ id: "shadow-1", enabled: true, inset: false }]);
    expect(result).toBe(root);
  });

  it("overwrites previously-set layers rather than merging", () => {
    const root: EditorElementNode = {
      id: "container-1",
      tag: "div",
      boxShadow: [{ id: "shadow-1", enabled: true, inset: false, color: "#ff0000" }],
    };
    const next = [{ id: "shadow-2", enabled: true, inset: false, color: "#00ff00" }];
    const result = setBoxShadowSettings(root, "container-1", next);
    expect(result.boxShadow).toEqual(next);
  });

  it("clears the box shadow entirely when given undefined", () => {
    const root: EditorElementNode = {
      id: "container-1",
      tag: "div",
      boxShadow: [{ id: "shadow-1", enabled: true, inset: false }],
    };
    const result = setBoxShadowSettings(root, "container-1", undefined);
    expect(result.boxShadow).toBeUndefined();
  });
});

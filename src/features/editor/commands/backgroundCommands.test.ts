import { describe, expect, it } from "vitest";
import { setBackgroundSettings } from "./backgroundCommands";
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

describe("setBackgroundSettings", () => {
  it("sets exactly one node's background, leaving siblings untouched", () => {
    const root = tree();
    const background = { color: "#ff0000" };
    const result = setBackgroundSettings(root, "container-1", background);

    expect(result.children?.find((c) => c.id === "container-1")?.background).toEqual(background);
    expect(result.children?.find((c) => c.id === "container-2")?.background).toBeUndefined();
  });

  it("keeps unrelated branches referentially unchanged", () => {
    const root = tree();
    const result = setBackgroundSettings(root, "container-1", { color: "#ff0000" });

    expect(result.children?.find((c) => c.id === "container-2")).toBe(
      root.children?.find((c) => c.id === "container-2"),
    );
  });

  it("is a no-op (same reference) if the node doesn't exist", () => {
    const root = tree();
    const result = setBackgroundSettings(root, "does-not-exist", { color: "#ff0000" });
    expect(result).toBe(root);
  });

  it("overwrites previously-set background rather than merging", () => {
    const root: EditorElementNode = {
      id: "container-1",
      tag: "div",
      background: { color: "#000000", repeat: "repeat" },
    };
    const result = setBackgroundSettings(root, "container-1", { color: "#ffffff" });
    expect(result.background).toEqual({ color: "#ffffff" });
  });

  it("clears background entirely when given undefined", () => {
    const root: EditorElementNode = { id: "container-1", tag: "div", background: { color: "#000000" } };
    const result = setBackgroundSettings(root, "container-1", undefined);
    expect(result.background).toBeUndefined();
  });
});

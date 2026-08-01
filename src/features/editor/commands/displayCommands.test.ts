import { describe, expect, it } from "vitest";
import { setDisplaySettings } from "./displayCommands";
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

describe("setDisplaySettings", () => {
  it("sets exactly one node's display settings, leaving siblings untouched", () => {
    const root = tree();
    const display = { display: "none" as const };
    const result = setDisplaySettings(root, "container-1", display);

    expect(result.children?.find((c) => c.id === "container-1")?.display).toEqual(display);
    expect(result.children?.find((c) => c.id === "container-2")?.display).toBeUndefined();
  });

  it("keeps unrelated branches referentially unchanged", () => {
    const root = tree();
    const result = setDisplaySettings(root, "container-1", { display: "none" });

    expect(result.children?.find((c) => c.id === "container-2")).toBe(
      root.children?.find((c) => c.id === "container-2"),
    );
  });

  it("is a no-op (same reference) if the node doesn't exist", () => {
    const root = tree();
    const result = setDisplaySettings(root, "does-not-exist", { display: "none" });
    expect(result).toBe(root);
  });

  it("overwrites previously-set display settings rather than merging", () => {
    const root: EditorElementNode = { id: "container-1", tag: "div", display: { display: "none", cursor: "pointer" } };
    const result = setDisplaySettings(root, "container-1", { visibility: "hidden" });
    expect(result.display).toEqual({ visibility: "hidden" });
  });

  it("clears display settings entirely when given undefined", () => {
    const root: EditorElementNode = { id: "container-1", tag: "div", display: { display: "none" } };
    const result = setDisplaySettings(root, "container-1", undefined);
    expect(result.display).toBeUndefined();
  });
});

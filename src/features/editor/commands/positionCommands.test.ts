import { describe, expect, it } from "vitest";
import { setPositionSettings } from "./positionCommands";
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

describe("setPositionSettings", () => {
  it("sets exactly one node's position settings, leaving siblings untouched", () => {
    const root = tree();
    const position = { position: "absolute" as const };
    const result = setPositionSettings(root, "container-1", position);

    expect(result.children?.find((c) => c.id === "container-1")?.position).toEqual(position);
    expect(result.children?.find((c) => c.id === "container-2")?.position).toBeUndefined();
  });

  it("keeps unrelated branches referentially unchanged", () => {
    const root = tree();
    const result = setPositionSettings(root, "container-1", { position: "absolute" });

    expect(result.children?.find((c) => c.id === "container-2")).toBe(
      root.children?.find((c) => c.id === "container-2"),
    );
  });

  it("is a no-op (same reference) if the node doesn't exist", () => {
    const root = tree();
    const result = setPositionSettings(root, "does-not-exist", { position: "absolute" });
    expect(result).toBe(root);
  });

  it("overwrites previously-set position settings rather than merging", () => {
    const root: EditorElementNode = { id: "container-1", tag: "div", position: { position: "absolute" } };
    const result = setPositionSettings(root, "container-1", { position: "sticky" });
    expect(result.position).toEqual({ position: "sticky" });
  });

  it("clears position settings entirely when given undefined", () => {
    const root: EditorElementNode = { id: "container-1", tag: "div", position: { position: "fixed" } };
    const result = setPositionSettings(root, "container-1", undefined);
    expect(result.position).toBeUndefined();
  });
});

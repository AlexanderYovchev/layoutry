import { describe, expect, it } from "vitest";
import { setElementTransition } from "./transitionCommands";
import { DEFAULT_TRANSITION_SETTINGS } from "@/features/editor/types/transition";
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

describe("setElementTransition", () => {
  it("sets exactly one node's transition, leaving siblings untouched", () => {
    const root = tree();
    const result = setElementTransition(root, "container-1", DEFAULT_TRANSITION_SETTINGS);

    expect(result.children?.find((c) => c.id === "container-1")?.transition).toEqual(DEFAULT_TRANSITION_SETTINGS);
    expect(result.children?.find((c) => c.id === "container-2")?.transition).toBeUndefined();
  });

  it("keeps unrelated branches referentially unchanged", () => {
    const root = tree();
    const result = setElementTransition(root, "container-1", DEFAULT_TRANSITION_SETTINGS);

    expect(result.children?.find((c) => c.id === "container-2")).toBe(root.children?.find((c) => c.id === "container-2"));
  });

  it("is a no-op (same reference) if the node doesn't exist", () => {
    const root = tree();
    const result = setElementTransition(root, "does-not-exist", DEFAULT_TRANSITION_SETTINGS);
    expect(result).toBe(root);
  });

  it("overwrites a previously-set transition rather than merging", () => {
    const root: EditorElementNode = { id: "container-1", tag: "div", transition: DEFAULT_TRANSITION_SETTINGS };
    const result = setElementTransition(root, "container-1", { property: "box-shadow", durationMs: 500, timingFunction: "linear", delayMs: 50 });
    expect(result.transition).toEqual({ property: "box-shadow", durationMs: 500, timingFunction: "linear", delayMs: 50 });
  });

  it("clears the transition entirely when given undefined", () => {
    const root: EditorElementNode = { id: "container-1", tag: "div", transition: DEFAULT_TRANSITION_SETTINGS };
    const result = setElementTransition(root, "container-1", undefined);
    expect(result.transition).toBeUndefined();
  });

  it("is a no-op (same reference) when setting the exact same transition values again", () => {
    const root: EditorElementNode = { id: "container-1", tag: "div", transition: { ...DEFAULT_TRANSITION_SETTINGS } };
    const result = setElementTransition(root, "container-1", { ...DEFAULT_TRANSITION_SETTINGS });
    expect(result).toBe(root);
  });

  it("is a no-op (same reference) when clearing an already-absent transition", () => {
    const root: EditorElementNode = { id: "container-1", tag: "div" };
    const result = setElementTransition(root, "container-1", undefined);
    expect(result).toBe(root);
  });
});

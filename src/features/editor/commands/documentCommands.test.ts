import { describe, expect, it } from "vitest";
import type { EditorElementNode } from "@/features/editor/types/document";
import { insertNode } from "./documentCommands";

const tree: EditorElementNode = {
  id: "root",
  tag: "page",
  children: [
    {
      id: "container-1",
      tag: "div",
      children: [{ id: "heading-1", tag: "h1", text: "Title" }],
    },
  ],
};

describe("insertNode", () => {
  it("appends the new node to the target parent's children", () => {
    const newNode: EditorElementNode = { id: "button-1", tag: "button", text: "Go" };

    const result = insertNode(tree, "container-1", newNode);

    const container = result.children?.[0];
    expect(container?.children).toHaveLength(2);
    expect(container?.children?.[1]).toEqual(newNode);
  });

  it("inserts directly under the root when the root is the target", () => {
    const newNode: EditorElementNode = { id: "container-2", tag: "div", children: [] };

    const result = insertNode(tree, "root", newNode);

    expect(result.children).toHaveLength(2);
    expect(result.children?.[1]).toEqual(newNode);
  });

  it("does not mutate the original tree", () => {
    const newNode: EditorElementNode = { id: "button-1", tag: "button", text: "Go" };

    insertNode(tree, "container-1", newNode);

    expect(tree.children?.[0].children).toHaveLength(1);
  });

  it("returns a new root reference but keeps unrelated branches referentially unchanged", () => {
    const original: EditorElementNode = {
      id: "root",
      tag: "page",
      children: [
        { id: "container-a", tag: "div", children: [] },
        { id: "container-b", tag: "div", children: [] },
      ],
    };
    const newNode: EditorElementNode = { id: "button-1", tag: "button", text: "Go" };

    const result = insertNode(original, "container-a", newNode);

    expect(result).not.toBe(original);
    expect(result.children?.[0]).not.toBe(original.children?.[0]);
    expect(result.children?.[1]).toBe(original.children?.[1]);
  });

  it("returns the original root unchanged when the target parent id does not exist", () => {
    const newNode: EditorElementNode = { id: "button-1", tag: "button", text: "Go" };

    const result = insertNode(tree, "does-not-exist", newNode);

    expect(result).toBe(tree);
  });
});

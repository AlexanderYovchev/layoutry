import { describe, expect, it } from "vitest";
import type { EditorElementNode } from "@/features/editor/types/document";
import { findNodeById, findParentId } from "./findNodeById";

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

describe("findNodeById", () => {
  it("resolves a nested node", () => {
    expect(findNodeById(tree, "heading-1")).toEqual({
      id: "heading-1",
      tag: "h1",
      text: "Title",
    });
  });

  it("resolves the root", () => {
    expect(findNodeById(tree, "root")).toBe(tree);
  });

  it("returns undefined for an unknown id", () => {
    expect(findNodeById(tree, "missing")).toBeUndefined();
  });
});

describe("findParentId", () => {
  it("resolves the immediate parent of a nested node", () => {
    expect(findParentId(tree, "heading-1")).toBe("container-1");
  });

  it("returns null for the root", () => {
    expect(findParentId(tree, "root")).toBeNull();
  });

  it("returns null for an unknown id", () => {
    expect(findParentId(tree, "missing")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import type { EditorElementNode } from "@/features/editor/types/document";
import { findAncestorIds } from "./documentTreeUtils";

const tree: EditorElementNode = {
  id: "root",
  tag: "page",
  children: [
    {
      id: "section-1",
      tag: "section",
      children: [{ id: "heading-1", tag: "h1" }],
    },
  ],
};

describe("findAncestorIds", () => {
  it("returns every ancestor from the immediate parent up to the root", () => {
    expect(findAncestorIds(tree, "heading-1")).toEqual(["section-1", "root"]);
  });

  it("returns just the root for a top-level node", () => {
    expect(findAncestorIds(tree, "section-1")).toEqual(["root"]);
  });

  it("returns an empty array for the root itself", () => {
    expect(findAncestorIds(tree, "root")).toEqual([]);
  });

  it("returns an empty array for an id that doesn't exist", () => {
    expect(findAncestorIds(tree, "missing")).toEqual([]);
  });
});

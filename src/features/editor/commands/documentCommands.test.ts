import { describe, expect, it } from "vitest";
import type { EditorElementNode } from "@/features/editor/types/document";
import { insertNode, moveNode, removeNode, resizeNode } from "./documentCommands";

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

  it("inserts before a named sibling when a position is given", () => {
    const withSiblings: EditorElementNode = {
      id: "container-1",
      tag: "div",
      children: [
        { id: "a", tag: "p", text: "A" },
        { id: "b", tag: "p", text: "B" },
      ],
    };
    const newNode: EditorElementNode = { id: "new", tag: "p", text: "New" };

    const result = insertNode(withSiblings, "container-1", newNode, {
      referenceId: "b",
      placement: "before",
    });

    expect(result.children?.map((child) => child.id)).toEqual(["a", "new", "b"]);
  });

  it("inserts after a named sibling when a position is given", () => {
    const withSiblings: EditorElementNode = {
      id: "container-1",
      tag: "div",
      children: [
        { id: "a", tag: "p", text: "A" },
        { id: "b", tag: "p", text: "B" },
      ],
    };
    const newNode: EditorElementNode = { id: "new", tag: "p", text: "New" };

    const result = insertNode(withSiblings, "container-1", newNode, {
      referenceId: "a",
      placement: "after",
    });

    expect(result.children?.map((child) => child.id)).toEqual(["a", "new", "b"]);
  });

  it("falls back to appending when the referenced sibling does not exist", () => {
    const newNode: EditorElementNode = { id: "new", tag: "p", text: "New" };

    const result = insertNode(tree, "container-1", newNode, {
      referenceId: "does-not-exist",
      placement: "before",
    });

    expect(result.children?.[0].children?.at(-1)?.id).toBe("new");
  });
});

describe("removeNode", () => {
  it("removes the node from its parent's children", () => {
    const result = removeNode(tree, "heading-1");

    expect(result.children?.[0].children).toEqual([]);
  });

  it("does not mutate the original tree", () => {
    removeNode(tree, "heading-1");

    expect(tree.children?.[0].children).toHaveLength(1);
  });

  it("is a no-op (same reference) when the id does not exist", () => {
    const result = removeNode(tree, "does-not-exist");

    expect(result).toBe(tree);
  });

  it("removing a node also removes its entire subtree", () => {
    const nested: EditorElementNode = {
      id: "root",
      tag: "page",
      children: [
        {
          id: "container-1",
          tag: "div",
          children: [{ id: "inner", tag: "div", children: [{ id: "leaf", tag: "p", text: "x" }] }],
        },
      ],
    };

    const result = removeNode(nested, "container-1");

    expect(result.children).toEqual([]);
  });
});

describe("moveNode", () => {
  const moveTree: EditorElementNode = {
    id: "root",
    tag: "page",
    children: [
      {
        id: "section-a",
        tag: "section",
        children: [
          { id: "heading-1", tag: "h1", text: "Title" },
          { id: "button-1", tag: "button", text: "Go" },
        ],
      },
      { id: "section-b", tag: "section", children: [] },
    ],
  };

  it("reorders a node within the same parent (before)", () => {
    const result = moveNode(moveTree, "button-1", "heading-1", "before");

    const section = result.children?.find((child) => child.id === "section-a");
    expect(section?.children?.map((child) => child.id)).toEqual(["button-1", "heading-1"]);
  });

  it("reorders a node within the same parent (after)", () => {
    const result = moveNode(moveTree, "heading-1", "button-1", "after");

    const section = result.children?.find((child) => child.id === "section-a");
    expect(section?.children?.map((child) => child.id)).toEqual(["button-1", "heading-1"]);
  });

  it("moves a node into a different container (inside)", () => {
    const result = moveNode(moveTree, "button-1", "section-b", "inside");

    const sourceSection = result.children?.find((child) => child.id === "section-a");
    const targetSection = result.children?.find((child) => child.id === "section-b");
    expect(sourceSection?.children?.map((child) => child.id)).toEqual(["heading-1"]);
    expect(targetSection?.children?.map((child) => child.id)).toEqual(["button-1"]);
  });

  it("moves a nested structure intact (children move with their parent)", () => {
    const result = moveNode(moveTree, "section-a", "section-b", "inside");

    const targetSection = result.children?.find((child) => child.id === "section-b");
    const movedSection = targetSection?.children?.find((child) => child.id === "section-a");
    expect(movedSection?.children?.map((child) => child.id)).toEqual([
      "heading-1",
      "button-1",
    ]);
  });

  it("rejects dropping a node onto its own descendant and leaves the tree untouched", () => {
    const result = moveNode(moveTree, "section-a", "heading-1", "inside");

    expect(result).toBe(moveTree);
  });

  it("rejects dropping a node inside itself", () => {
    const result = moveNode(moveTree, "section-a", "section-a", "inside");

    expect(result).toBe(moveTree);
  });

  it("rejects moving the document root", () => {
    const result = moveNode(moveTree, "root", "section-b", "inside");

    expect(result).toBe(moveTree);
  });

  it("rejects inserting inside a leaf (non-container) target", () => {
    const result = moveNode(moveTree, "button-1", "heading-1", "inside");

    expect(result).toBe(moveTree);
  });

  it("rejects before/after the document root", () => {
    const result = moveNode(moveTree, "button-1", "root", "before");

    expect(result).toBe(moveTree);
  });

  it("preserves the document elsewhere after a successful move (integrity check)", () => {
    const result = moveNode(moveTree, "button-1", "section-b", "inside");

    // Every node still exists exactly once somewhere in the tree.
    const ids = collectIds(result);
    expect(ids.sort()).toEqual(
      ["root", "section-a", "heading-1", "button-1", "section-b"].sort(),
    );
  });
});

describe("resizeNode", () => {
  const resizeTree: EditorElementNode = {
    id: "root",
    tag: "page",
    children: [
      { id: "container-1", tag: "div", children: [] },
      { id: "image-1", tag: "img" },
      { id: "heading-1", tag: "h1", text: "Title" },
    ],
  };

  it("sets dimensions on a resizable node (container)", () => {
    const result = resizeNode(resizeTree, "container-1", {
      width: 320,
      height: 180,
      offsetX: 0,
      offsetY: 0,
    });

    const container = result.children?.find((child) => child.id === "container-1");
    expect(container?.dimensions).toEqual({ width: 320, height: 180, offsetX: 0, offsetY: 0 });
  });

  it("sets dimensions on a resizable node (image)", () => {
    const result = resizeNode(resizeTree, "image-1", {
      width: 200,
      height: 150,
      offsetX: 0,
      offsetY: 0,
    });

    const image = result.children?.find((child) => child.id === "image-1");
    expect(image?.dimensions).toEqual({ width: 200, height: 150, offsetX: 0, offsetY: 0 });
  });

  it("preserves a west/north anchor offset", () => {
    const result = resizeNode(resizeTree, "container-1", {
      width: 320,
      height: 180,
      offsetX: -60,
      offsetY: -20,
    });

    const container = result.children?.find((child) => child.id === "container-1");
    expect(container?.dimensions).toEqual({ width: 320, height: 180, offsetX: -60, offsetY: -20 });
  });

  it("clamps width/height defensively to the minimum constraints even if the caller didn't", () => {
    const result = resizeNode(resizeTree, "container-1", {
      width: 10,
      height: -5,
      offsetX: 0,
      offsetY: 0,
    });

    const container = result.children?.find((child) => child.id === "container-1");
    expect(container?.dimensions).toEqual({ width: 64, height: 64, offsetX: 0, offsetY: 0 });
  });

  it("does not mutate the original tree", () => {
    resizeNode(resizeTree, "container-1", { width: 320, height: 180, offsetX: 0, offsetY: 0 });

    expect(resizeTree.children?.[0].dimensions).toBeUndefined();
  });

  it("keeps unrelated branches referentially unchanged", () => {
    const result = resizeNode(resizeTree, "container-1", {
      width: 320,
      height: 180,
      offsetX: 0,
      offsetY: 0,
    });

    expect(result.children?.[1]).toBe(resizeTree.children?.[1]);
    expect(result.children?.[2]).toBe(resizeTree.children?.[2]);
  });

  it("is a no-op (same reference) for an unsupported element type", () => {
    const result = resizeNode(resizeTree, "heading-1", {
      width: 320,
      height: 180,
      offsetX: 0,
      offsetY: 0,
    });

    expect(result).toBe(resizeTree);
  });

  it("is a no-op (same reference) when the id does not exist", () => {
    const result = resizeNode(resizeTree, "does-not-exist", {
      width: 320,
      height: 180,
      offsetX: 0,
      offsetY: 0,
    });

    expect(result).toBe(resizeTree);
  });

  it("overwrites a previous resize with the latest dimensions", () => {
    const already = resizeNode(resizeTree, "container-1", {
      width: 100,
      height: 100,
      offsetX: 0,
      offsetY: 0,
    });

    const result = resizeNode(already, "container-1", {
      width: 320,
      height: 180,
      offsetX: 0,
      offsetY: 0,
    });

    const container = result.children?.find((child) => child.id === "container-1");
    expect(container?.dimensions).toEqual({ width: 320, height: 180, offsetX: 0, offsetY: 0 });
  });
});

function collectIds(node: EditorElementNode): string[] {
  return [node.id, ...(node.children ?? []).flatMap(collectIds)];
}

import { describe, expect, it } from "vitest";
import type { EditorElementNode } from "@/features/editor/types/document";
import { DEFAULT_RESIZE_CONSTRAINTS } from "@/features/editor/types/resize";
import {
  insertNode,
  moveNode,
  removeNode,
  resizeNode,
  setElementAutoplay,
  setElementChecked,
  setElementClassName,
  setElementControls,
  setElementDimensions,
  setElementHref,
  setElementHtmlId,
  setElementInputType,
  setElementLoop,
  setElementMuted,
  setElementName,
  setElementPlaceholder,
  setElementPoster,
  setElementSrc,
  setElementTag,
  setElementText,
  setElementTitle,
  setElementValue,
  setListItemCount,
  setOptionCount,
  setSelectSelectedOption,
} from "./documentCommands";

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

  describe("constrained list nesting (Checkpoint 1.6)", () => {
    it("inserts an li into a ul", () => {
      const listTree: EditorElementNode = { id: "root", tag: "page", children: [{ id: "list-1", tag: "ul", children: [] }] };
      const newLi: EditorElementNode = { id: "li-1", tag: "li", text: "Alpha" };

      const result = insertNode(listTree, "list-1", newLi);

      expect(result.children?.[0].children).toEqual([newLi]);
    });

    it("is a no-op (same reference) when inserting an li into a non-list container", () => {
      const newLi: EditorElementNode = { id: "li-1", tag: "li", text: "Alpha" };

      const result = insertNode(tree, "container-1", newLi);

      expect(result).toBe(tree);
    });

    it("is a no-op (same reference) when inserting a non-li element into a ul", () => {
      const listTree: EditorElementNode = { id: "root", tag: "page", children: [{ id: "list-1", tag: "ul", children: [] }] };
      const newHeading: EditorElementNode = { id: "heading-1", tag: "h1", text: "Title" };

      const result = insertNode(listTree, "list-1", newHeading);

      expect(result).toBe(listTree);
    });

    it("still allows inserting a whole ul into an ordinary container", () => {
      const newList: EditorElementNode = { id: "list-1", tag: "ul", children: [] };

      const result = insertNode(tree, "container-1", newList);

      expect(result.children?.[0].children?.at(-1)).toEqual(newList);
    });
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
      preferredWidth: 320,
      preferredHeight: 180,
      offsetX: 0,
      offsetY: 0,
    });

    const container = result.children?.find((child) => child.id === "container-1");
    expect(container?.dimensions).toEqual({ preferredWidth: 320, preferredHeight: 180, offsetX: 0, offsetY: 0 });
  });

  it("sets dimensions on a resizable node (image)", () => {
    const result = resizeNode(resizeTree, "image-1", {
      preferredWidth: 200,
      preferredHeight: 150,
      offsetX: 0,
      offsetY: 0,
    });

    const image = result.children?.find((child) => child.id === "image-1");
    expect(image?.dimensions).toEqual({ preferredWidth: 200, preferredHeight: 150, offsetX: 0, offsetY: 0 });
  });

  it("sets dimensions on a text element (heading) — universal resize, Checkpoint 3.4.3", () => {
    const result = resizeNode(resizeTree, "heading-1", {
      preferredWidth: 400,
      preferredHeight: 80,
      offsetX: 0,
      offsetY: 0,
    });

    const heading = result.children?.find((child) => child.id === "heading-1");
    expect(heading?.dimensions).toEqual({ preferredWidth: 400, preferredHeight: 80, offsetX: 0, offsetY: 0 });
  });

  it("preserves a west/north anchor offset", () => {
    const result = resizeNode(resizeTree, "container-1", {
      preferredWidth: 320,
      preferredHeight: 180,
      offsetX: -60,
      offsetY: -20,
    });

    const container = result.children?.find((child) => child.id === "container-1");
    expect(container?.dimensions).toEqual({ preferredWidth: 320, preferredHeight: 180, offsetX: -60, offsetY: -20 });
  });

  it("clamps width/height defensively to the same small, generic floor for a container, even if the caller didn't (Checkpoint 1.12.1 — a creation/starting size must never become a minimum)", () => {
    const result = resizeNode(resizeTree, "container-1", {
      preferredWidth: 1,
      preferredHeight: -5,
      offsetX: 0,
      offsetY: 0,
    });

    const container = result.children?.find((child) => child.id === "container-1");
    expect(container?.dimensions).toEqual({
      preferredWidth: DEFAULT_RESIZE_CONSTRAINTS.minWidth,
      preferredHeight: DEFAULT_RESIZE_CONSTRAINTS.minHeight,
      offsetX: 0,
      offsetY: 0,
    });
  });

  it("clamps a leaf (non-container) node's width/height to the same generic floor as a container", () => {
    const result = resizeNode(resizeTree, "heading-1", {
      preferredWidth: 1,
      preferredHeight: -5,
      offsetX: 0,
      offsetY: 0,
    });

    const heading = result.children?.find((child) => child.id === "heading-1");
    expect(heading?.dimensions).toEqual({
      preferredWidth: DEFAULT_RESIZE_CONSTRAINTS.minWidth,
      preferredHeight: DEFAULT_RESIZE_CONSTRAINTS.minHeight,
      offsetX: 0,
      offsetY: 0,
    });
  });

  it("allows an explicit resize well below a container's own creation size (Checkpoint 1.12.1 regression — a Form's ~200x150 factory default must not act as a floor)", () => {
    const result = resizeNode(resizeTree, "container-1", {
      preferredWidth: 40,
      preferredHeight: 30,
      offsetX: 0,
      offsetY: 0,
    });

    const container = result.children?.find((child) => child.id === "container-1");
    expect(container?.dimensions).toEqual({ preferredWidth: 40, preferredHeight: 30, offsetX: 0, offsetY: 0 });
  });

  it("does not mutate the original tree", () => {
    resizeNode(resizeTree, "container-1", { preferredWidth: 320, preferredHeight: 180, offsetX: 0, offsetY: 0 });

    expect(resizeTree.children?.[0].dimensions).toBeUndefined();
  });

  it("keeps unrelated branches referentially unchanged", () => {
    const result = resizeNode(resizeTree, "container-1", {
      preferredWidth: 320,
      preferredHeight: 180,
      offsetX: 0,
      offsetY: 0,
    });

    expect(result.children?.[1]).toBe(resizeTree.children?.[1]);
    expect(result.children?.[2]).toBe(resizeTree.children?.[2]);
  });

  it("is a no-op (same reference) for an unsupported element type (the document root)", () => {
    const result = resizeNode(resizeTree, "root", {
      preferredWidth: 320,
      preferredHeight: 180,
      offsetX: 0,
      offsetY: 0,
    });

    expect(result).toBe(resizeTree);
  });

  it("is a no-op (same reference) when the id does not exist", () => {
    const result = resizeNode(resizeTree, "does-not-exist", {
      preferredWidth: 320,
      preferredHeight: 180,
      offsetX: 0,
      offsetY: 0,
    });

    expect(result).toBe(resizeTree);
  });

  it("overwrites a previous resize with the latest dimensions", () => {
    const already = resizeNode(resizeTree, "container-1", {
      preferredWidth: 100,
      preferredHeight: 100,
      offsetX: 0,
      offsetY: 0,
    });

    const result = resizeNode(already, "container-1", {
      preferredWidth: 320,
      preferredHeight: 180,
      offsetX: 0,
      offsetY: 0,
    });

    const container = result.children?.find((child) => child.id === "container-1");
    expect(container?.dimensions).toEqual({ preferredWidth: 320, preferredHeight: 180, offsetX: 0, offsetY: 0 });
  });
});

describe("setElementDimensions", () => {
  const sizingTree: EditorElementNode = {
    id: "root",
    tag: "page",
    children: [{ id: "container-1", tag: "div", children: [] }],
  };

  it("sets dimensions with the same generic floor clamp resizeNode applies", () => {
    const result = setElementDimensions(sizingTree, "container-1", {
      preferredWidth: 1,
      preferredHeight: 1,
      offsetX: 0,
      offsetY: 0,
    });

    const container = result.children?.find((child) => child.id === "container-1");
    // See resizeNode's own test suite — every tag shares the same generic floor.
    expect(container?.dimensions).toEqual({
      preferredWidth: DEFAULT_RESIZE_CONSTRAINTS.minWidth,
      preferredHeight: DEFAULT_RESIZE_CONSTRAINTS.minHeight,
      offsetX: 0,
      offsetY: 0,
    });
  });

  it("clears dimensions entirely (both axes) when passed undefined", () => {
    const resized = setElementDimensions(sizingTree, "container-1", {
      preferredWidth: 320,
      preferredHeight: 180,
      offsetX: 0,
      offsetY: 0,
    });

    const result = setElementDimensions(resized, "container-1", undefined);
    const container = result.children?.find((child) => child.id === "container-1");
    expect(container?.dimensions).toBeUndefined();
  });

  it("is a no-op (same reference) when clearing a node that's already Auto", () => {
    const result = setElementDimensions(sizingTree, "container-1", undefined);
    expect(result).toBe(sizingTree);
  });

  it("is a no-op (same reference) if the node doesn't exist", () => {
    const result = setElementDimensions(sizingTree, "does-not-exist", {
      preferredWidth: 320,
      preferredHeight: 180,
      offsetX: 0,
      offsetY: 0,
    });
    expect(result).toBe(sizingTree);
  });
});

describe("setElementText", () => {
  it("updates the target node's text and nothing else", () => {
    const result = setElementText(tree, "heading-1", "New title");

    const heading = result.children?.[0].children?.[0];
    expect(heading?.text).toBe("New title");
    expect(heading?.id).toBe("heading-1");
    expect(heading?.tag).toBe("h1");
  });

  it("finds and updates a deeply nested node", () => {
    const deepTree: EditorElementNode = {
      id: "root",
      tag: "page",
      children: [
        {
          id: "section-1",
          tag: "section",
          children: [
            {
              id: "container-1",
              tag: "div",
              children: [{ id: "paragraph-1", tag: "p", text: "Old text" }],
            },
          ],
        },
      ],
    };

    const result = setElementText(deepTree, "paragraph-1", "New text");

    const paragraph = result.children?.[0].children?.[0].children?.[0];
    expect(paragraph?.text).toBe("New text");
  });

  it("preserves every other field on the updated node", () => {
    const styledTree: EditorElementNode = {
      id: "root",
      tag: "page",
      children: [
        {
          id: "heading-1",
          tag: "h1",
          text: "Title",
          displayName: "Hero Heading",
          typography: { fontWeight: 700 },
          dimensions: { preferredWidth: 300, preferredHeight: 60, offsetX: 0, offsetY: 0 },
        },
      ],
    };

    const result = setElementText(styledTree, "heading-1", "New title");

    const heading = result.children?.[0];
    expect(heading?.displayName).toBe("Hero Heading");
    expect(heading?.typography).toEqual({ fontWeight: 700 });
    expect(heading?.dimensions).toEqual({ preferredWidth: 300, preferredHeight: 60, offsetX: 0, offsetY: 0 });
  });

  it("leaves unrelated sibling nodes completely untouched (structural sharing)", () => {
    const result = setElementText(tree, "heading-1", "New title");

    const container = result.children?.[0];
    const originalContainer = tree.children?.[0];
    // The container's own object identity changes (it's on the path to
    // the edited node), but any *sibling* subtree the edit didn't touch
    // must keep its exact original reference.
    expect(container).not.toBe(originalContainer);
  });

  it("supports committing an empty string", () => {
    const result = setElementText(tree, "heading-1", "");

    const heading = result.children?.[0].children?.[0];
    expect(heading?.text).toBe("");
  });

  it("is a no-op (same reference) when the text is already exactly this value", () => {
    const result = setElementText(tree, "heading-1", "Title");
    expect(result).toBe(tree);
  });

  it("is a no-op (same reference) if the node doesn't exist", () => {
    const result = setElementText(tree, "does-not-exist", "New text");
    expect(result).toBe(tree);
  });

  it("does not require the node to be a text-bearing tag — generic by id only", () => {
    const result = setElementText(tree, "container-1", "Not really text-bearing");
    expect(result.children?.[0].text).toBe("Not really text-bearing");
  });
});

describe("setElementHref", () => {
  const linkTree: EditorElementNode = {
    id: "root",
    tag: "page",
    children: [
      {
        id: "container-1",
        tag: "div",
        children: [{ id: "link-1", tag: "a", text: "Link text", href: "#" }],
      },
    ],
  };

  it("updates the target node's href and nothing else", () => {
    const result = setElementHref(linkTree, "link-1", "/about");

    const link = result.children?.[0].children?.[0];
    expect(link?.href).toBe("/about");
    expect(link?.id).toBe("link-1");
    expect(link?.text).toBe("Link text");
  });

  it("finds and updates a deeply nested node", () => {
    const deepTree: EditorElementNode = {
      id: "root",
      tag: "page",
      children: [
        {
          id: "section-1",
          tag: "section",
          children: [
            {
              id: "container-1",
              tag: "div",
              children: [{ id: "link-1", tag: "a", text: "Link text", href: "#" }],
            },
          ],
        },
      ],
    };

    const result = setElementHref(deepTree, "link-1", "https://example.com");

    const link = result.children?.[0].children?.[0].children?.[0];
    expect(link?.href).toBe("https://example.com");
  });

  it("preserves every other field on the updated node", () => {
    const styledTree: EditorElementNode = {
      id: "root",
      tag: "page",
      children: [
        {
          id: "link-1",
          tag: "a",
          text: "Link text",
          href: "#",
          typography: { fontWeight: 700 },
        },
      ],
    };

    const result = setElementHref(styledTree, "link-1", "/pricing");

    const link = result.children?.[0];
    expect(link?.text).toBe("Link text");
    expect(link?.typography).toEqual({ fontWeight: 700 });
  });

  it("leaves unrelated sibling nodes completely untouched (structural sharing)", () => {
    const result = setElementHref(linkTree, "link-1", "/about");

    const container = result.children?.[0];
    const originalContainer = linkTree.children?.[0];
    expect(container).not.toBe(originalContainer);
  });

  it("clears an explicit href back to undefined", () => {
    const result = setElementHref(linkTree, "link-1", undefined);

    const link = result.children?.[0].children?.[0];
    expect(link?.href).toBeUndefined();
  });

  it("is a no-op (same reference) when the value is already exactly this value", () => {
    const result = setElementHref(linkTree, "link-1", "#");
    expect(result).toBe(linkTree);
  });

  it("is a no-op (same reference) if the node doesn't exist", () => {
    const result = setElementHref(linkTree, "does-not-exist", "/about");
    expect(result).toBe(linkTree);
  });

  it("does not require the node to be an `a` tag — generic by id only", () => {
    const result = setElementHref(linkTree, "container-1", "/about");
    expect(result.children?.[0].href).toBe("/about");
  });
});

describe("setElementTag (Checkpoint 1.7)", () => {
  it("updates the target node's tag and nothing else", () => {
    const result = setElementTag(tree, "heading-1", "h2");

    const heading = result.children?.[0].children?.[0];
    expect(heading?.tag).toBe("h2");
    expect(heading?.id).toBe("heading-1");
    expect(heading?.text).toBe("Title");
  });

  it("finds and updates a deeply nested node", () => {
    const deepTree: EditorElementNode = {
      id: "root",
      tag: "page",
      children: [
        {
          id: "section-1",
          tag: "section",
          children: [
            {
              id: "container-1",
              tag: "div",
              children: [{ id: "heading-1", tag: "h1", text: "Title" }],
            },
          ],
        },
      ],
    };

    const result = setElementTag(deepTree, "heading-1", "h4");

    const heading = result.children?.[0].children?.[0].children?.[0];
    expect(heading?.tag).toBe("h4");
  });

  it("preserves every other field on the updated node — text, styles, layout, dimensions", () => {
    const styledTree: EditorElementNode = {
      id: "root",
      tag: "page",
      children: [
        {
          id: "heading-1",
          tag: "h1",
          text: "Pricing",
          displayName: "Hero Heading",
          typography: { fontWeight: 700, color: "#3366ff" },
          spacing: { margin: { top: 4, right: 0, bottom: 4, left: 0 }, padding: { top: 0, right: 0, bottom: 0, left: 0 } },
          dimensions: { preferredWidth: 300, preferredHeight: 60, offsetX: 0, offsetY: 0 },
        },
      ],
    };

    const result = setElementTag(styledTree, "heading-1", "h2");

    const heading = result.children?.[0];
    expect(heading?.tag).toBe("h2");
    expect(heading?.text).toBe("Pricing");
    expect(heading?.displayName).toBe("Hero Heading");
    expect(heading?.typography).toEqual({ fontWeight: 700, color: "#3366ff" });
    expect(heading?.spacing).toEqual(styledTree.children?.[0].spacing);
    expect(heading?.dimensions).toEqual({ preferredWidth: 300, preferredHeight: 60, offsetX: 0, offsetY: 0 });
  });

  it("leaves unrelated sibling nodes completely untouched (structural sharing)", () => {
    const result = setElementTag(tree, "heading-1", "h3");

    const container = result.children?.[0];
    const originalContainer = tree.children?.[0];
    expect(container).not.toBe(originalContainer);
  });

  it("is a no-op (same reference) when the tag is already exactly this value", () => {
    const result = setElementTag(tree, "heading-1", "h1");
    expect(result).toBe(tree);
  });

  it("is a no-op (same reference) if the node doesn't exist", () => {
    const result = setElementTag(tree, "does-not-exist", "h2");
    expect(result).toBe(tree);
  });

  it("does not restrict which tags are reachable — generic, tag-agnostic by design (UI-level validation is the Inspector control's job, not this command's)", () => {
    const result = setElementTag(tree, "heading-1", "h6");
    expect(result.children?.[0].children?.[0].tag).toBe("h6");
  });
});

describe("setElementValue / setElementName / setElementPlaceholder (Checkpoint 1.10)", () => {
  const inputTree: EditorElementNode = {
    id: "root",
    tag: "page",
    children: [
      {
        id: "form-1",
        tag: "form",
        children: [{ id: "input-1", tag: "input", inputType: "text", placeholder: "Enter text" }],
      },
    ],
  };

  it("setElementValue updates the target node's value and nothing else", () => {
    const result = setElementValue(inputTree, "input-1", "hello");
    const input = result.children?.[0].children?.[0];
    expect(input?.value).toBe("hello");
    expect(input?.id).toBe("input-1");
    expect(input?.placeholder).toBe("Enter text");
  });

  it("setElementValue clears an explicit value back to undefined", () => {
    const withValue = setElementValue(inputTree, "input-1", "hello");
    const result = setElementValue(withValue, "input-1", undefined);
    expect(result.children?.[0].children?.[0].value).toBeUndefined();
  });

  it("setElementValue is a no-op (same reference) when the value is already exactly this value", () => {
    const withValue = setElementValue(inputTree, "input-1", "hello");
    const result = setElementValue(withValue, "input-1", "hello");
    expect(result).toBe(withValue);
  });

  it("setElementValue is a no-op (same reference) if the node doesn't exist", () => {
    const result = setElementValue(inputTree, "does-not-exist", "hello");
    expect(result).toBe(inputTree);
  });

  it("setElementValue preserves every other field, including sibling nodes (structural sharing)", () => {
    const result = setElementValue(inputTree, "input-1", "hello");
    expect(result).not.toBe(inputTree);
    expect(result.children?.[0]).not.toBe(inputTree.children?.[0]);
  });

  it("setElementName updates the target node's name and nothing else", () => {
    const result = setElementName(inputTree, "input-1", "email");
    const input = result.children?.[0].children?.[0];
    expect(input?.name).toBe("email");
    expect(input?.placeholder).toBe("Enter text");
  });

  it("setElementName is a no-op (same reference) when the value is unchanged", () => {
    const withName = setElementName(inputTree, "input-1", "email");
    expect(setElementName(withName, "input-1", "email")).toBe(withName);
  });

  it("setElementPlaceholder updates the target node's placeholder and nothing else", () => {
    const result = setElementPlaceholder(inputTree, "input-1", "Enter your email");
    const input = result.children?.[0].children?.[0];
    expect(input?.placeholder).toBe("Enter your email");
    expect(input?.inputType).toBe("text");
  });

  it("setElementPlaceholder is a no-op (same reference) when the value is unchanged", () => {
    expect(setElementPlaceholder(inputTree, "input-1", "Enter text")).toBe(inputTree);
  });

  it("none of the three require the node to be an `input` tag — generic by id only", () => {
    const result = setElementValue(inputTree, "form-1", "irrelevant-on-a-form");
    expect(result.children?.[0].value).toBe("irrelevant-on-a-form");
  });
});

describe("setElementInputType (Checkpoint 1.11)", () => {
  const inputTree: EditorElementNode = {
    id: "root",
    tag: "page",
    children: [
      {
        id: "form-1",
        tag: "form",
        children: [{ id: "input-1", tag: "input", inputType: "text", placeholder: "Enter text" }],
      },
    ],
  };

  it("updates the target node's inputType and nothing else", () => {
    const result = setElementInputType(inputTree, "input-1", "email");
    const input = result.children?.[0].children?.[0];
    expect(input?.inputType).toBe("email");
    expect(input?.id).toBe("input-1");
    expect(input?.placeholder).toBe("Enter text");
  });

  it("finds and updates a deeply nested node", () => {
    const deepTree: EditorElementNode = {
      id: "root",
      tag: "page",
      children: [
        {
          id: "section-1",
          tag: "section",
          children: [
            {
              id: "form-1",
              tag: "form",
              children: [{ id: "input-1", tag: "input", inputType: "text" }],
            },
          ],
        },
      ],
    };

    const result = setElementInputType(deepTree, "input-1", "password");
    const input = result.children?.[0].children?.[0].children?.[0];
    expect(input?.inputType).toBe("password");
  });

  it("preserves every other field on the updated node, including styles", () => {
    const styledTree: EditorElementNode = {
      id: "root",
      tag: "page",
      children: [
        {
          id: "input-1",
          tag: "input",
          inputType: "text",
          name: "email",
          value: "hello",
          typography: { fontWeight: 700 },
        },
      ],
    };

    const result = setElementInputType(styledTree, "input-1", "number");
    const input = result.children?.[0];
    expect(input?.inputType).toBe("number");
    expect(input?.name).toBe("email");
    expect(input?.value).toBe("hello");
    expect(input?.typography).toEqual({ fontWeight: 700 });
  });

  it("is a no-op (same reference) when the inputType is already exactly this value", () => {
    const result = setElementInputType(inputTree, "input-1", "text");
    expect(result).toBe(inputTree);
  });

  it("is a no-op (same reference) if the node doesn't exist", () => {
    const result = setElementInputType(inputTree, "does-not-exist", "email");
    expect(result).toBe(inputTree);
  });

  it("leaves unrelated sibling nodes completely untouched (structural sharing)", () => {
    const result = setElementInputType(inputTree, "input-1", "url");
    const form = result.children?.[0];
    const originalForm = inputTree.children?.[0];
    expect(form).not.toBe(originalForm);
  });

  it("cycles through every text-like type correctly", () => {
    let current = inputTree;
    for (const type of ["email", "password", "number", "search", "url", "tel", "text"] as const) {
      current = setElementInputType(current, "input-1", type);
      expect(current.children?.[0].children?.[0].inputType).toBe(type);
    }
  });

  it("cycles across control families — text-like to checkbox/radio and back — without touching unrelated fields (Checkpoint 1.12)", () => {
    const styledTree: EditorElementNode = {
      id: "root",
      tag: "page",
      children: [{ id: "input-1", tag: "input", inputType: "email", name: "newsletter", placeholder: "Email", value: "yes" }],
    };

    let current = setElementInputType(styledTree, "input-1", "checkbox");
    expect(current.children?.[0].inputType).toBe("checkbox");
    expect(current.children?.[0].name).toBe("newsletter");
    expect(current.children?.[0].placeholder).toBe("Email");
    expect(current.children?.[0].value).toBe("yes");

    current = setElementInputType(current, "input-1", "radio");
    expect(current.children?.[0].inputType).toBe("radio");

    current = setElementInputType(current, "input-1", "email");
    expect(current.children?.[0].inputType).toBe("email");
    expect(current.children?.[0].name).toBe("newsletter");
    expect(current.children?.[0].placeholder).toBe("Email");
    expect(current.children?.[0].value).toBe("yes");
  });
});

describe("setElementChecked (Checkpoint 1.12)", () => {
  const checkboxTree: EditorElementNode = {
    id: "root",
    tag: "page",
    children: [
      {
        id: "form-1",
        tag: "form",
        children: [{ id: "checkbox-1", tag: "input", inputType: "checkbox", name: "terms" }],
      },
    ],
  };

  it("updates the target node's checked and nothing else", () => {
    const result = setElementChecked(checkboxTree, "checkbox-1", true);
    const checkbox = result.children?.[0].children?.[0];
    expect(checkbox?.checked).toBe(true);
    expect(checkbox?.name).toBe("terms");
  });

  it("finds and updates a deeply nested node", () => {
    const deepTree: EditorElementNode = {
      id: "root",
      tag: "page",
      children: [
        {
          id: "section-1",
          tag: "section",
          children: [
            {
              id: "form-1",
              tag: "form",
              children: [{ id: "checkbox-1", tag: "input", inputType: "checkbox" }],
            },
          ],
        },
      ],
    };

    const result = setElementChecked(deepTree, "checkbox-1", true);
    expect(result.children?.[0].children?.[0].children?.[0].checked).toBe(true);
  });

  it("preserves every other field, including styles", () => {
    const styledTree: EditorElementNode = {
      id: "root",
      tag: "page",
      children: [{ id: "checkbox-1", tag: "input", inputType: "checkbox", name: "terms", value: "yes", typography: { fontWeight: 700 } }],
    };

    const result = setElementChecked(styledTree, "checkbox-1", true);
    const checkbox = result.children?.[0];
    expect(checkbox?.checked).toBe(true);
    expect(checkbox?.name).toBe("terms");
    expect(checkbox?.value).toBe("yes");
    expect(checkbox?.typography).toEqual({ fontWeight: 700 });
  });

  it("clears an explicit checked back to undefined", () => {
    const withChecked = setElementChecked(checkboxTree, "checkbox-1", true);
    const result = setElementChecked(withChecked, "checkbox-1", undefined);
    expect(result.children?.[0].children?.[0].checked).toBeUndefined();
  });

  it("sets false explicitly (distinct from unset)", () => {
    const withChecked = setElementChecked(checkboxTree, "checkbox-1", true);
    const result = setElementChecked(withChecked, "checkbox-1", false);
    expect(result.children?.[0].children?.[0].checked).toBe(false);
  });

  it("is a no-op (same reference) when the value is already exactly this value", () => {
    const withChecked = setElementChecked(checkboxTree, "checkbox-1", true);
    expect(setElementChecked(withChecked, "checkbox-1", true)).toBe(withChecked);
  });

  it("is a no-op (same reference) when both are unset", () => {
    expect(setElementChecked(checkboxTree, "checkbox-1", undefined)).toBe(checkboxTree);
  });

  it("is a no-op (same reference) if the node doesn't exist", () => {
    expect(setElementChecked(checkboxTree, "does-not-exist", true)).toBe(checkboxTree);
  });

  it("leaves unrelated sibling nodes completely untouched (structural sharing)", () => {
    const result = setElementChecked(checkboxTree, "checkbox-1", true);
    expect(result.children?.[0]).not.toBe(checkboxTree.children?.[0]);
  });

  it("does not require the node to be a checkbox/radio — generic by id only", () => {
    const result = setElementChecked(checkboxTree, "form-1", true);
    expect(result.children?.[0].checked).toBe(true);
  });
});

describe("setListItemCount (Checkpoint 1.12.1)", () => {
  function listTree(itemCount: number, tag: "ul" | "ol" = "ul"): EditorElementNode {
    return {
      id: "root",
      tag: "page",
      children: [
        {
          id: "list-1",
          tag,
          children: Array.from({ length: itemCount }, (_, index) => ({
            id: `li-${index}`,
            tag: "li",
            text: `List item ${index}`,
          })),
        },
      ],
    };
  }

  it("appends fresh li children with fresh ids when growing", () => {
    const result = setListItemCount(listTree(3), "list-1", 5);
    const list = result.children?.[0];
    expect(list?.children).toHaveLength(5);
    expect(list?.children?.map((child) => child.tag)).toEqual(["li", "li", "li", "li", "li"]);
    const ids = list?.children?.map((child) => child.id) ?? [];
    expect(new Set(ids).size).toBe(5);
  });

  it("preserves every surviving item's id/text/styles untouched when growing", () => {
    const tree = listTree(2);
    const original = tree.children?.[0].children;
    const result = setListItemCount(tree, "list-1", 4);
    const survivors = result.children?.[0].children?.slice(0, 2);
    expect(survivors).toEqual(original);
  });

  it("trims only from the end when shrinking, preserving earlier items untouched", () => {
    const tree = listTree(5);
    const original = tree.children?.[0].children;
    const result = setListItemCount(tree, "list-1", 2);
    const list = result.children?.[0];
    expect(list?.children).toHaveLength(2);
    expect(list?.children).toEqual(original?.slice(0, 2));
  });

  it("works for both ul and ol", () => {
    const olResult = setListItemCount(listTree(2, "ol"), "list-1", 4);
    expect(olResult.children?.[0].children).toHaveLength(4);
  });

  it("is a no-op (same reference) when the count is already exactly this count", () => {
    const tree = listTree(3);
    expect(setListItemCount(tree, "list-1", 3)).toBe(tree);
  });

  it("is a no-op (same reference) for a non-list tag", () => {
    const tree: EditorElementNode = {
      id: "root",
      tag: "page",
      children: [{ id: "div-1", tag: "div", children: [] }],
    };
    expect(setListItemCount(tree, "div-1", 5)).toBe(tree);
  });

  it("is a no-op (same reference) if the node doesn't exist", () => {
    const tree = listTree(3);
    expect(setListItemCount(tree, "does-not-exist", 5)).toBe(tree);
  });

  it("clamps a negative count to zero", () => {
    const result = setListItemCount(listTree(3), "list-1", -2);
    expect(result.children?.[0].children).toEqual([]);
  });

  it("floors a fractional count", () => {
    const result = setListItemCount(listTree(2), "list-1", 3.9);
    expect(result.children?.[0].children).toHaveLength(3);
  });

  it("leaves unrelated sibling nodes completely untouched (structural sharing)", () => {
    const tree: EditorElementNode = {
      id: "root",
      tag: "page",
      children: [
        { id: "list-1", tag: "ul", children: [{ id: "li-0", tag: "li", text: "List item 0" }] },
        { id: "unrelated", tag: "div", children: [] },
      ],
    };
    const result = setListItemCount(tree, "list-1", 3);
    expect(result.children?.[1]).toBe(tree.children?.[1]);
  });
});

describe("setOptionCount (Checkpoint 1.13)", () => {
  function selectTree(optionCount: number): EditorElementNode {
    return {
      id: "root",
      tag: "page",
      children: [
        {
          id: "select-1",
          tag: "select",
          children: Array.from({ length: optionCount }, (_, index) => ({
            id: `option-${index}`,
            tag: "option",
            text: `Option ${index}`,
          })),
        },
      ],
    };
  }

  it("appends fresh option children with fresh ids when growing", () => {
    const result = setOptionCount(selectTree(3), "select-1", 5);
    const select = result.children?.[0];
    expect(select?.children).toHaveLength(5);
    expect(select?.children?.map((child) => child.tag)).toEqual(["option", "option", "option", "option", "option"]);
    const ids = select?.children?.map((child) => child.id) ?? [];
    expect(new Set(ids).size).toBe(5);
  });

  it("preserves every surviving Option's id/text/styles untouched when growing", () => {
    const tree = selectTree(2);
    const original = tree.children?.[0].children;
    const result = setOptionCount(tree, "select-1", 4);
    const survivors = result.children?.[0].children?.slice(0, 2);
    expect(survivors).toEqual(original);
  });

  it("trims only from the end when shrinking, preserving earlier Options untouched", () => {
    const tree = selectTree(5);
    const original = tree.children?.[0].children;
    const result = setOptionCount(tree, "select-1", 2);
    const select = result.children?.[0];
    expect(select?.children).toHaveLength(2);
    expect(select?.children).toEqual(original?.slice(0, 2));
  });

  it("dropping the selected Option leaves no dangling reference — the Select simply has no selected child left", () => {
    const tree = selectTree(3);
    tree.children![0].children![2].selected = true;
    const result = setOptionCount(tree, "select-1", 2);
    const select = result.children?.[0];
    expect(select?.children).toHaveLength(2);
    expect(select?.children?.some((child) => child.selected === true)).toBe(false);
  });

  it("is a no-op (same reference) when the count is already exactly this count", () => {
    const tree = selectTree(3);
    expect(setOptionCount(tree, "select-1", 3)).toBe(tree);
  });

  it("is a no-op (same reference) for a non-select tag", () => {
    const tree: EditorElementNode = {
      id: "root",
      tag: "page",
      children: [{ id: "div-1", tag: "div", children: [] }],
    };
    expect(setOptionCount(tree, "div-1", 5)).toBe(tree);
  });

  it("is a no-op (same reference) if the node doesn't exist", () => {
    const tree = selectTree(3);
    expect(setOptionCount(tree, "does-not-exist", 5)).toBe(tree);
  });

  it("clamps a negative count to zero", () => {
    const result = setOptionCount(selectTree(3), "select-1", -2);
    expect(result.children?.[0].children).toEqual([]);
  });

  it("floors a fractional count", () => {
    const result = setOptionCount(selectTree(2), "select-1", 3.9);
    expect(result.children?.[0].children).toHaveLength(3);
  });

  it("leaves unrelated sibling nodes completely untouched (structural sharing)", () => {
    const tree: EditorElementNode = {
      id: "root",
      tag: "page",
      children: [
        { id: "select-1", tag: "select", children: [{ id: "option-0", tag: "option", text: "Option 0" }] },
        { id: "unrelated", tag: "div", children: [] },
      ],
    };
    const result = setOptionCount(tree, "select-1", 3);
    expect(result.children?.[1]).toBe(tree.children?.[1]);
  });
});

describe("setSelectSelectedOption (Checkpoint 1.13)", () => {
  function selectTreeWithOptions(): EditorElementNode {
    return {
      id: "root",
      tag: "page",
      children: [
        {
          id: "select-1",
          tag: "select",
          children: [
            { id: "option-a", tag: "option", text: "A", value: "a" },
            { id: "option-b", tag: "option", text: "B", value: "b" },
            { id: "option-c", tag: "option", text: "C", value: "c" },
          ],
        },
      ],
    };
  }

  it("selects exactly the requested Option", () => {
    const result = setSelectSelectedOption(selectTreeWithOptions(), "select-1", "option-b");
    const options = result.children?.[0].children;
    expect(options?.find((o) => o.id === "option-b")?.selected).toBe(true);
  });

  it("clears every sibling in the same mutation (single-select invariant)", () => {
    let tree = setSelectSelectedOption(selectTreeWithOptions(), "select-1", "option-a");
    tree = setSelectSelectedOption(tree, "select-1", "option-c");

    const options = tree.children?.[0].children;
    expect(options?.filter((o) => o.selected === true)).toHaveLength(1);
    expect(options?.find((o) => o.id === "option-c")?.selected).toBe(true);
    expect(options?.find((o) => o.id === "option-a")?.selected).toBeUndefined();
  });

  it("clears selected as undefined (fully unset), not explicit false — matches setElementChecked's own { ...root, field: undefined } convention", () => {
    let tree = setSelectSelectedOption(selectTreeWithOptions(), "select-1", "option-a");
    tree = setSelectSelectedOption(tree, "select-1", "option-b");

    const optionA = tree.children?.[0].children?.find((o) => o.id === "option-a");
    expect(optionA?.selected).toBeUndefined();
    expect(optionA?.selected).not.toBe(false);
  });

  it("clears the authored selection entirely when optionId is undefined", () => {
    let tree = setSelectSelectedOption(selectTreeWithOptions(), "select-1", "option-b");
    tree = setSelectSelectedOption(tree, "select-1", undefined);

    const options = tree.children?.[0].children;
    expect(options?.some((o) => o.selected === true)).toBe(false);
  });

  it("preserves every other field on each Option, including styles", () => {
    const tree = selectTreeWithOptions();
    tree.children![0].children![0].typography = { fontWeight: 700 };
    const result = setSelectSelectedOption(tree, "select-1", "option-a");
    const optionA = result.children?.[0].children?.find((o) => o.id === "option-a");
    expect(optionA?.text).toBe("A");
    expect(optionA?.value).toBe("a");
    expect(optionA?.typography).toEqual({ fontWeight: 700 });
  });

  it("is a no-op (same reference) when the requested selection already matches every child's current state", () => {
    const withA = setSelectSelectedOption(selectTreeWithOptions(), "select-1", "option-a");
    expect(setSelectSelectedOption(withA, "select-1", "option-a")).toBe(withA);
  });

  it("is a no-op (same reference) when clearing an already-fully-unselected Select", () => {
    const tree = selectTreeWithOptions();
    expect(setSelectSelectedOption(tree, "select-1", undefined)).toBe(tree);
  });

  it("is a no-op (same reference) for a non-select tag", () => {
    const tree: EditorElementNode = {
      id: "root",
      tag: "page",
      children: [{ id: "div-1", tag: "div", children: [] }],
    };
    expect(setSelectSelectedOption(tree, "div-1", "anything")).toBe(tree);
  });

  it("is a no-op (same reference) if the select doesn't exist", () => {
    const tree = selectTreeWithOptions();
    expect(setSelectSelectedOption(tree, "does-not-exist", "option-a")).toBe(tree);
  });

  it("finds and updates a deeply nested select", () => {
    const deepTree: EditorElementNode = {
      id: "root",
      tag: "page",
      children: [
        {
          id: "form-1",
          tag: "form",
          children: [
            {
              id: "select-1",
              tag: "select",
              children: [{ id: "option-a", tag: "option", text: "A" }],
            },
          ],
        },
      ],
    };
    const result = setSelectSelectedOption(deepTree, "select-1", "option-a");
    expect(result.children?.[0].children?.[0].children?.[0].selected).toBe(true);
  });

  it("leaves unrelated sibling nodes completely untouched (structural sharing)", () => {
    const tree: EditorElementNode = {
      id: "root",
      tag: "page",
      children: [selectTreeWithOptions().children![0], { id: "unrelated", tag: "div", children: [] }],
    };
    const result = setSelectSelectedOption(tree, "select-1", "option-a");
    expect(result.children?.[1]).toBe(tree.children?.[1]);
  });
});

function collectIds(node: EditorElementNode): string[] {
  return [node.id, ...(node.children ?? []).flatMap(collectIds)];
}

describe("setElementSrc (Checkpoint 1.15)", () => {
  const videoTree: EditorElementNode = {
    id: "root",
    tag: "page",
    children: [{ id: "video-1", tag: "video", muted: true }],
  };

  it("updates the target node's src and nothing else", () => {
    const result = setElementSrc(videoTree, "video-1", "https://example.com/video.mp4");
    const video = result.children?.[0];
    expect(video?.src).toBe("https://example.com/video.mp4");
    expect(video?.muted).toBe(true);
  });

  it("finds and updates a deeply nested node", () => {
    const deepTree: EditorElementNode = {
      id: "root",
      tag: "page",
      children: [{ id: "section-1", tag: "section", children: [{ id: "video-1", tag: "video" }] }],
    };
    const result = setElementSrc(deepTree, "video-1", "https://example.com/video.mp4");
    expect(result.children?.[0].children?.[0].src).toBe("https://example.com/video.mp4");
  });

  it("clears an explicit src back to undefined", () => {
    const withSrc = setElementSrc(videoTree, "video-1", "https://example.com/video.mp4");
    const result = setElementSrc(withSrc, "video-1", undefined);
    expect(result.children?.[0].src).toBeUndefined();
  });

  it("is a no-op (same reference) when the value is already exactly this value", () => {
    const withSrc = setElementSrc(videoTree, "video-1", "https://example.com/video.mp4");
    expect(setElementSrc(withSrc, "video-1", "https://example.com/video.mp4")).toBe(withSrc);
  });

  it("is a no-op (same reference) if the node doesn't exist", () => {
    expect(setElementSrc(videoTree, "does-not-exist", "https://example.com/video.mp4")).toBe(videoTree);
  });

  it("is reused unchanged for an Iframe node — same generic, tag-agnostic command", () => {
    const iframeTree: EditorElementNode = { id: "root", tag: "page", children: [{ id: "iframe-1", tag: "iframe", title: "Embedded content" }] };
    const result = setElementSrc(iframeTree, "iframe-1", "https://example.com/embed");
    expect(result.children?.[0].src).toBe("https://example.com/embed");
    expect(result.children?.[0].title).toBe("Embedded content");
  });
});

describe("setElementPoster (Checkpoint 1.15)", () => {
  const videoTree: EditorElementNode = { id: "root", tag: "page", children: [{ id: "video-1", tag: "video", src: "https://example.com/video.mp4" }] };

  it("updates the target node's poster and nothing else", () => {
    const result = setElementPoster(videoTree, "video-1", "https://example.com/poster.jpg");
    const video = result.children?.[0];
    expect(video?.poster).toBe("https://example.com/poster.jpg");
    expect(video?.src).toBe("https://example.com/video.mp4");
  });

  it("clears an explicit poster back to undefined", () => {
    const withPoster = setElementPoster(videoTree, "video-1", "https://example.com/poster.jpg");
    expect(setElementPoster(withPoster, "video-1", undefined).children?.[0].poster).toBeUndefined();
  });

  it("is a no-op (same reference) when unchanged", () => {
    expect(setElementPoster(videoTree, "video-1", undefined)).toBe(videoTree);
  });

  it("is a no-op (same reference) if the node doesn't exist", () => {
    expect(setElementPoster(videoTree, "does-not-exist", "https://example.com/poster.jpg")).toBe(videoTree);
  });
});

describe("setElementTitle (Checkpoint 1.15)", () => {
  const iframeTree: EditorElementNode = { id: "root", tag: "page", children: [{ id: "iframe-1", tag: "iframe", src: "https://example.com/embed" }] };

  it("updates the target node's title and nothing else", () => {
    const result = setElementTitle(iframeTree, "iframe-1", "Product tour");
    expect(result.children?.[0].title).toBe("Product tour");
    expect(result.children?.[0].src).toBe("https://example.com/embed");
  });

  it("clears an explicit title back to undefined", () => {
    const withTitle = setElementTitle(iframeTree, "iframe-1", "Product tour");
    expect(setElementTitle(withTitle, "iframe-1", undefined).children?.[0].title).toBeUndefined();
  });

  it("is a no-op (same reference) when unchanged", () => {
    expect(setElementTitle(iframeTree, "iframe-1", undefined)).toBe(iframeTree);
  });
});

describe("Video boolean commands: setElementControls/setElementAutoplay/setElementMuted/setElementLoop (Checkpoint 1.15)", () => {
  const videoTree: EditorElementNode = { id: "root", tag: "page", children: [{ id: "video-1", tag: "video", src: "https://example.com/video.mp4" }] };

  const cases = [
    { name: "setElementControls", fn: setElementControls, field: "controls" as const },
    { name: "setElementAutoplay", fn: setElementAutoplay, field: "autoplay" as const },
    { name: "setElementMuted", fn: setElementMuted, field: "muted" as const },
    { name: "setElementLoop", fn: setElementLoop, field: "loop" as const },
  ];

  for (const { name, fn, field } of cases) {
    describe(name, () => {
      it("sets the flag true and preserves other fields", () => {
        const result = fn(videoTree, "video-1", true);
        expect(result.children?.[0][field]).toBe(true);
        expect(result.children?.[0].src).toBe("https://example.com/video.mp4");
      });

      it("sets false explicitly (distinct from unset)", () => {
        const withTrue = fn(videoTree, "video-1", true);
        expect(fn(withTrue, "video-1", false).children?.[0][field]).toBe(false);
      });

      it("clears back to undefined", () => {
        const withTrue = fn(videoTree, "video-1", true);
        expect(fn(withTrue, "video-1", undefined).children?.[0][field]).toBeUndefined();
      });

      it("is a no-op (same reference) when unchanged", () => {
        expect(fn(videoTree, "video-1", undefined)).toBe(videoTree);
      });

      it("is a no-op (same reference) if the node doesn't exist", () => {
        expect(fn(videoTree, "does-not-exist", true)).toBe(videoTree);
      });

      it("finds and updates a deeply nested node", () => {
        const deepTree: EditorElementNode = {
          id: "root",
          tag: "page",
          children: [{ id: "section-1", tag: "section", children: [{ id: "video-1", tag: "video" }] }],
        };
        expect(fn(deepTree, "video-1", true).children?.[0].children?.[0][field]).toBe(true);
      });
    });
  }

  it("setElementAutoplay never touches muted as a side effect, and vice versa", () => {
    const withAutoplay = setElementAutoplay(videoTree, "video-1", true);
    expect(withAutoplay.children?.[0].muted).toBeUndefined();
    const withBoth = setElementMuted(withAutoplay, "video-1", true);
    expect(withBoth.children?.[0].autoplay).toBe(true);
    expect(withBoth.children?.[0].muted).toBe(true);
  });
});

describe("setElementHtmlId (Checkpoint 1.15.1)", () => {
  const identityTree: EditorElementNode = { id: "root", tag: "page", children: [{ id: "div-1", tag: "div", className: "featured" }] };

  it("updates the target node's htmlId and preserves other fields", () => {
    const result = setElementHtmlId(identityTree, "div-1", "hero");
    expect(result.children?.[0].htmlId).toBe("hero");
    expect(result.children?.[0].className).toBe("featured");
  });

  it("clears an explicit htmlId back to undefined", () => {
    const withId = setElementHtmlId(identityTree, "div-1", "hero");
    expect(setElementHtmlId(withId, "div-1", undefined).children?.[0].htmlId).toBeUndefined();
  });

  it("is a no-op (same reference) when unchanged", () => {
    expect(setElementHtmlId(identityTree, "div-1", undefined)).toBe(identityTree);
  });

  it("is a no-op (same reference) if the node doesn't exist", () => {
    expect(setElementHtmlId(identityTree, "does-not-exist", "hero")).toBe(identityTree);
  });

  it("finds and updates a deeply nested node", () => {
    const deepTree: EditorElementNode = {
      id: "root",
      tag: "page",
      children: [{ id: "section-1", tag: "section", children: [{ id: "div-1", tag: "div" }] }],
    };
    expect(setElementHtmlId(deepTree, "div-1", "hero").children?.[0].children?.[0].htmlId).toBe("hero");
  });
});

describe("setElementClassName (Checkpoint 1.15.1)", () => {
  const identityTree: EditorElementNode = { id: "root", tag: "page", children: [{ id: "div-1", tag: "div", htmlId: "hero" }] };

  it("updates the target node's className and preserves other fields", () => {
    const result = setElementClassName(identityTree, "div-1", "hero-section featured");
    expect(result.children?.[0].className).toBe("hero-section featured");
    expect(result.children?.[0].htmlId).toBe("hero");
  });

  it("clears an explicit className back to undefined", () => {
    const withClass = setElementClassName(identityTree, "div-1", "hero-section featured");
    expect(setElementClassName(withClass, "div-1", undefined).children?.[0].className).toBeUndefined();
  });

  it("is a no-op (same reference) when unchanged", () => {
    expect(setElementClassName(identityTree, "div-1", undefined)).toBe(identityTree);
  });

  it("is a no-op (same reference) if the node doesn't exist", () => {
    expect(setElementClassName(identityTree, "does-not-exist", "featured")).toBe(identityTree);
  });
});

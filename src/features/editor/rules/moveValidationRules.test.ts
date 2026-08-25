import { describe, expect, it } from "vitest";
import type { EditorElementNode } from "@/features/editor/types/document";
import { isValidMoveTarget } from "./moveValidationRules";

const tree: EditorElementNode = {
  id: "root",
  tag: "page",
  children: [
    {
      id: "section-a",
      tag: "section",
      children: [
        { id: "heading-1", tag: "h1", text: "Title" },
        { id: "button-1", tag: "button", text: "Go" },
        {
          id: "list-1",
          tag: "ul",
          children: [
            { id: "li-1", tag: "li", text: "Alpha" },
            { id: "li-2", tag: "li", text: "Beta" },
          ],
        },
      ],
    },
    { id: "section-b", tag: "section", children: [] },
  ],
};

describe("isValidMoveTarget", () => {
  it("accepts a leaf sibling as a before/after reference", () => {
    expect(isValidMoveTarget(tree, "button-1", "heading-1", "before")).toBe(true);
  });

  it("accepts a container as an inside target", () => {
    expect(isValidMoveTarget(tree, "button-1", "section-b", "inside")).toBe(true);
  });

  it("rejects a node dropped onto itself", () => {
    expect(isValidMoveTarget(tree, "button-1", "button-1", "before")).toBe(false);
  });

  it("rejects a node dropped inside itself", () => {
    expect(isValidMoveTarget(tree, "section-a", "section-a", "inside")).toBe(false);
  });

  it("rejects a node dropped onto its own descendant", () => {
    expect(isValidMoveTarget(tree, "section-a", "heading-1", "before")).toBe(false);
    expect(isValidMoveTarget(tree, "section-a", "heading-1", "inside")).toBe(false);
  });

  it("rejects moving the document root", () => {
    expect(isValidMoveTarget(tree, "root", "section-b", "inside")).toBe(false);
  });

  it("rejects an inside drop onto a leaf (non-container) target", () => {
    expect(isValidMoveTarget(tree, "button-1", "heading-1", "inside")).toBe(false);
  });

  it("rejects a before/after drop against the document root", () => {
    expect(isValidMoveTarget(tree, "button-1", "root", "before")).toBe(false);
    expect(isValidMoveTarget(tree, "button-1", "root", "after")).toBe(false);
  });

  it("rejects when the dragged node no longer exists", () => {
    expect(isValidMoveTarget(tree, "does-not-exist", "section-b", "inside")).toBe(false);
  });

  it("rejects when the target no longer exists", () => {
    expect(isValidMoveTarget(tree, "button-1", "does-not-exist", "before")).toBe(false);
  });

  describe("constrained list nesting (Checkpoint 1.6)", () => {
    it("accepts reordering a list item within its own list — before/after a sibling li", () => {
      expect(isValidMoveTarget(tree, "li-1", "li-2", "before")).toBe(true);
      expect(isValidMoveTarget(tree, "li-2", "li-1", "after")).toBe(true);
    });

    it("accepts dropping a list item inside its own ul", () => {
      expect(isValidMoveTarget(tree, "li-1", "list-1", "inside")).toBe(true);
    });

    it("rejects moving a list item out of the list into an ordinary container", () => {
      expect(isValidMoveTarget(tree, "li-1", "section-b", "inside")).toBe(false);
    });

    it("rejects moving a list item to sit before/after an unrelated sibling outside the list", () => {
      expect(isValidMoveTarget(tree, "li-1", "heading-1", "before")).toBe(false);
    });

    it("rejects dropping an arbitrary element inside a ul", () => {
      expect(isValidMoveTarget(tree, "heading-1", "list-1", "inside")).toBe(false);
      expect(isValidMoveTarget(tree, "button-1", "list-1", "inside")).toBe(false);
    });

    it("accepts moving a whole ul into an ordinary container", () => {
      expect(isValidMoveTarget(tree, "list-1", "section-b", "inside")).toBe(true);
    });
  });
});

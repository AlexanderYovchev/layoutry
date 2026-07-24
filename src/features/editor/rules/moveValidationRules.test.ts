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
});

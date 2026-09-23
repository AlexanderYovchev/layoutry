import { describe, expect, it } from "vitest";
import { resolveDialogAccessibleDescription, resolveDialogAccessibleName } from "./resolveDialogAccessibleName";
import type { EditorElementNode } from "@/features/editor/types/document";

function dialogNode(children: EditorElementNode[]): EditorElementNode {
  return { id: "dialog-1", tag: "dialog", children };
}

describe("resolveDialogAccessibleName (Checkpoint 1.15.6.9.1)", () => {
  it("returns the first heading descendant's text", () => {
    const node = dialogNode([
      { id: "content", tag: "div", children: [{ id: "h", tag: "h2", text: "Modal Title" }, { id: "p", tag: "p", text: "Body" }] },
    ]);
    expect(resolveDialogAccessibleName(node)).toBe("Modal Title");
  });

  it("finds a heading at any depth, not just direct children", () => {
    const node = dialogNode([{ id: "a", tag: "div", children: [{ id: "b", tag: "div", children: [{ id: "h", tag: "h1", text: "Deep Title" }] }] }]);
    expect(resolveDialogAccessibleName(node)).toBe("Deep Title");
  });

  it("is undefined for a bare Dialog with no children — never invents a title", () => {
    expect(resolveDialogAccessibleName(dialogNode([]))).toBeUndefined();
  });

  it("is undefined when a heading exists but has empty/whitespace-only text", () => {
    const node = dialogNode([{ id: "h", tag: "h2", text: "   " }]);
    expect(resolveDialogAccessibleName(node)).toBeUndefined();
  });

  it("ignores non-heading text content", () => {
    const node = dialogNode([{ id: "p", tag: "p", text: "Just a paragraph" }]);
    expect(resolveDialogAccessibleName(node)).toBeUndefined();
  });

  it("prefers the first heading in document order over a later one", () => {
    const node = dialogNode([
      { id: "h1", tag: "h2", text: "First" },
      { id: "h2", tag: "h3", text: "Second" },
    ]);
    expect(resolveDialogAccessibleName(node)).toBe("First");
  });
});

describe("resolveDialogAccessibleDescription (Checkpoint 1.15.6.9.1)", () => {
  it("returns the first paragraph descendant's text", () => {
    const node = dialogNode([{ id: "p", tag: "p", text: "Modal content goes here." }]);
    expect(resolveDialogAccessibleDescription(node)).toBe("Modal content goes here.");
  });

  it("is undefined for a bare Dialog with no paragraph descendant", () => {
    const node = dialogNode([{ id: "h", tag: "h2", text: "Title only" }]);
    expect(resolveDialogAccessibleDescription(node)).toBeUndefined();
  });

  it("name and description resolve independently from the same subtree", () => {
    const node = dialogNode([{ id: "h", tag: "h2", text: "Title" }, { id: "p", tag: "p", text: "Description" }]);
    expect(resolveDialogAccessibleName(node)).toBe("Title");
    expect(resolveDialogAccessibleDescription(node)).toBe("Description");
  });
});

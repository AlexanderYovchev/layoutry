import { describe, expect, it } from "vitest";
import { resolveFreeDestinationPlacement } from "@/features/editor/utils/resolveFreeDestinationPlacement";
import type { EditorElementNode } from "@/features/editor/types/document";

function freeParentTree(): EditorElementNode {
  return {
    id: "root",
    tag: "page",
    children: [
      {
        id: "section-1",
        tag: "section",
        layoutMode: "free",
        freeLayout: { x: 0, y: 0, width: 400, height: 300 },
        children: [{ id: "image-1", tag: "img", freeLayout: { x: 16, y: 16, width: 100, height: 80 } }],
      },
      { id: "section-2", tag: "section", children: [] },
    ],
  };
}

describe("resolveFreeDestinationPlacement", () => {
  it("returns the node unchanged when the destination is Flow-mode", () => {
    const root = freeParentTree();
    const node: EditorElementNode = { id: "new-1", tag: "button", text: "Go" };

    const result = resolveFreeDestinationPlacement(root, "section-2", node);
    expect(result).toBe(node);
    expect(result.freeLayout).toBeUndefined();
  });

  it("assigns a freeLayout using the tag's default size when landing in a Free destination", () => {
    const root = freeParentTree();
    const node: EditorElementNode = { id: "new-1", tag: "button", text: "Go" };

    const result = resolveFreeDestinationPlacement(root, "section-1", node);
    expect(result.freeLayout).toBeDefined();
    expect(result.freeLayout).not.toEqual({ x: 16, y: 16, width: 100, height: 80 });
  });

  it("never overlaps an existing child in the destination", () => {
    const root = freeParentTree();
    const node: EditorElementNode = { id: "new-1", tag: "img" };

    const result = resolveFreeDestinationPlacement(root, "section-1", node);
    const existing = { x: 16, y: 16, width: 100, height: 80 };
    const placed = result.freeLayout!;
    const overlaps =
      placed.x < existing.x + existing.width &&
      placed.x + placed.width > existing.x &&
      placed.y < existing.y + existing.height &&
      placed.y + placed.height > existing.y;
    expect(overlaps).toBe(false);
  });

  it("reuses the node's own freeLayout size (not the tag default) when it already has one, only recomputing position", () => {
    const root = freeParentTree();
    const node: EditorElementNode = { id: "new-1", tag: "img", freeLayout: { x: 999, y: 999, width: 70, height: 70 } };

    const result = resolveFreeDestinationPlacement(root, "section-1", node);
    expect(result.freeLayout?.width).toBe(70);
    expect(result.freeLayout?.height).toBe(70);
    expect(result.freeLayout?.x).not.toBe(999);
  });

  it("clamps placement within the destination's approximated bounds", () => {
    const root = freeParentTree();
    const node: EditorElementNode = { id: "new-1", tag: "button", text: "Go" };

    const result = resolveFreeDestinationPlacement(root, "section-1", node);
    const placed = result.freeLayout!;
    expect(placed.x + placed.width).toBeLessThanOrEqual(400);
    expect(placed.y + placed.height).toBeLessThanOrEqual(300);
  });

  it("is a no-op when the destination doesn't exist", () => {
    const root = freeParentTree();
    const node: EditorElementNode = { id: "new-1", tag: "button", text: "Go" };

    const result = resolveFreeDestinationPlacement(root, "does-not-exist", node);
    expect(result).toBe(node);
  });
});

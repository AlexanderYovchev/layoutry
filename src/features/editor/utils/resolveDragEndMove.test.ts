import { describe, expect, it } from "vitest";
import type { EditorElementNode } from "@/features/editor/types/document";
import { resolveDragEndMove } from "./resolveDragEndMove";

const documentModel: EditorElementNode = {
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

describe("resolveDragEndMove", () => {
  it("resolves the moved node id, target id, and drop zone", () => {
    const result = resolveDragEndMove(
      {
        active: {
          data: { current: { kind: "move", nodeId: "heading-1" } },
          rect: { current: { translated: { top: 140, height: 20 } } }, // center 150 = inside band
        },
        over: { id: "container-1", rect: { top: 100, height: 100 } },
      },
      documentModel,
    );

    expect(result).toEqual({ nodeId: "heading-1", targetId: "container-1", zone: "inside" });
  });

  it("returns null when the drag payload isn't a move", () => {
    const result = resolveDragEndMove(
      {
        active: {
          data: { current: { elementType: "button" } },
          rect: { current: { translated: { top: 0, height: 20 } } },
        },
        over: { id: "container-1", rect: { top: 0, height: 100 } },
      },
      documentModel,
    );

    expect(result).toBeNull();
  });

  it("returns null when there is no drop target", () => {
    const result = resolveDragEndMove(
      {
        active: {
          data: { current: { kind: "move", nodeId: "heading-1" } },
          rect: { current: { translated: { top: 0, height: 20 } } },
        },
        over: null,
      },
      documentModel,
    );

    expect(result).toBeNull();
  });

  it("returns null when the dragged rect was never measured", () => {
    const result = resolveDragEndMove(
      {
        active: {
          data: { current: { kind: "move", nodeId: "heading-1" } },
          rect: { current: { translated: null } },
        },
        over: { id: "container-1", rect: { top: 0, height: 100 } },
      },
      documentModel,
    );

    expect(result).toBeNull();
  });

  it("returns null when the drop target no longer exists in the document", () => {
    const result = resolveDragEndMove(
      {
        active: {
          data: { current: { kind: "move", nodeId: "heading-1" } },
          rect: { current: { translated: { top: 0, height: 20 } } },
        },
        over: { id: "does-not-exist", rect: { top: 0, height: 100 } },
      },
      documentModel,
    );

    expect(result).toBeNull();
  });
});

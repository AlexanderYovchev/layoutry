import { describe, expect, it } from "vitest";
import type { EditorElementNode } from "@/features/editor/types/document";
import { resolveDragEndInsertion } from "./resolveDragEndInsertion";

const documentModel: EditorElementNode = {
  id: "root",
  tag: "page",
  children: [
    {
      id: "container-1",
      tag: "div",
      children: [{ id: "heading-1", tag: "h1", text: "Title" }],
    },
    { id: "button-1", tag: "button", text: "Go" },
  ],
};

describe("resolveDragEndInsertion", () => {
  it("resolves an element type, the hovered target's id, and its drop zone", () => {
    const result = resolveDragEndInsertion(
      {
        active: {
          data: { current: { elementType: "heading" } },
          rect: { current: { translated: { top: 100, height: 20 } } }, // center 110
        },
        over: { id: "container-1", rect: { top: 100, height: 100 } }, // 0-25% band -> before
      },
      documentModel,
    );

    expect(result).toEqual({ elementType: "heading", targetId: "container-1", zone: "before" });
  });

  it("resolves the middle band of a container to inside", () => {
    const result = resolveDragEndInsertion(
      {
        active: {
          data: { current: { elementType: "heading" } },
          rect: { current: { translated: { top: 140, height: 20 } } }, // center 150
        },
        over: { id: "container-1", rect: { top: 100, height: 100 } },
      },
      documentModel,
    );

    expect(result?.zone).toBe("inside");
  });

  it("gives a leaf target only before/after zones, never inside", () => {
    const result = resolveDragEndInsertion(
      {
        active: {
          data: { current: { elementType: "button" } },
          rect: { current: { translated: { top: 140, height: 20 } } }, // dead center
        },
        over: { id: "button-1", rect: { top: 100, height: 100 } },
      },
      documentModel,
    );

    expect(result?.zone).toBe("after");
  });

  it("omits targetId when the drop did not land on any droppable", () => {
    const result = resolveDragEndInsertion(
      {
        active: {
          data: { current: { elementType: "button" } },
          rect: { current: { translated: null } },
        },
        over: null,
      },
      documentModel,
    );

    expect(result).toEqual({ elementType: "button" });
  });

  it("returns null for an unrecognized element type", () => {
    // "audio" is deliberately still unrecognized (Checkpoint 1.15's own
    // Non-Goals) — "video" was this test's original placeholder but is
    // now a real InsertableElementType, so it no longer proves the
    // "unrecognized" branch.
    const result = resolveDragEndInsertion(
      {
        active: {
          data: { current: { elementType: "audio" } },
          rect: { current: { translated: null } },
        },
        over: null,
      },
      documentModel,
    );

    expect(result).toBeNull();
  });

  it("returns null when the drag carried no payload at all", () => {
    const result = resolveDragEndInsertion(
      {
        active: { data: { current: undefined }, rect: { current: { translated: null } } },
        over: null,
      },
      documentModel,
    );

    expect(result).toBeNull();
  });

  it("converts a numeric droppable id to a string", () => {
    const result = resolveDragEndInsertion(
      {
        active: {
          data: { current: { elementType: "image" } },
          rect: { current: { translated: null } },
        },
        over: { id: 42, rect: { top: 0, height: 100 } },
      },
      documentModel,
    );

    expect(result).toEqual({ elementType: "image", targetId: "42" });
  });
});

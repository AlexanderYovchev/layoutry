import { describe, expect, it } from "vitest";
import { resolveDragEndInsertion } from "./resolveDragEndInsertion";

describe("resolveDragEndInsertion", () => {
  it("resolves an element type and the hovered drop target's id", () => {
    const result = resolveDragEndInsertion({
      active: { data: { current: { elementType: "heading" } } },
      over: { id: "container-1" },
    });

    expect(result).toEqual({ elementType: "heading", targetParentId: "container-1" });
  });

  it("omits targetParentId when the drop did not land on any droppable", () => {
    const result = resolveDragEndInsertion({
      active: { data: { current: { elementType: "button" } } },
      over: null,
    });

    expect(result).toEqual({ elementType: "button", targetParentId: undefined });
  });

  it("returns null for an unrecognized element type", () => {
    const result = resolveDragEndInsertion({
      active: { data: { current: { elementType: "video" } } },
      over: null,
    });

    expect(result).toBeNull();
  });

  it("returns null when the drag carried no payload at all", () => {
    const result = resolveDragEndInsertion({
      active: { data: { current: undefined } },
      over: null,
    });

    expect(result).toBeNull();
  });

  it("converts a numeric droppable id to a string", () => {
    const result = resolveDragEndInsertion({
      active: { data: { current: { elementType: "image" } } },
      over: { id: 42 },
    });

    expect(result).toEqual({ elementType: "image", targetParentId: "42" });
  });
});

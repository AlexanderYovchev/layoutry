import { describe, expect, it } from "vitest";
import {
  clampSpacingValue,
  edgeValuesEqual,
  getElementSpacing,
  hasAuthoredEdge,
  uniformEdges,
  withEdgeSide,
  withSpacingBox,
} from "@/features/editor/types/spacing";

describe("clampSpacingValue", () => {
  it("passes through a value already within range", () => {
    expect(clampSpacingValue(24)).toBe(24);
  });

  it("keeps 0 as a real value", () => {
    expect(clampSpacingValue(0)).toBe(0);
  });

  it("floors at 0", () => {
    expect(clampSpacingValue(-10)).toBe(0);
  });

  it("ceilings at 500", () => {
    expect(clampSpacingValue(9999)).toBe(500);
  });

  it("rejects NaN", () => {
    expect(clampSpacingValue(NaN)).toBeNull();
  });

  it("rejects Infinity", () => {
    expect(clampSpacingValue(Infinity)).toBeNull();
  });
});

describe("getElementSpacing", () => {
  it("returns empty (unset) boxes when the node has no spacing", () => {
    expect(getElementSpacing({})).toEqual({ margin: {}, padding: {} });
  });

  it("returns the node's own boxes when set", () => {
    const margin = { top: 1, right: 2, bottom: 3, left: 4 };
    const padding = { left: 0 };
    const resolved = getElementSpacing({ spacing: { margin, padding } });
    expect(resolved.margin).toBe(margin);
    expect(resolved.padding).toBe(padding);
  });

  it("fills a missing box with an empty one", () => {
    expect(getElementSpacing({ spacing: { padding: { top: 4 } } })).toEqual({ margin: {}, padding: { top: 4 } });
  });
});

describe("hasAuthoredEdge (BC-05.3)", () => {
  it("counts an authored 0 as authored", () => {
    expect(hasAuthoredEdge({ left: 0 })).toBe(true);
  });

  it("is false for an empty or missing box", () => {
    expect(hasAuthoredEdge({})).toBe(false);
    expect(hasAuthoredEdge(undefined)).toBe(false);
  });
});

describe("withEdgeSide", () => {
  it("authors one side and leaves the others unset", () => {
    expect(withEdgeSide(undefined, "left", 0)).toEqual({ left: 0 });
  });

  it("changes one side and keeps the others", () => {
    expect(withEdgeSide({ top: 4, left: 0 }, "left", 12)).toEqual({ top: 4, left: 12 });
  });

  it("removes one side and keeps the others", () => {
    expect(withEdgeSide({ top: 4, left: 0 }, "left", undefined)).toEqual({ top: 4 });
  });

  it("collapses to undefined once no side is left", () => {
    expect(withEdgeSide({ left: 0 }, "left", undefined)).toBeUndefined();
  });

  it("never mutates its input", () => {
    const edges = { top: 4 };
    withEdgeSide(edges, "top", undefined);
    expect(edges).toEqual({ top: 4 });
  });
});

describe("withSpacingBox", () => {
  it("replaces one box and keeps the other", () => {
    expect(withSpacingBox({ margin: { top: 1 }, padding: { top: 2 } }, "padding", { left: 0 })).toEqual({
      margin: { top: 1 },
      padding: { left: 0 },
    });
  });

  it("removes a box but keeps the record, even when it ends up empty", () => {
    expect(withSpacingBox({ padding: { top: 2 } }, "padding", undefined)).toEqual({});
    expect(withSpacingBox({ padding: { top: 2 } }, "padding", {})).toEqual({});
  });

  it("creates the record for a node that had none", () => {
    expect(withSpacingBox(undefined, "margin", { bottom: 0 })).toEqual({ margin: { bottom: 0 } });
  });
});

describe("edgeValuesEqual", () => {
  it("treats unset and 0 as different", () => {
    expect(edgeValuesEqual({}, { top: 0 })).toBe(false);
    expect(edgeValuesEqual(undefined, uniformEdges(0))).toBe(false);
  });

  it("treats a missing box and an empty one as equal", () => {
    expect(edgeValuesEqual(undefined, {})).toBe(true);
  });

  it("compares side by side", () => {
    expect(edgeValuesEqual(uniformEdges(4), { top: 4, right: 4, bottom: 4, left: 4 })).toBe(true);
  });
});

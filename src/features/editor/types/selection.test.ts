import { describe, expect, it } from "vitest";
import {
  addSelectionId,
  createSelection,
  EMPTY_SELECTION,
  isNodeSelected,
  normalizeSelection,
  selectionFromSingle,
  selectRange,
  toggleSelectionId,
} from "./selection";

describe("selectionFromSingle", () => {
  it("selects exactly one id as both member and primary", () => {
    expect(selectionFromSingle("a")).toEqual({ ids: ["a"], primaryId: "a" });
  });

  it("returns the empty selection for null", () => {
    expect(selectionFromSingle(null)).toEqual(EMPTY_SELECTION);
    expect(selectionFromSingle(null).ids).toEqual([]);
  });
});

describe("isNodeSelected", () => {
  it("true for a member, false otherwise", () => {
    const selection = { ids: ["a", "b"], primaryId: "b" };
    expect(isNodeSelected(selection, "a")).toBe(true);
    expect(isNodeSelected(selection, "c")).toBe(false);
  });
});

describe("toggleSelectionId (Ctrl/Cmd+click)", () => {
  it("adds an unselected id and makes it primary", () => {
    const result = toggleSelectionId({ ids: ["a"], primaryId: "a" }, "b");
    expect(result).toEqual({ ids: ["a", "b"], primaryId: "b" });
  });

  it("removes an already-selected id", () => {
    const result = toggleSelectionId({ ids: ["a", "b"], primaryId: "b" }, "b");
    expect(result.ids).toEqual(["a"]);
  });

  it("reassigns primary to the new last-remaining member when the removed id was primary", () => {
    const result = toggleSelectionId({ ids: ["a", "b", "c"], primaryId: "c" }, "c");
    expect(result).toEqual({ ids: ["a", "b"], primaryId: "b" });
  });

  it("leaves primary untouched when removing a non-primary member", () => {
    const result = toggleSelectionId({ ids: ["a", "b", "c"], primaryId: "c" }, "a");
    expect(result).toEqual({ ids: ["b", "c"], primaryId: "c" });
  });

  it("returns the empty selection when removing the last member", () => {
    const result = toggleSelectionId({ ids: ["a"], primaryId: "a" }, "a");
    expect(result).toEqual(EMPTY_SELECTION);
  });

  it("never duplicates a member already present", () => {
    const result = toggleSelectionId({ ids: ["a"], primaryId: "a" }, "b");
    expect(new Set(result.ids).size).toBe(result.ids.length);
  });
});

describe("addSelectionId (Shift+click on Canvas — additive, never a toggle)", () => {
  it("adds an unselected id and makes it primary", () => {
    const result = addSelectionId({ ids: ["a"], primaryId: "a" }, "b");
    expect(result).toEqual({ ids: ["a", "b"], primaryId: "b" });
  });

  it("leaves an already-selected id selected (does not remove it) but updates primary to it", () => {
    const result = addSelectionId({ ids: ["a", "b"], primaryId: "a" }, "b");
    expect(result).toEqual({ ids: ["a", "b"], primaryId: "b" });
  });

  it("never duplicates a member", () => {
    const result = addSelectionId({ ids: ["a", "b"], primaryId: "a" }, "b");
    expect(result.ids).toEqual(["a", "b"]);
  });
});

describe("createSelection", () => {
  it("de-duplicates and defaults primary to the last unique id", () => {
    expect(createSelection(["a", "b", "a"])).toEqual({ ids: ["a", "b"], primaryId: "b" });
  });

  it("respects an explicit primaryId when it's a member", () => {
    expect(createSelection(["a", "b", "c"], "a")).toEqual({ ids: ["a", "b", "c"], primaryId: "a" });
  });

  it("falls back to the last id when the requested primaryId isn't a member", () => {
    expect(createSelection(["a", "b"], "not-a-member")).toEqual({ ids: ["a", "b"], primaryId: "b" });
  });

  it("returns the empty selection for an empty id list", () => {
    expect(createSelection([])).toEqual(EMPTY_SELECTION);
  });
});

describe("normalizeSelection (stale-id reconciliation)", () => {
  it("drops ids no longer present in the document", () => {
    const result = normalizeSelection({ ids: ["a", "b", "c"], primaryId: "b" }, new Set(["a", "c"]));
    expect(result.ids).toEqual(["a", "c"]);
  });

  it("reassigns primary to the last surviving id when the primary itself was dropped", () => {
    const result = normalizeSelection({ ids: ["a", "b", "c"], primaryId: "b" }, new Set(["a", "c"]));
    expect(result.primaryId).toBe("c");
  });

  it("returns the empty selection when every id is stale", () => {
    const result = normalizeSelection({ ids: ["a", "b"], primaryId: "a" }, new Set(["z"]));
    expect(result).toEqual(EMPTY_SELECTION);
  });

  it("returns the identical reference when nothing is stale (no unnecessary re-render)", () => {
    const selection = { ids: ["a", "b"], primaryId: "a" };
    expect(normalizeSelection(selection, new Set(["a", "b", "c"]))).toBe(selection);
  });
});

describe("selectRange — Structure panel Shift+click (BC-10.2)", () => {
  // Visible rows in order; a collapsed container's children are simply absent.
  const rows = ["a", "b", "b1", "b2", "c", "d"];
  const one = (id: string) => ({ ids: [id], primaryId: id });

  it("selects the contiguous visible range from the anchor to the clicked row, either direction", () => {
    expect(selectRange(one("b"), "b", "c", rows, false).selection).toEqual({ ids: ["b", "b1", "b2", "c"], primaryId: "c" });
    expect(selectRange(one("c"), "c", "a", rows, false).selection).toEqual({ ids: ["a", "b", "b1", "b2", "c"], primaryId: "a" });
  });

  it("keeps the anchor, so a second Shift+click re-ranges from it", () => {
    const first = selectRange(one("b"), "b", "d", rows, false);
    const second = selectRange(first.selection, first.anchorId, "b1", rows, false);
    expect(second.anchorId).toBe("b");
    expect(second.selection.ids).toEqual(["b", "b1"]);
  });

  it("Ctrl/Cmd+Shift adds the range without removing the existing selection", () => {
    const result = selectRange({ ids: ["a", "d"], primaryId: "d" }, "d", "b1", rows, true);
    expect(result.selection).toEqual({ ids: ["a", "d", "b1", "b2", "c"], primaryId: "b1" });
  });

  it("only visible rows are ranged: a collapsed container's hidden children are never selected", () => {
    const collapsed = ["a", "b", "c", "d"];
    expect(selectRange(one("a"), "a", "c", collapsed, false).selection.ids).toEqual(["a", "b", "c"]);
  });

  it("an anchor that is no longer selected falls back to the primary, then to the clicked row", () => {
    expect(selectRange({ ids: ["c"], primaryId: "c" }, "a", "d", rows, false).selection.ids).toEqual(["c", "d"]);
    expect(selectRange({ ids: [] }, "a", "b1", rows, false)).toEqual({ selection: { ids: ["b1"], primaryId: "b1" }, anchorId: "b1" });
    // An anchor hidden by collapsing is not usable either.
    expect(selectRange({ ids: ["b1", "c"], primaryId: "c" }, "b1", "d", ["a", "b", "c", "d"], false).selection.ids).toEqual(["c", "d"]);
  });

  it("a click outside the visible rows changes nothing", () => {
    const selection = one("a");
    expect(selectRange(selection, "a", "zz", rows, false).selection).toBe(selection);
  });
});

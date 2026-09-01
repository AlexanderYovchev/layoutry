import { describe, expect, it } from "vitest";
import {
  addSelectionId,
  createSelection,
  EMPTY_SELECTION,
  isNodeSelected,
  normalizeSelection,
  selectionFromSingle,
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

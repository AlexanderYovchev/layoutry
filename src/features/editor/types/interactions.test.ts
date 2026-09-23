import { describe, expect, it } from "vitest";
import { getInteractions, withInteractions } from "./interactions";

describe("getInteractions", () => {
  it("returns an empty array for a node with no interactions field", () => {
    expect(getInteractions({})).toEqual([]);
  });

  it("returns the node's own interactions array unchanged when present", () => {
    const interactions = [{ id: "int-1", trigger: "click" as const, action: "toggle" as const, targetId: "target-1" }];
    expect(getInteractions({ interactions })).toBe(interactions);
  });
});

describe("withInteractions", () => {
  it("normalizes an empty list back to undefined, never a stray []", () => {
    expect(withInteractions([])).toBeUndefined();
  });

  it("returns the list unchanged when non-empty", () => {
    const interactions = [{ id: "int-1", trigger: "click" as const, action: "show" as const, targetId: "target-1" }];
    expect(withInteractions(interactions)).toBe(interactions);
  });
});

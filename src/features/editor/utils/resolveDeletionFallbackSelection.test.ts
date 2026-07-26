import { describe, expect, it } from "vitest";
import { resolveDeletionFallbackSelection } from "./resolveDeletionFallbackSelection";

describe("resolveDeletionFallbackSelection", () => {
  it("selects the removed node's former parent", () => {
    expect(resolveDeletionFallbackSelection("section-1", "page-root")).toBe("section-1");
  });

  it("clears selection when the former parent was the document root", () => {
    expect(resolveDeletionFallbackSelection("page-root", "page-root")).toBeNull();
  });

  it("clears selection when there was no parent at all", () => {
    expect(resolveDeletionFallbackSelection(null, "page-root")).toBeNull();
  });
});

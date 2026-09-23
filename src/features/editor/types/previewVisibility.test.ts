import { describe, expect, it } from "vitest";
import { getInitialPreviewVisibility } from "./previewVisibility";

describe("getInitialPreviewVisibility (Checkpoint 1.15.6.8.1)", () => {
  it("defaults to visible when the field is unset — the only state every pre-1.15.6.8.1 node has", () => {
    expect(getInitialPreviewVisibility({})).toBe("visible");
  });

  it("returns an explicit visible unchanged", () => {
    expect(getInitialPreviewVisibility({ initialPreviewVisibility: "visible" })).toBe("visible");
  });

  it("returns an explicit hidden unchanged", () => {
    expect(getInitialPreviewVisibility({ initialPreviewVisibility: "hidden" })).toBe("hidden");
  });
});

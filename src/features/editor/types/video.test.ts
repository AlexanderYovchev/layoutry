import { describe, expect, it } from "vitest";
import { getVideoControls } from "./video";

describe("getVideoControls (Checkpoint 1.15)", () => {
  it("defaults to true when unset — a freshly created Video is still usable on the Canvas", () => {
    expect(getVideoControls({})).toBe(true);
    expect(getVideoControls({ controls: undefined })).toBe(true);
  });

  it("returns the explicit stored value when set", () => {
    expect(getVideoControls({ controls: true })).toBe(true);
    expect(getVideoControls({ controls: false })).toBe(false);
  });
});

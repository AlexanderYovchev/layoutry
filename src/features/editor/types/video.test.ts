import { describe, expect, it } from "vitest";
import { getMediaControls } from "./video";

describe("getMediaControls (Checkpoint 1.15, renamed from getVideoControls in 1.15.6.12.3)", () => {
  it("defaults to true when unset — a freshly created Video/Audio is still usable on the Canvas", () => {
    expect(getMediaControls({})).toBe(true);
    expect(getMediaControls({ controls: undefined })).toBe(true);
  });

  it("returns the explicit stored value when set", () => {
    expect(getMediaControls({ controls: true })).toBe(true);
    expect(getMediaControls({ controls: false })).toBe(false);
  });
});

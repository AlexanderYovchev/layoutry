import { describe, expect, it } from "vitest";
import { getMediaFitSettings } from "./mediaFit";

describe("getMediaFitSettings", () => {
  it("defaults to contain/center/preserveAspectRatio:true when unset", () => {
    expect(getMediaFitSettings({})).toEqual({
      fit: "contain",
      position: "center",
      preserveAspectRatio: true,
    });
  });

  it("returns the node's own explicit settings when set", () => {
    const mediaFit = { fit: "cover" as const, position: "top" as const, preserveAspectRatio: true };
    expect(getMediaFitSettings({ mediaFit })).toEqual(mediaFit);
  });

  it("does not fill in defaults for a partial-looking but fully-set object (settings are always stored whole)", () => {
    const mediaFit = { fit: "fill" as const, position: "bottom" as const, preserveAspectRatio: false };
    expect(getMediaFitSettings({ mediaFit })).toBe(mediaFit);
  });
});

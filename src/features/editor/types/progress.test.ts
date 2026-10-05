import { describe, expect, it } from "vitest";
import { DEFAULT_PROGRESS_MAX, getProgressMax, getProgressValue, isProgressIndeterminate } from "./progress";

describe("getProgressMax (Checkpoint 1.15.6.12.4)", () => {
  it("returns the stored value when positive and finite", () => {
    expect(getProgressMax({ progressMax: 50 })).toBe(50);
  });

  it("falls back to DEFAULT_PROGRESS_MAX (100) when unset", () => {
    expect(getProgressMax({})).toBe(DEFAULT_PROGRESS_MAX);
    expect(getProgressMax({ progressMax: undefined })).toBe(100);
  });

  it("falls back to DEFAULT_PROGRESS_MAX for malformed data — zero, negative, NaN", () => {
    expect(getProgressMax({ progressMax: 0 })).toBe(100);
    expect(getProgressMax({ progressMax: -5 })).toBe(100);
    expect(getProgressMax({ progressMax: NaN })).toBe(100);
  });
});

describe("getProgressValue (Checkpoint 1.15.6.12.4)", () => {
  it("returns undefined for a genuinely indeterminate node", () => {
    expect(getProgressValue({})).toBeUndefined();
    expect(getProgressValue({ progressValue: undefined })).toBeUndefined();
  });

  it("returns the stored value when within range", () => {
    expect(getProgressValue({ progressValue: 50, progressMax: 100 })).toBe(50);
  });

  it("clamps an out-of-range stored value to [0, effective max] rather than throwing", () => {
    expect(getProgressValue({ progressValue: 150, progressMax: 100 })).toBe(100);
    expect(getProgressValue({ progressValue: -10, progressMax: 100 })).toBe(0);
  });

  it("clamps against the effective (fallback) max when progressMax is unset", () => {
    expect(getProgressValue({ progressValue: 150 })).toBe(100);
  });

  it("returns undefined for a malformed (NaN) stored value rather than clamping it", () => {
    expect(getProgressValue({ progressValue: NaN })).toBeUndefined();
  });
});

describe("isProgressIndeterminate (Checkpoint 1.15.6.12.4)", () => {
  it("is true exactly when progressValue is undefined — the single source of truth", () => {
    expect(isProgressIndeterminate({})).toBe(true);
    expect(isProgressIndeterminate({ progressValue: undefined })).toBe(true);
    expect(isProgressIndeterminate({ progressValue: 0 })).toBe(false);
    expect(isProgressIndeterminate({ progressValue: 50 })).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  getTransformSettings,
  hasNonIdentityRotateOrScale,
  isValidTransformRotateDeg,
  isValidTransformScale,
  isValidTransformTranslate,
  normalizeTransformSettings,
  transformSettingsEqual,
  withTransformField,
} from "./transform";

describe("getTransformSettings", () => {
  it("returns undefined for a node with no authored Transform", () => {
    expect(getTransformSettings({})).toBeUndefined();
  });

  it("returns the node's own Transform when present", () => {
    expect(getTransformSettings({ transform: { rotateDeg: 15 } })).toEqual({ rotateDeg: 15 });
  });
});

describe("normalizeTransformSettings", () => {
  it("returns undefined for undefined input", () => {
    expect(normalizeTransformSettings(undefined)).toBeUndefined();
  });

  it("strips every identity-valued field", () => {
    expect(normalizeTransformSettings({ translateX: 0, translateY: 0, rotateDeg: 0, scale: 1 })).toBeUndefined();
  });

  it("keeps only the non-identity fields", () => {
    expect(normalizeTransformSettings({ translateX: 20, translateY: 0, rotateDeg: 0, scale: 1 })).toEqual({ translateX: 20 });
  });

  it("keeps a non-identity scale, including zero and negative", () => {
    expect(normalizeTransformSettings({ scale: 0 })).toEqual({ scale: 0 });
    expect(normalizeTransformSettings({ scale: -1 })).toEqual({ scale: -1 });
  });

  it("keeps rotateDeg: 360 unchanged (never normalized modulo 360)", () => {
    expect(normalizeTransformSettings({ rotateDeg: 360 })).toEqual({ rotateDeg: 360 });
  });
});

describe("withTransformField", () => {
  it("creates a new settings object from undefined", () => {
    expect(withTransformField(undefined, "rotateDeg", 15)).toEqual({ rotateDeg: 15 });
  });

  it("merges a field without touching others", () => {
    const current = { translateX: 20, rotateDeg: 10 };
    expect(withTransformField(current, "scale", 1.5)).toEqual({ translateX: 20, rotateDeg: 10, scale: 1.5 });
  });

  it("setting a field back to its identity value removes just that field", () => {
    const current = { translateX: 20, rotateDeg: 10 };
    expect(withTransformField(current, "rotateDeg", 0)).toEqual({ translateX: 20 });
  });

  it("collapses to undefined once the last meaningful field returns to identity", () => {
    expect(withTransformField({ rotateDeg: 10 }, "rotateDeg", 0)).toBeUndefined();
  });
});

describe("numeric validation", () => {
  it.each([NaN, Infinity, -Infinity])("rejects %s for translate/rotate/scale", (value) => {
    expect(isValidTransformTranslate(value)).toBe(false);
    expect(isValidTransformRotateDeg(value)).toBe(false);
    expect(isValidTransformScale(value)).toBe(false);
  });

  it("accepts any finite translate, including negative", () => {
    expect(isValidTransformTranslate(-20)).toBe(true);
    expect(isValidTransformTranslate(0)).toBe(true);
  });

  it("accepts any finite rotation, including 360 and negative", () => {
    expect(isValidTransformRotateDeg(360)).toBe(true);
    expect(isValidTransformRotateDeg(-15)).toBe(true);
  });

  it("accepts zero and negative scale (deliberately not rejected — see this file's own top comment)", () => {
    expect(isValidTransformScale(0)).toBe(true);
    expect(isValidTransformScale(-1)).toBe(true);
  });
});

describe("transformSettingsEqual", () => {
  it("treats undefined and an all-identity object as equal", () => {
    expect(transformSettingsEqual(undefined, { translateX: 0, scale: 1 })).toBe(true);
  });

  it("treats two differently-shaped but equivalent objects as equal", () => {
    expect(transformSettingsEqual({ rotateDeg: 15, scale: 1 }, { rotateDeg: 15 })).toBe(true);
  });

  it("detects a real difference", () => {
    expect(transformSettingsEqual({ rotateDeg: 15 }, { rotateDeg: 20 })).toBe(false);
  });
});

describe("hasNonIdentityRotateOrScale", () => {
  it("is false for undefined", () => {
    expect(hasNonIdentityRotateOrScale(undefined)).toBe(false);
  });

  it("is false for translate-only", () => {
    expect(hasNonIdentityRotateOrScale({ translateX: 50, translateY: 10 })).toBe(false);
  });

  it("is true when rotateDeg is present", () => {
    expect(hasNonIdentityRotateOrScale({ rotateDeg: 15 })).toBe(true);
  });

  it("is true when scale is present (including 0/negative)", () => {
    expect(hasNonIdentityRotateOrScale({ scale: 0 })).toBe(true);
    expect(hasNonIdentityRotateOrScale({ scale: -1 })).toBe(true);
  });
});

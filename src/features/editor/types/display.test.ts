import { describe, expect, it } from "vitest";
import {
  getDisplaySettings,
  isValidCursorValue,
  isValidDisplayFieldValue,
  isValidDisplayValue,
  isValidOverflowValue,
  isValidPointerEventsValue,
  isValidUserSelectValue,
  isValidVisibilityValue,
  overflowAxesEqual,
  withAllOverflow,
  withDisplayField,
  withOverflowAxis,
  CURSOR_VALUES,
  DISPLAY_VALUES,
  OVERFLOW_VALUES,
  POINTER_EVENTS_VALUES,
  USER_SELECT_VALUES,
  VISIBILITY_VALUES,
} from "./display";

describe("display model", () => {
  describe("getDisplaySettings", () => {
    it("returns an empty object for a node with no display settings", () => {
      expect(getDisplaySettings({})).toEqual({});
    });

    it("returns the node's own display settings when present", () => {
      const display = { display: "none" as const };
      expect(getDisplaySettings({ display })).toBe(display);
    });
  });

  describe("withDisplayField", () => {
    it("sets a field on an empty settings object", () => {
      expect(withDisplayField({}, "display", "block")).toEqual({ display: "block" });
    });

    it("preserves other fields when setting one", () => {
      const current = { display: "block" as const, visibility: "hidden" as const };
      expect(withDisplayField(current, "cursor", "pointer")).toEqual({
        display: "block",
        visibility: "hidden",
        cursor: "pointer",
      });
    });

    it("clears exactly one field when passed undefined", () => {
      const current = { display: "block" as const, visibility: "hidden" as const };
      expect(withDisplayField(current, "display", undefined)).toEqual({ visibility: "hidden" });
    });

    it("collapses to undefined once every field has been cleared", () => {
      expect(withDisplayField({ display: "block" }, "display", undefined)).toBeUndefined();
    });
  });

  describe("value validators", () => {
    it("accepts every documented display value and rejects an unknown one", () => {
      for (const value of DISPLAY_VALUES) expect(isValidDisplayValue(value)).toBe(true);
      expect(isValidDisplayValue("flex")).toBe(false);
      expect(isValidDisplayValue("grid")).toBe(false);
    });

    it("accepts every documented visibility value and rejects an unknown one", () => {
      for (const value of VISIBILITY_VALUES) expect(isValidVisibilityValue(value)).toBe(true);
      expect(isValidVisibilityValue("collapse")).toBe(false);
    });

    it("accepts every documented overflow value (including clip, added Checkpoint 5.4) and rejects an unknown one", () => {
      for (const value of OVERFLOW_VALUES) expect(isValidOverflowValue(value)).toBe(true);
      expect(OVERFLOW_VALUES).toContain("clip");
      expect(isValidOverflowValue("overlay")).toBe(false);
      expect(isValidOverflowValue("inherit")).toBe(false);
    });

    it("accepts every documented pointer-events value and rejects an unknown one", () => {
      for (const value of POINTER_EVENTS_VALUES) expect(isValidPointerEventsValue(value)).toBe(true);
      expect(isValidPointerEventsValue("all")).toBe(false);
    });

    it("accepts every documented cursor value and rejects an unknown one", () => {
      for (const value of CURSOR_VALUES) expect(isValidCursorValue(value)).toBe(true);
      expect(isValidCursorValue("zoom-in")).toBe(false);
    });

    it("accepts every documented user-select value and rejects an unknown one", () => {
      for (const value of USER_SELECT_VALUES) expect(isValidUserSelectValue(value)).toBe(true);
      expect(isValidUserSelectValue("contain")).toBe(false);
    });
  });

  describe("isValidDisplayFieldValue", () => {
    it("validates each field against its own value set", () => {
      expect(isValidDisplayFieldValue("display", "inline-block")).toBe(true);
      expect(isValidDisplayFieldValue("display", "flex")).toBe(false);
      expect(isValidDisplayFieldValue("overflow", "clip")).toBe(true);
      expect(isValidDisplayFieldValue("overflowX", "auto")).toBe(true);
      expect(isValidDisplayFieldValue("overflowY", "scroll")).toBe(true);
      expect(isValidDisplayFieldValue("pointerEvents", "none")).toBe(true);
    });

    it("rejects a non-string value for every field", () => {
      expect(isValidDisplayFieldValue("display", 1)).toBe(false);
      expect(isValidDisplayFieldValue("display", null)).toBe(false);
      expect(isValidDisplayFieldValue("display", undefined)).toBe(false);
    });

    it("rejects an unknown field name", () => {
      expect(isValidDisplayFieldValue("position" as never, "block")).toBe(false);
    });
  });

  describe("overflowAxesEqual (Checkpoint 5.4)", () => {
    it("is true when both axes are genuinely unset", () => {
      expect(overflowAxesEqual({})).toBe(true);
    });

    it("is true when both axes hold the same value", () => {
      expect(overflowAxesEqual({ overflowX: "hidden", overflowY: "hidden" })).toBe(true);
    });

    it("is false when the axes differ", () => {
      expect(overflowAxesEqual({ overflowX: "hidden", overflowY: "auto" })).toBe(false);
    });

    it("is false when only one axis is set", () => {
      expect(overflowAxesEqual({ overflowX: "hidden" })).toBe(false);
    });

    it("is true whenever the unified overflow shorthand is present, regardless of any stale axis data", () => {
      expect(overflowAxesEqual({ overflow: "scroll" })).toBe(true);
      expect(overflowAxesEqual({ overflow: "scroll", overflowX: "hidden", overflowY: "auto" })).toBe(true);
    });
  });

  describe("withAllOverflow (Checkpoint 5.4)", () => {
    it("sets the unified overflow field on an empty settings object", () => {
      expect(withAllOverflow({}, "hidden")).toEqual({ overflow: "hidden" });
    });

    it("clears any pre-existing overflowX/overflowY when setting the unified value", () => {
      expect(withAllOverflow({ overflowX: "hidden", overflowY: "auto" }, "scroll")).toEqual({ overflow: "scroll" });
    });

    it("clears overflow (and any stale axis data) back to genuinely absent when value is undefined", () => {
      expect(withAllOverflow({ overflow: "hidden" }, undefined)).toBeUndefined();
      expect(withAllOverflow({ overflowX: "hidden", overflowY: "auto" }, undefined)).toBeUndefined();
    });

    it("preserves unrelated Display fields", () => {
      expect(withAllOverflow({ display: "block", cursor: "pointer" }, "clip")).toEqual({
        display: "block",
        cursor: "pointer",
        overflow: "clip",
      });
    });
  });

  describe("withOverflowAxis (Checkpoint 5.4)", () => {
    it("sets exactly one axis on an empty settings object", () => {
      expect(withOverflowAxis({}, "overflowX", "hidden")).toEqual({ overflowX: "hidden" });
    });

    it("leaves the other axis untouched when both already hold independent longhand data", () => {
      expect(withOverflowAxis({ overflowX: "hidden", overflowY: "auto" }, "overflowX", "scroll")).toEqual({
        overflowX: "scroll",
        overflowY: "auto",
      });
    });

    it("clears the unified overflow shorthand once any axis is committed independently", () => {
      expect(withOverflowAxis({ overflow: "hidden", overflowY: "hidden" }, "overflowX", "auto")).toEqual({
        overflowX: "auto",
        overflowY: "hidden",
      });
    });

    it("seeds the untouched axis from the prior unified value, so it isn't silently lost", () => {
      expect(withOverflowAxis({ overflow: "hidden" }, "overflowX", "auto")).toEqual({
        overflowX: "auto",
        overflowY: "hidden",
      });
      expect(withOverflowAxis({ overflow: "hidden" }, "overflowY", "scroll")).toEqual({
        overflowX: "hidden",
        overflowY: "scroll",
      });
    });

    it("resets exactly one axis, seeding the other from a prior shorthand value first", () => {
      expect(withOverflowAxis({ overflow: "hidden" }, "overflowX", undefined)).toEqual({ overflowY: "hidden" });
    });

    it("collapses to undefined once every field has been cleared", () => {
      expect(withOverflowAxis({ overflowX: "hidden" }, "overflowX", undefined)).toBeUndefined();
    });

    it("preserves unrelated Display fields", () => {
      expect(withOverflowAxis({ display: "block", overflowY: "auto" }, "overflowX", "hidden")).toEqual({
        display: "block",
        overflowX: "hidden",
        overflowY: "auto",
      });
    });
  });
});

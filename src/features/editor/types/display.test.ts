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
  withDisplayField,
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

    it("accepts every documented overflow value and rejects an unknown one", () => {
      for (const value of OVERFLOW_VALUES) expect(isValidOverflowValue(value)).toBe(true);
      expect(isValidOverflowValue("clip")).toBe(false);
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
});

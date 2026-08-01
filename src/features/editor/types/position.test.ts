import { describe, expect, it } from "vitest";
import {
  getPositionSettings,
  isValidPositionFieldValue,
  isValidPositionValue,
  withPositionField,
  POSITION_VALUES,
} from "./position";

describe("position model", () => {
  describe("getPositionSettings", () => {
    it("returns an empty object for a node with no position settings", () => {
      expect(getPositionSettings({})).toEqual({});
    });

    it("returns the node's own position settings when present", () => {
      const position = { position: "absolute" as const };
      expect(getPositionSettings({ position })).toBe(position);
    });
  });

  describe("withPositionField", () => {
    it("sets a field on an empty settings object", () => {
      expect(withPositionField({}, "position", "relative")).toEqual({ position: "relative" });
    });

    it("overwrites the field when it was already set", () => {
      expect(withPositionField({ position: "relative" }, "position", "fixed")).toEqual({ position: "fixed" });
    });

    it("clears the field when passed undefined", () => {
      expect(withPositionField({ position: "sticky" }, "position", undefined)).toBeUndefined();
    });

    it("collapses to undefined once every field has been cleared", () => {
      expect(withPositionField({ position: "static" }, "position", undefined)).toBeUndefined();
    });
  });

  describe("value validators", () => {
    it("accepts every documented position value and rejects an unknown one", () => {
      for (const value of POSITION_VALUES) expect(isValidPositionValue(value)).toBe(true);
      expect(isValidPositionValue("inherit")).toBe(false);
      expect(isValidPositionValue("initial")).toBe(false);
      expect(isValidPositionValue("")).toBe(false);
    });
  });

  describe("isValidPositionFieldValue", () => {
    it("validates the position field against its own value set", () => {
      expect(isValidPositionFieldValue("position", "absolute")).toBe(true);
      expect(isValidPositionFieldValue("position", "sticky")).toBe(true);
      expect(isValidPositionFieldValue("position", "fixed-ish")).toBe(false);
    });

    it("rejects a non-string value", () => {
      expect(isValidPositionFieldValue("position", 1)).toBe(false);
      expect(isValidPositionFieldValue("position", null)).toBe(false);
      expect(isValidPositionFieldValue("position", undefined)).toBe(false);
    });

    it("rejects an unknown field name", () => {
      expect(isValidPositionFieldValue("zIndex" as never, "1")).toBe(false);
    });
  });
});

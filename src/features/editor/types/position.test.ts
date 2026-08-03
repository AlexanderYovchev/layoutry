import { describe, expect, it } from "vitest";
import {
  formatOffsetValue,
  getPositionSettings,
  isValidOffsetValue,
  isValidPositionFieldValue,
  isValidPositionValue,
  isValidZIndexValue,
  offsetsApply,
  offsetSidesEqual,
  withAllOffsets,
  withPositionField,
  OFFSET_SIDES,
  OFFSET_UNITS,
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

    it("rejects a non-string value for the position field", () => {
      expect(isValidPositionFieldValue("position", 1)).toBe(false);
      expect(isValidPositionFieldValue("position", null)).toBe(false);
      expect(isValidPositionFieldValue("position", undefined)).toBe(false);
    });

    it("validates each offset field via isValidOffsetValue", () => {
      expect(isValidPositionFieldValue("top", { value: 10, unit: "px" })).toBe(true);
      expect(isValidPositionFieldValue("right", "auto")).toBe(true);
      expect(isValidPositionFieldValue("bottom", "not-a-length")).toBe(false);
      expect(isValidPositionFieldValue("left", { value: "10", unit: "px" })).toBe(false);
    });

    it("validates the zIndex field via isValidZIndexValue", () => {
      expect(isValidPositionFieldValue("zIndex", "auto")).toBe(true);
      expect(isValidPositionFieldValue("zIndex", 10)).toBe(true);
      expect(isValidPositionFieldValue("zIndex", -1)).toBe(true);
      expect(isValidPositionFieldValue("zIndex", 5.5)).toBe(false);
      expect(isValidPositionFieldValue("zIndex", "5")).toBe(false);
    });

    it("rejects an unknown field name", () => {
      expect(isValidPositionFieldValue("opacity" as never, 1)).toBe(false);
    });
  });

  describe("offsetsApply", () => {
    it("is false for static and for an unset position", () => {
      expect(offsetsApply("static")).toBe(false);
      expect(offsetsApply(undefined)).toBe(false);
    });

    it("is true for relative, absolute, fixed, and sticky", () => {
      for (const value of ["relative", "absolute", "fixed", "sticky"] as const) {
        expect(offsetsApply(value)).toBe(true);
      }
    });
  });

  describe("OFFSET_SIDES / OFFSET_UNITS", () => {
    it("lists exactly the four inset sides", () => {
      expect(OFFSET_SIDES).toEqual(["top", "right", "bottom", "left"]);
    });

    it("supports exactly px, %, rem, and em", () => {
      expect(OFFSET_UNITS).toEqual(["px", "%", "rem", "em"]);
    });
  });

  describe("offsetSidesEqual", () => {
    it("is true when every side is identically absent", () => {
      expect(offsetSidesEqual({})).toBe(true);
    });

    it("is true when every side holds an identical length", () => {
      const value = { value: 10, unit: "px" as const };
      expect(offsetSidesEqual({ top: value, right: value, bottom: value, left: value })).toBe(true);
    });

    it("is true when every side is 'auto'", () => {
      expect(offsetSidesEqual({ top: "auto", right: "auto", bottom: "auto", left: "auto" })).toBe(true);
    });

    it("is false when one side differs in value", () => {
      const value = { value: 10, unit: "px" as const };
      expect(offsetSidesEqual({ top: value, right: value, bottom: value, left: { value: 20, unit: "px" } })).toBe(false);
    });

    it("is false when one side differs in unit only", () => {
      expect(
        offsetSidesEqual({
          top: { value: 10, unit: "px" },
          right: { value: 10, unit: "px" },
          bottom: { value: 10, unit: "px" },
          left: { value: 10, unit: "rem" },
        }),
      ).toBe(false);
    });

    it("distinguishes an unset side from an explicit 'auto' side", () => {
      expect(offsetSidesEqual({ top: "auto", right: undefined, bottom: "auto", left: "auto" })).toBe(false);
    });

    it("ignores the unrelated position field", () => {
      const value = { value: 5, unit: "%" as const };
      expect(offsetSidesEqual({ position: "absolute", top: value, right: value, bottom: value, left: value })).toBe(true);
    });
  });

  describe("withAllOffsets", () => {
    it("sets all four sides to the same value in one write", () => {
      const value = { value: 12, unit: "px" as const };
      expect(withAllOffsets({}, value)).toEqual({ top: value, right: value, bottom: value, left: value });
    });

    it("preserves the unrelated position field", () => {
      const value = { value: 12, unit: "px" as const };
      expect(withAllOffsets({ position: "absolute" }, value)).toEqual({
        position: "absolute",
        top: value,
        right: value,
        bottom: value,
        left: value,
      });
    });

    it("clears all four sides when passed undefined, preserving position", () => {
      const value = { value: 12, unit: "px" as const };
      expect(withAllOffsets({ position: "fixed", top: value, right: value, bottom: value, left: value }, undefined)).toEqual({
        position: "fixed",
      });
    });

    it("collapses to undefined when clearing leaves nothing behind", () => {
      const value = { value: 12, unit: "px" as const };
      expect(withAllOffsets({ top: value, right: value, bottom: value, left: value }, undefined)).toBeUndefined();
    });
  });

  describe("formatOffsetValue", () => {
    it("passes 'auto' through verbatim", () => {
      expect(formatOffsetValue("auto")).toBe("auto");
    });

    it("formats a length using the shared Length model", () => {
      expect(formatOffsetValue({ value: 10, unit: "px" })).toBe("10px");
      expect(formatOffsetValue({ value: 50, unit: "%" })).toBe("50%");
      expect(formatOffsetValue({ value: -4, unit: "rem" })).toBe("-4rem");
    });
  });

  describe("isValidOffsetValue", () => {
    it("accepts 'auto'", () => {
      expect(isValidOffsetValue("auto")).toBe(true);
    });

    it("accepts a well-formed length, including a negative one", () => {
      expect(isValidOffsetValue({ value: 10, unit: "px" })).toBe(true);
      expect(isValidOffsetValue({ value: -10, unit: "px" })).toBe(true);
      expect(isValidOffsetValue({ value: 0, unit: "%" })).toBe(true);
    });

    it("rejects a non-finite or non-numeric value", () => {
      expect(isValidOffsetValue({ value: Number.NaN, unit: "px" })).toBe(false);
      expect(isValidOffsetValue({ value: Number.POSITIVE_INFINITY, unit: "px" })).toBe(false);
      expect(isValidOffsetValue({ value: "10", unit: "px" })).toBe(false);
    });

    it("rejects a malformed shape", () => {
      expect(isValidOffsetValue(null)).toBe(false);
      expect(isValidOffsetValue(undefined)).toBe(false);
      expect(isValidOffsetValue("relative")).toBe(false);
      expect(isValidOffsetValue(10)).toBe(false);
      expect(isValidOffsetValue({ value: 10 })).toBe(false);
    });
  });

  describe("zIndex (Checkpoint 5.3)", () => {
    describe("isValidZIndexValue", () => {
      it("accepts 'auto'", () => {
        expect(isValidZIndexValue("auto")).toBe(true);
      });

      it("accepts zero", () => {
        expect(isValidZIndexValue(0)).toBe(true);
      });

      it("accepts positive safe integers", () => {
        expect(isValidZIndexValue(1)).toBe(true);
        expect(isValidZIndexValue(9999)).toBe(true);
        expect(isValidZIndexValue(Number.MAX_SAFE_INTEGER)).toBe(true);
      });

      it("accepts negative safe integers", () => {
        expect(isValidZIndexValue(-1)).toBe(true);
        expect(isValidZIndexValue(-9999)).toBe(true);
      });

      it("rejects decimals", () => {
        expect(isValidZIndexValue(1.5)).toBe(false);
        expect(isValidZIndexValue(-0.5)).toBe(false);
      });

      it("rejects NaN and Infinity", () => {
        expect(isValidZIndexValue(Number.NaN)).toBe(false);
        expect(isValidZIndexValue(Number.POSITIVE_INFINITY)).toBe(false);
        expect(isValidZIndexValue(Number.NEGATIVE_INFINITY)).toBe(false);
      });

      it("rejects an unsafe integer", () => {
        expect(isValidZIndexValue(Number.MAX_SAFE_INTEGER + 1)).toBe(false);
      });

      it("rejects numeric strings and other keywords", () => {
        expect(isValidZIndexValue("5")).toBe(false);
        expect(isValidZIndexValue("-1")).toBe(false);
        expect(isValidZIndexValue("initial")).toBe(false);
        expect(isValidZIndexValue("")).toBe(false);
      });

      it("rejects malformed values", () => {
        expect(isValidZIndexValue(null)).toBe(false);
        expect(isValidZIndexValue(undefined)).toBe(false);
        expect(isValidZIndexValue([])).toBe(false);
        expect(isValidZIndexValue({})).toBe(false);
        expect(isValidZIndexValue({ value: 5 })).toBe(false);
      });
    });

    describe("withPositionField", () => {
      it("sets zIndex to a number", () => {
        expect(withPositionField({}, "zIndex", 5)).toEqual({ zIndex: 5 });
      });

      it("sets zIndex to 'auto'", () => {
        expect(withPositionField({}, "zIndex", "auto")).toEqual({ zIndex: "auto" });
      });

      it("sets zIndex to a negative number", () => {
        expect(withPositionField({}, "zIndex", -3)).toEqual({ zIndex: -3 });
      });

      it("clears zIndex while preserving other fields", () => {
        expect(withPositionField({ position: "absolute", zIndex: 5 }, "zIndex", undefined)).toEqual({
          position: "absolute",
        });
      });

      it("preserves position and offsets when zIndex is set", () => {
        const top = { value: 10, unit: "px" as const };
        expect(withPositionField({ position: "absolute", top }, "zIndex", 5)).toEqual({
          position: "absolute",
          top,
          zIndex: 5,
        });
      });
    });
  });
});

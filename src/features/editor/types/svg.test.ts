import { describe, expect, it } from "vitest";
import {
  DEFAULT_SVG_VIEW_BOX,
  formatSvgViewBox,
  getSvgKind,
  isValidSvgPrimitiveKind,
  isValidSvgViewBox,
  resolveSvgFill,
  resolveSvgStroke,
  resolveSvgStrokeWidth,
  resolveSvgViewBox,
  SVG_PRIMITIVE_KINDS,
  type SvgViewBox,
} from "./svg";

describe("SVG Foundation model (Checkpoint 1.15.5)", () => {
  describe("getSvgKind", () => {
    it("resolves an unset field to the default Rectangle", () => {
      expect(getSvgKind({})).toBe("rectangle");
    });

    it("resolves an explicit valid kind", () => {
      expect(getSvgKind({ svgKind: "star" })).toBe("star");
    });

    it("resolves malformed/unrecognized loaded data to Rectangle rather than throwing", () => {
      const node = { svgKind: "not-a-real-kind" } as unknown as { svgKind?: "rectangle" };
      expect(getSvgKind(node)).toBe("rectangle");
    });
  });

  describe("isValidSvgPrimitiveKind", () => {
    it("accepts every listed kind and rejects garbage", () => {
      for (const kind of SVG_PRIMITIVE_KINDS) {
        expect(isValidSvgPrimitiveKind(kind)).toBe(true);
      }
      expect(isValidSvgPrimitiveKind("hexagon")).toBe(false);
      expect(isValidSvgPrimitiveKind(undefined)).toBe(false);
      expect(isValidSvgPrimitiveKind(42)).toBe(false);
    });
  });

  describe("isValidSvgViewBox", () => {
    it("accepts a normal viewBox, including a negative min", () => {
      expect(isValidSvgViewBox({ minX: -10, minY: -5, width: 100, height: 50 })).toBe(true);
    });

    it("rejects non-positive width/height", () => {
      expect(isValidSvgViewBox({ minX: 0, minY: 0, width: 0, height: 100 })).toBe(false);
      expect(isValidSvgViewBox({ minX: 0, minY: 0, width: 100, height: -1 })).toBe(false);
    });

    it("rejects malformed shapes", () => {
      expect(isValidSvgViewBox(null)).toBe(false);
      expect(isValidSvgViewBox("0 0 100 100")).toBe(false);
      expect(isValidSvgViewBox({ minX: 0, minY: 0, width: 100 })).toBe(false);
    });
  });

  describe("resolveSvgViewBox", () => {
    it("resolves an unset field to the default 0 0 100 100", () => {
      expect(resolveSvgViewBox({})).toEqual(DEFAULT_SVG_VIEW_BOX);
    });

    it("resolves a valid custom viewBox as-is", () => {
      const viewBox: SvgViewBox = { minX: -10, minY: -10, width: 120, height: 120 };
      expect(resolveSvgViewBox({ svgViewBox: viewBox })).toEqual(viewBox);
    });

    it("falls back to the default for malformed loaded data rather than crashing", () => {
      const node = { svgViewBox: { minX: 0, minY: 0, width: -5, height: 100 } };
      expect(resolveSvgViewBox(node)).toEqual(DEFAULT_SVG_VIEW_BOX);
    });
  });

  describe("formatSvgViewBox", () => {
    it("formats as \"minX minY width height\"", () => {
      expect(formatSvgViewBox({ minX: -10, minY: 0, width: 100, height: 50 })).toBe("-10 0 100 50");
    });
  });

  describe("resolveSvgFill", () => {
    it("resolves an unset fill to native SVG's own initial value (black)", () => {
      expect(resolveSvgFill({})).toBe("#000000");
    });

    it("resolves an explicit fill as-is", () => {
      expect(resolveSvgFill({ svgFill: "#ff0000" })).toBe("#ff0000");
    });
  });

  describe("resolveSvgStroke", () => {
    it("resolves an unset stroke to undefined (None)", () => {
      expect(resolveSvgStroke({})).toBeUndefined();
    });

    it("resolves an explicit stroke as-is", () => {
      expect(resolveSvgStroke({ svgStroke: "#0000ff" })).toBe("#0000ff");
    });
  });

  describe("resolveSvgStrokeWidth", () => {
    it("resolves an unset stroke width to native SVG's own initial value (1)", () => {
      expect(resolveSvgStrokeWidth({})).toBe(1);
    });

    it("resolves an explicit stroke width as-is", () => {
      expect(resolveSvgStrokeWidth({ svgStrokeWidth: 4 })).toBe(4);
    });
  });
});

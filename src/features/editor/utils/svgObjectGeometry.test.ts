import { describe, expect, it } from "vitest";
import {
  formatSvgPoints,
  getSvgObjectBounds,
  isDegenerateDrag,
  isDegenerateLine,
  isValidSvgPath,
  isValidSvgPolygon,
  normalizeDragToBounds,
  pathCommandsToD,
  resizeRectOrEllipseToBounds,
  roundSvgCoordinate,
  translateSvgObjectGeometry,
} from "./svgObjectGeometry";
import type {
  SvgEllipseObject,
  SvgLineObject,
  SvgPathObject,
  SvgPolygonObject,
  SvgRectObject,
} from "@/features/editor/types/svgScene";

const rect: SvgRectObject = { id: "r1", type: "rect", x: 10, y: 10, width: 80, height: 40 };
const ellipse: SvgEllipseObject = { id: "e1", type: "ellipse", cx: 50, cy: 50, rx: 40, ry: 20 };
const line: SvgLineObject = { id: "l1", type: "line", x1: 0, y1: 0, x2: 30, y2: 40 };
const polygon: SvgPolygonObject = {
  id: "p1",
  type: "polygon",
  points: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 5, y: 10 },
  ],
};
const path: SvgPathObject = {
  id: "path1",
  type: "path",
  commands: [
    { kind: "M", x: 0, y: 0 },
    { kind: "L", x: 10, y: 10 },
    { kind: "Z" },
  ],
};

describe("svgObjectGeometry", () => {
  describe("roundSvgCoordinate", () => {
    it("rounds to 2 decimal places", () => {
      expect(roundSvgCoordinate(37.492857192847)).toBe(37.49);
      expect(roundSvgCoordinate(10)).toBe(10);
    });
  });

  describe("getSvgObjectBounds", () => {
    it("computes bounds for a rect directly from its own fields", () => {
      expect(getSvgObjectBounds(rect)).toEqual({ x: 10, y: 10, width: 80, height: 40 });
    });

    it("computes bounds for an ellipse from its center/radii", () => {
      expect(getSvgObjectBounds(ellipse)).toEqual({ x: 10, y: 30, width: 80, height: 40 });
    });

    it("computes bounds for a line from its two endpoints", () => {
      expect(getSvgObjectBounds(line)).toEqual({ x: 0, y: 0, width: 30, height: 40 });
    });

    it("computes bounds for a polygon from its points", () => {
      expect(getSvgObjectBounds(polygon)).toEqual({ x: 0, y: 0, width: 10, height: 10 });
    });

    it("computes bounds for a path, ignoring Z commands", () => {
      expect(getSvgObjectBounds(path)).toEqual({ x: 0, y: 0, width: 10, height: 10 });
    });
  });

  describe("translateSvgObjectGeometry", () => {
    it("translates a rect", () => {
      expect(translateSvgObjectGeometry(rect, 5, -5)).toMatchObject({ x: 15, y: 5, width: 80, height: 40 });
    });

    it("translates an ellipse's center only", () => {
      expect(translateSvgObjectGeometry(ellipse, 5, 5)).toMatchObject({ cx: 55, cy: 55, rx: 40, ry: 20 });
    });

    it("translates both endpoints of a line", () => {
      expect(translateSvgObjectGeometry(line, 10, 10)).toMatchObject({ x1: 10, y1: 10, x2: 40, y2: 50 });
    });

    it("translates every point of a polygon", () => {
      const result = translateSvgObjectGeometry(polygon, 1, 1);
      expect(result.points).toEqual([
        { x: 1, y: 1 },
        { x: 11, y: 1 },
        { x: 6, y: 11 },
      ]);
    });

    it("translates every M/L command of a path, leaving Z untouched", () => {
      const result = translateSvgObjectGeometry(path, 2, 3);
      expect(result.commands).toEqual([
        { kind: "M", x: 2, y: 3 },
        { kind: "L", x: 12, y: 13 },
        { kind: "Z" },
      ]);
    });

    it("never mutates the original object", () => {
      const original = { ...rect };
      translateSvgObjectGeometry(rect, 5, 5);
      expect(rect).toEqual(original);
    });
  });

  describe("resizeRectOrEllipseToBounds", () => {
    it("resizes a rect directly to the given bounds", () => {
      const result = resizeRectOrEllipseToBounds(rect, { x: 0, y: 0, width: 100, height: 50 });
      expect(result).toMatchObject({ x: 0, y: 0, width: 100, height: 50 });
    });

    it("resizes an ellipse by deriving cx/cy/rx/ry from the bounds", () => {
      const result = resizeRectOrEllipseToBounds(ellipse, { x: 0, y: 0, width: 100, height: 50 });
      expect(result).toMatchObject({ cx: 50, cy: 25, rx: 50, ry: 25 });
    });

    it("floors width/height at the minimum rather than collapsing to zero", () => {
      const result = resizeRectOrEllipseToBounds(rect, { x: 10, y: 10, width: 0, height: 0 });
      expect(result.width).toBeGreaterThan(0);
      expect(result.height).toBeGreaterThan(0);
    });
  });

  describe("normalizeDragToBounds", () => {
    it("normalizes a forward drag", () => {
      expect(normalizeDragToBounds(10, 10, 50, 40)).toEqual({ x: 10, y: 10, width: 40, height: 30 });
    });

    it("normalizes a reverse-direction drag to the same non-negative bounds", () => {
      expect(normalizeDragToBounds(50, 40, 10, 10)).toEqual({ x: 10, y: 10, width: 40, height: 30 });
    });
  });

  describe("isDegenerateDrag / isDegenerateLine", () => {
    it("flags a tiny drag as degenerate", () => {
      expect(isDegenerateDrag({ x: 0, y: 0, width: 1, height: 1 })).toBe(true);
    });

    it("does not flag a normal-sized drag", () => {
      expect(isDegenerateDrag({ x: 0, y: 0, width: 20, height: 20 })).toBe(false);
    });

    it("flags a tiny line as degenerate", () => {
      expect(isDegenerateLine({ ...line, x1: 0, y1: 0, x2: 1, y2: 0 })).toBe(true);
    });

    it("does not flag a normal-length line", () => {
      expect(isDegenerateLine(line)).toBe(false);
    });
  });

  describe("formatSvgPoints / pathCommandsToD", () => {
    it("formats points as \"x,y x,y\"", () => {
      expect(formatSvgPoints(polygon.points)).toBe("0,0 10,0 5,10");
    });

    it("derives a d string from structured commands", () => {
      expect(pathCommandsToD(path.commands)).toBe("M 0 0 L 10 10 Z");
    });
  });

  describe("isValidSvgPolygon / isValidSvgPath", () => {
    it("requires at least 3 points for a polygon", () => {
      expect(isValidSvgPolygon(polygon.points)).toBe(true);
      expect(isValidSvgPolygon(polygon.points.slice(0, 2))).toBe(false);
    });

    it("requires an M followed by at least one L for a path", () => {
      expect(isValidSvgPath(path.commands)).toBe(true);
      expect(isValidSvgPath([{ kind: "M", x: 0, y: 0 }])).toBe(false);
    });
  });
});

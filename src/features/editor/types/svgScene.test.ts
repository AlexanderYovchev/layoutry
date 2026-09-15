import { describe, expect, it } from "vitest";
import { findSvgObjectById, hasSvgScene, isValidSvgVectorObjectKind, resolveSvgScene } from "./svgScene";
import type { SvgRectObject } from "./svgScene";

function rect(id: string): SvgRectObject {
  return { id, type: "rect", x: 0, y: 0, width: 10, height: 10 };
}

describe("svgScene model (Checkpoint 1.15.6)", () => {
  describe("resolveSvgScene", () => {
    it("resolves an absent scene to an empty one", () => {
      expect(resolveSvgScene({})).toEqual({ objects: [] });
    });

    it("resolves malformed loaded data (non-array objects) to an empty scene rather than crashing", () => {
      const node = { svgScene: { objects: "not-an-array" } } as unknown as { svgScene?: { objects: unknown } };
      expect(resolveSvgScene(node as never)).toEqual({ objects: [] });
    });

    it("returns a real scene as-is", () => {
      const scene = { objects: [rect("a")] };
      expect(resolveSvgScene({ svgScene: scene })).toBe(scene);
    });
  });

  describe("hasSvgScene", () => {
    it("is false for an absent or empty scene", () => {
      expect(hasSvgScene({})).toBe(false);
      expect(hasSvgScene({ svgScene: { objects: [] } })).toBe(false);
    });

    it("is true once at least one object exists", () => {
      expect(hasSvgScene({ svgScene: { objects: [rect("a")] } })).toBe(true);
    });
  });

  describe("findSvgObjectById", () => {
    it("finds an existing object", () => {
      const scene = { objects: [rect("a"), rect("b")] };
      expect(findSvgObjectById(scene, "b")?.id).toBe("b");
    });

    it("returns undefined for a stale/missing id rather than throwing", () => {
      const scene = { objects: [rect("a")] };
      expect(findSvgObjectById(scene, "missing")).toBeUndefined();
    });
  });

  describe("isValidSvgVectorObjectKind", () => {
    it("accepts every real kind and rejects garbage", () => {
      for (const kind of ["rect", "ellipse", "line", "polygon", "path"]) {
        expect(isValidSvgVectorObjectKind(kind)).toBe(true);
      }
      expect(isValidSvgVectorObjectKind("circle")).toBe(false);
      expect(isValidSvgVectorObjectKind(undefined)).toBe(false);
    });
  });
});

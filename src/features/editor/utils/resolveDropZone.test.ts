import { describe, expect, it } from "vitest";
import { computeDraggedCenterY, resolveDropZone } from "./resolveDropZone";

describe("computeDraggedCenterY", () => {
  it("returns the vertical center of a rect", () => {
    expect(computeDraggedCenterY({ top: 100, height: 40 })).toBe(120);
  });
});

describe("resolveDropZone", () => {
  const targetRect = { top: 100, height: 100 }; // spans 100-200

  describe("leaf targets (no children capability)", () => {
    it("resolves the top half to before", () => {
      expect(resolveDropZone(targetRect, 130, false)).toBe("before");
    });

    it("resolves the bottom half to after", () => {
      expect(resolveDropZone(targetRect, 170, false)).toBe("after");
    });

    it("never resolves to inside", () => {
      expect(resolveDropZone(targetRect, 150, false)).not.toBe("inside");
    });
  });

  describe("container targets (accepts children)", () => {
    it("resolves the top band to before", () => {
      expect(resolveDropZone(targetRect, 110, true)).toBe("before");
    });

    it("resolves the middle band to inside", () => {
      expect(resolveDropZone(targetRect, 150, true)).toBe("inside");
    });

    it("resolves the bottom band to after", () => {
      expect(resolveDropZone(targetRect, 190, true)).toBe("after");
    });

    it("treats exactly the 25%/75% boundaries as inside", () => {
      expect(resolveDropZone(targetRect, 125, true)).toBe("inside");
      expect(resolveDropZone(targetRect, 175, true)).toBe("inside");
    });
  });
});

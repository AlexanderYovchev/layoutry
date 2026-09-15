import { describe, expect, it } from "vitest";
import {
  addSvgObject,
  generateSvgObjectId,
  materializeSvgStarterIntoScene,
  removeSvgObjects,
  resizeSvgObject,
  setSvgLineEndpoint,
  setSvgLineStart,
  setSvgObjectsFill,
  setSvgObjectsStroke,
  setSvgObjectsStrokeWidth,
  translateSvgObjects,
} from "./svgSceneCommands";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { SvgRectObject } from "@/features/editor/types/svgScene";

function tree(svgOverrides: Partial<EditorElementNode> = {}): EditorElementNode {
  return {
    id: "root",
    tag: "div",
    children: [{ id: "svg1", tag: "svg", ...svgOverrides }],
  };
}

function rect(id: string, overrides: Partial<SvgRectObject> = {}): SvgRectObject {
  return { id, type: "rect", x: 0, y: 0, width: 10, height: 10, ...overrides };
}

function sceneOf(root: EditorElementNode) {
  return root.children![0].svgScene;
}

describe("svgSceneCommands", () => {
  describe("generateSvgObjectId", () => {
    it("produces a unique, kind-prefixed id per call", () => {
      const a = generateSvgObjectId("rect");
      const b = generateSvgObjectId("rect");
      expect(a).not.toBe(b);
      expect(a).toMatch(/^rect-/);
    });
  });

  describe("addSvgObject / removeSvgObjects", () => {
    it("appends a new object at the end of the scene", () => {
      let root = tree({ svgScene: { objects: [rect("a")] } });
      root = addSvgObject(root, "svg1", rect("b"));
      expect(sceneOf(root)!.objects.map((o) => o.id)).toEqual(["a", "b"]);
    });

    it("removes every targeted id in one pass", () => {
      const root = tree({ svgScene: { objects: [rect("a"), rect("b"), rect("c")] } });
      const result = removeSvgObjects(root, "svg1", new Set(["a", "c"]));
      expect(sceneOf(result)!.objects.map((o) => o.id)).toEqual(["b"]);
    });

    it("removeSvgObjects is a true no-op (same reference) for a stale id", () => {
      const root = tree({ svgScene: { objects: [rect("a")] } });
      expect(removeSvgObjects(root, "svg1", new Set(["missing"]))).toBe(root);
    });

    it("is a no-op (same reference) when svgNodeId doesn't exist", () => {
      const root = tree({ svgScene: { objects: [rect("a")] } });
      expect(addSvgObject(root, "missing", rect("b"))).toBe(root);
    });
  });

  describe("translateSvgObjects", () => {
    it("shifts every targeted object", () => {
      const root = tree({ svgScene: { objects: [rect("a"), rect("b")] } });
      const result = translateSvgObjects(root, "svg1", new Set(["a", "b"]), 5, 5);
      expect(sceneOf(result)!.objects[0]).toMatchObject({ x: 5, y: 5 });
      expect(sceneOf(result)!.objects[1]).toMatchObject({ x: 5, y: 5 });
    });

    it("leaves untargeted objects untouched", () => {
      const root = tree({ svgScene: { objects: [rect("a"), rect("b")] } });
      const result = translateSvgObjects(root, "svg1", new Set(["a"]), 5, 5);
      expect(sceneOf(result)!.objects[1]).toMatchObject({ x: 0, y: 0 });
    });

    it("is a true no-op (same reference) for a zero-distance translate", () => {
      const root = tree({ svgScene: { objects: [rect("a")] } });
      expect(translateSvgObjects(root, "svg1", new Set(["a"]), 0, 0)).toBe(root);
    });

    it("is a true no-op (same reference) for a non-zero translate targeting only stale ids", () => {
      const root = tree({ svgScene: { objects: [rect("a")] } });
      expect(translateSvgObjects(root, "svg1", new Set(["missing"]), 5, 5)).toBe(root);
    });
  });

  describe("resizeSvgObject", () => {
    it("resizes a rect to new bounds", () => {
      const root = tree({ svgScene: { objects: [rect("a")] } });
      const result = resizeSvgObject(root, "svg1", "a", { x: 1, y: 2, width: 30, height: 40 });
      expect(sceneOf(result)!.objects[0]).toMatchObject({ x: 1, y: 2, width: 30, height: 40 });
    });

    it("is a true no-op (same reference) for a non-rect/ellipse object type (polygon resize deferred)", () => {
      const root = tree({
        svgScene: { objects: [{ id: "p1", type: "polygon", points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }] }] },
      });
      expect(resizeSvgObject(root, "svg1", "p1", { x: 5, y: 5, width: 5, height: 5 })).toBe(root);
    });

    it("is a true no-op (same reference) for a stale object id", () => {
      const root = tree({ svgScene: { objects: [rect("a")] } });
      expect(resizeSvgObject(root, "svg1", "missing", { x: 5, y: 5, width: 5, height: 5 })).toBe(root);
    });
  });

  describe("setSvgLineEndpoint", () => {
    it("moves only the second endpoint of a line", () => {
      const root = tree({ svgScene: { objects: [{ id: "l1", type: "line", x1: 0, y1: 0, x2: 10, y2: 10 }] } });
      const result = setSvgLineEndpoint(root, "svg1", "l1", 50, 60);
      expect(sceneOf(result)!.objects[0]).toMatchObject({ x1: 0, y1: 0, x2: 50, y2: 60 });
    });

    it("is a no-op for a non-line object type", () => {
      const root = tree({ svgScene: { objects: [rect("a")] } });
      expect(setSvgLineEndpoint(root, "svg1", "a", 5, 5)).toBe(root);
    });
  });

  describe("setSvgLineStart", () => {
    it("moves only the first endpoint of a line", () => {
      const root = tree({ svgScene: { objects: [{ id: "l1", type: "line", x1: 0, y1: 0, x2: 10, y2: 10 }] } });
      const result = setSvgLineStart(root, "svg1", "l1", 5, 6);
      expect(sceneOf(result)!.objects[0]).toMatchObject({ x1: 5, y1: 6, x2: 10, y2: 10 });
    });

    it("is a no-op for a non-line object type", () => {
      const root = tree({ svgScene: { objects: [rect("a")] } });
      expect(setSvgLineStart(root, "svg1", "a", 5, 5)).toBe(root);
    });

    it("is a true no-op (same reference) for a stale object id", () => {
      const root = tree({ svgScene: { objects: [{ id: "l1", type: "line", x1: 0, y1: 0, x2: 10, y2: 10 }] } });
      expect(setSvgLineStart(root, "svg1", "missing", 5, 5)).toBe(root);
    });
  });

  describe("setSvgObjectsFill / setSvgObjectsStroke / setSvgObjectsStrokeWidth", () => {
    it("applies fill to every targeted object", () => {
      const root = tree({ svgScene: { objects: [rect("a"), rect("b")] } });
      const result = setSvgObjectsFill(root, "svg1", new Set(["a", "b"]), "#ff0000");
      expect(sceneOf(result)!.objects[0].fill).toBe("#ff0000");
      expect(sceneOf(result)!.objects[1].fill).toBe("#ff0000");
    });

    it("stroke None -> color, never touching strokeWidth", () => {
      const root = tree({ svgScene: { objects: [rect("a", { strokeWidth: 4 })] } });
      const result = setSvgObjectsStroke(root, "svg1", new Set(["a"]), "#000000");
      expect(sceneOf(result)!.objects[0].stroke).toBe("#000000");
      expect(sceneOf(result)!.objects[0].strokeWidth).toBe(4);
    });

    it("strokeWidth floors at 0", () => {
      const root = tree({ svgScene: { objects: [rect("a")] } });
      const result = setSvgObjectsStrokeWidth(root, "svg1", new Set(["a"]), -5);
      expect(sceneOf(result)!.objects[0].strokeWidth).toBe(0);
    });

    it("is a true no-op (same reference) when the value already matches", () => {
      const root = tree({ svgScene: { objects: [rect("a", { fill: "#ff0000" })] } });
      expect(setSvgObjectsFill(root, "svg1", new Set(["a"]), "#ff0000")).toBe(root);
    });
  });

  describe("materializeSvgStarterIntoScene", () => {
    it("converts a legacy Rectangle SVG into an equivalent one-object scene", () => {
      const root = tree({ svgKind: "rectangle", svgFill: "#3b82f6" });
      const result = materializeSvgStarterIntoScene(root, "svg1");
      const scene = sceneOf(result)!;
      expect(scene.objects).toHaveLength(1);
      expect(scene.objects[0]).toMatchObject({ type: "rect", fill: "#3b82f6" });
    });

    it("converts a legacy Circle into an ellipse object with equal rx/ry", () => {
      const root = tree({ svgKind: "circle" });
      const scene = sceneOf(materializeSvgStarterIntoScene(root, "svg1"))!;
      expect(scene.objects[0].type).toBe("ellipse");
      const ellipse = scene.objects[0] as Extract<typeof scene.objects[0], { type: "ellipse" }>;
      expect(ellipse.rx).toBe(ellipse.ry);
    });

    it("converts Triangle/Star into polygon objects with 3+/10 points respectively", () => {
      const triangleScene = sceneOf(materializeSvgStarterIntoScene(tree({ svgKind: "triangle" }), "svg1"))!;
      expect(triangleScene.objects[0].type).toBe("polygon");
      expect((triangleScene.objects[0] as Extract<typeof triangleScene.objects[0], { type: "polygon" }>).points).toHaveLength(3);

      const starScene = sceneOf(materializeSvgStarterIntoScene(tree({ svgKind: "star" }), "svg1"))!;
      expect((starScene.objects[0] as Extract<typeof starScene.objects[0], { type: "polygon" }>).points).toHaveLength(10);
    });

    it("preserves the legacy stroke/strokeWidth onto the materialized object", () => {
      const root = tree({ svgKind: "rectangle", svgStroke: "#000000", svgStrokeWidth: 3 });
      const scene = sceneOf(materializeSvgStarterIntoScene(root, "svg1"))!;
      expect(scene.objects[0]).toMatchObject({ stroke: "#000000", strokeWidth: 3 });
    });

    it("is a no-op (same reference) once a scene already exists — never re-materializes or overwrites", () => {
      const root = tree({ svgKind: "rectangle", svgScene: { objects: [rect("existing")] } });
      const result = materializeSvgStarterIntoScene(root, "svg1");
      expect(result).toBe(root);
    });

    it("is a no-op (same reference) when svgNodeId doesn't exist", () => {
      const root = tree({ svgKind: "rectangle" });
      expect(materializeSvgStarterIntoScene(root, "missing")).toBe(root);
    });
  });
});

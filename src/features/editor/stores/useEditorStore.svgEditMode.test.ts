import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "./useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";

// Checkpoint 1.15.6 — SVG Drawing Tool Foundation. A separate file from
// useEditorStore.svg.test.ts (Checkpoint 1.15.5's own legacy-mode
// store tests), the same "new checkpoint, new file" convention every
// prior checkpoint here already established.

const initialState = useEditorStore.getState();

function setupDocument(children: EditorElementNode[]) {
  useEditorStore.setState((state) => ({ document: { ...state.document, children } }));
}

function node(id: string) {
  return useEditorStore.getState().document.children!.find((c) => c.id === id)!;
}

function childOf(parentId: string, childId: string) {
  return node(parentId).children!.find((c) => c.id === childId)!;
}

describe("useEditorStore — SVG Drawing Tool Foundation (Checkpoint 1.15.6)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
    useEditorStore.getState().dismissEditorNotice();
  });

  describe("enterSvgEditMode / exitSvgEditMode", () => {
    it("materializes a legacy svgKind SVG into a scene, one history entry, and resets UI state", () => {
      setupDocument([{ id: "svg1", tag: "svg", svgKind: "circle" }]);
      const pastBefore = useEditorStore.getState().past.length;

      useEditorStore.getState().enterSvgEditMode("svg1");

      expect(node("svg1").svgScene?.objects).toHaveLength(1);
      expect(node("svg1").svgScene?.objects[0].type).toBe("ellipse");
      expect(useEditorStore.getState().past.length).toBe(pastBefore + 1);
      expect(useEditorStore.getState().svgEditingNodeId).toBe("svg1");
      expect(useEditorStore.getState().activeSvgTool).toBe("select");
      expect(useEditorStore.getState().selectedSvgObjectIds).toEqual([]);
    });

    it("does not re-materialize (zero history) once a scene already exists", () => {
      setupDocument([{ id: "svg1", tag: "svg", svgScene: { objects: [{ id: "r1", type: "rect", x: 0, y: 0, width: 1, height: 1 }] } }]);
      const pastBefore = useEditorStore.getState().past.length;

      useEditorStore.getState().enterSvgEditMode("svg1");

      expect(node("svg1").svgScene?.objects).toHaveLength(1);
      expect(useEditorStore.getState().past.length).toBe(pastBefore);
      expect(useEditorStore.getState().svgEditingNodeId).toBe("svg1");
    });

    it("is a no-op for a non-svg or missing node", () => {
      setupDocument([{ id: "div1", tag: "div" }]);
      useEditorStore.getState().enterSvgEditMode("div1");
      expect(useEditorStore.getState().svgEditingNodeId).toBeNull();
      useEditorStore.getState().enterSvgEditMode("missing");
      expect(useEditorStore.getState().svgEditingNodeId).toBeNull();
    });

    it("exitSvgEditMode resets all UI state without touching the document or history", () => {
      setupDocument([{ id: "svg1", tag: "svg", svgKind: "rectangle" }]);
      useEditorStore.getState().enterSvgEditMode("svg1");
      useEditorStore.getState().setActiveSvgTool("rect");
      useEditorStore.getState().selectSvgObjectOnly(node("svg1").svgScene!.objects[0].id);
      const pastBefore = useEditorStore.getState().past.length;

      useEditorStore.getState().exitSvgEditMode();

      expect(useEditorStore.getState().svgEditingNodeId).toBeNull();
      expect(useEditorStore.getState().activeSvgTool).toBe("select");
      expect(useEditorStore.getState().selectedSvgObjectIds).toEqual([]);
      expect(useEditorStore.getState().past.length).toBe(pastBefore);
    });
  });

  describe("selection lifecycle guard (module-level subscription)", () => {
    it("exits edit mode automatically when the outer document selection moves to a different node", () => {
      setupDocument([
        { id: "svg1", tag: "svg", svgKind: "rectangle" },
        { id: "div1", tag: "div" },
      ]);
      useEditorStore.getState().setSelection(["svg1"], "svg1");
      useEditorStore.getState().enterSvgEditMode("svg1");
      expect(useEditorStore.getState().svgEditingNodeId).toBe("svg1");

      useEditorStore.getState().selectOnly("div1");

      expect(useEditorStore.getState().svgEditingNodeId).toBeNull();
    });

    it("exits edit mode automatically when the edited SVG is deleted", () => {
      setupDocument([{ id: "svg1", tag: "svg", svgKind: "rectangle" }]);
      useEditorStore.getState().setSelection(["svg1"], "svg1");
      useEditorStore.getState().enterSvgEditMode("svg1");

      useEditorStore.getState().deleteSelection();

      expect(useEditorStore.getState().svgEditingNodeId).toBeNull();
    });

    it("does not exit edit mode for an unrelated store update that keeps the SVG as primary", () => {
      setupDocument([{ id: "svg1", tag: "svg", svgKind: "rectangle" }]);
      useEditorStore.getState().setSelection(["svg1"], "svg1");
      useEditorStore.getState().enterSvgEditMode("svg1");

      useEditorStore.getState().showEditorNotice("unrelated");

      expect(useEditorStore.getState().svgEditingNodeId).toBe("svg1");
    });
  });

  describe("SVG-local object selection", () => {
    it("selectSvgObjectOnly replaces the whole selection", () => {
      useEditorStore.getState().addSvgObjectToSelection("a");
      useEditorStore.getState().selectSvgObjectOnly("b");
      expect(useEditorStore.getState().selectedSvgObjectIds).toEqual(["b"]);
      expect(useEditorStore.getState().primarySvgObjectId).toBe("b");
    });

    it("toggleSvgObjectSelection adds then removes", () => {
      useEditorStore.getState().toggleSvgObjectSelection("a");
      expect(useEditorStore.getState().selectedSvgObjectIds).toEqual(["a"]);
      useEditorStore.getState().toggleSvgObjectSelection("a");
      expect(useEditorStore.getState().selectedSvgObjectIds).toEqual([]);
      expect(useEditorStore.getState().primarySvgObjectId).toBeNull();
    });

    it("addSvgObjectToSelection is additive, never a toggle", () => {
      useEditorStore.getState().selectSvgObjectOnly("a");
      useEditorStore.getState().addSvgObjectToSelection("b");
      expect(useEditorStore.getState().selectedSvgObjectIds).toEqual(["a", "b"]);
      expect(useEditorStore.getState().primarySvgObjectId).toBe("b");
    });

    it("clearSvgObjectSelection empties both fields", () => {
      useEditorStore.getState().selectSvgObjectOnly("a");
      useEditorStore.getState().clearSvgObjectSelection();
      expect(useEditorStore.getState().selectedSvgObjectIds).toEqual([]);
      expect(useEditorStore.getState().primarySvgObjectId).toBeNull();
    });

    it("setActiveSvgTool cancels any in-progress draft", () => {
      useEditorStore.getState().startSvgDraft("polygon", { x: 0, y: 0 });
      useEditorStore.getState().setActiveSvgTool("rect");
      expect(useEditorStore.getState().svgDraft).toBeNull();
      expect(useEditorStore.getState().activeSvgTool).toBe("rect");
    });
  });

  describe("Polygon/Pen draft commit", () => {
    // Seeded with one real pre-existing object (not an empty array) —
    // an empty `objects: []` is indistinguishable from "not yet
    // migrated" (section 6/7 of this checkpoint's own brief), so
    // entering edit mode on a genuinely empty scene would itself
    // materialize a Rectangle from the (unset -> default) legacy
    // svgKind, muddying these draft-commit-focused tests with an extra
    // object neither authored nor asserted on.
    function seededSvgTree() {
      return [
        {
          id: "svg1" as const,
          tag: "svg" as const,
          svgScene: { objects: [{ id: "seed", type: "rect" as const, x: 0, y: 0, width: 1, height: 1 }] },
        },
      ];
    }

    it("commits a valid polygon (3+ points), one history entry, returns to Select with the new object selected", () => {
      setupDocument(seededSvgTree());
      useEditorStore.getState().enterSvgEditMode("svg1");
      useEditorStore.getState().setActiveSvgTool("polygon");
      const pastBefore = useEditorStore.getState().past.length;

      useEditorStore.getState().startSvgDraft("polygon", { x: 0, y: 0 });
      useEditorStore.getState().addSvgDraftPoint({ x: 10, y: 0 });
      useEditorStore.getState().addSvgDraftPoint({ x: 5, y: 10 });
      useEditorStore.getState().commitSvgDraft();

      const scene = node("svg1").svgScene!;
      expect(scene.objects).toHaveLength(2);
      expect(scene.objects[1].type).toBe("polygon");
      expect(useEditorStore.getState().past.length).toBe(pastBefore + 1);
      expect(useEditorStore.getState().svgDraft).toBeNull();
      expect(useEditorStore.getState().activeSvgTool).toBe("select");
      expect(useEditorStore.getState().selectedSvgObjectIds).toEqual([scene.objects[1].id]);
    });

    it("refuses to commit a polygon with fewer than 3 points — zero history, draft untouched", () => {
      setupDocument(seededSvgTree());
      useEditorStore.getState().enterSvgEditMode("svg1");
      const pastBefore = useEditorStore.getState().past.length;

      useEditorStore.getState().startSvgDraft("polygon", { x: 0, y: 0 });
      useEditorStore.getState().addSvgDraftPoint({ x: 10, y: 0 });
      useEditorStore.getState().commitSvgDraft();

      expect(node("svg1").svgScene!.objects).toHaveLength(1);
      expect(useEditorStore.getState().past.length).toBe(pastBefore);
      expect(useEditorStore.getState().svgDraft).not.toBeNull();
    });

    it("commits a valid pen path (M + at least one L) as structured commands, not a raw d string", () => {
      setupDocument(seededSvgTree());
      useEditorStore.getState().enterSvgEditMode("svg1");
      useEditorStore.getState().startSvgDraft("pen", { x: 0, y: 0 });
      useEditorStore.getState().addSvgDraftPoint({ x: 10, y: 10 });
      useEditorStore.getState().commitSvgDraft();

      const scene = node("svg1").svgScene!;
      expect(scene.objects[1]).toMatchObject({
        type: "path",
        commands: [
          { kind: "M", x: 0, y: 0 },
          { kind: "L", x: 10, y: 10 },
        ],
      });
    });

    it("refuses to commit a pen path with only one point (no L segment)", () => {
      setupDocument(seededSvgTree());
      useEditorStore.getState().enterSvgEditMode("svg1");
      useEditorStore.getState().startSvgDraft("pen", { x: 0, y: 0 });
      useEditorStore.getState().commitSvgDraft();
      expect(node("svg1").svgScene!.objects).toHaveLength(1);
    });

    it("cancelSvgDraft discards the draft with zero history", () => {
      setupDocument([{ id: "svg1", tag: "svg", svgScene: { objects: [] } }]);
      useEditorStore.getState().enterSvgEditMode("svg1");
      const pastBefore = useEditorStore.getState().past.length;
      useEditorStore.getState().startSvgDraft("polygon", { x: 0, y: 0 });
      useEditorStore.getState().cancelSvgDraft();
      expect(useEditorStore.getState().svgDraft).toBeNull();
      expect(useEditorStore.getState().past.length).toBe(pastBefore);
    });

    it("a new polygon inherits the SVG's own current fill/stroke as creation defaults", () => {
      setupDocument([
        { id: "svg1", tag: "svg", svgFill: "#ff0000", svgScene: { objects: [{ id: "seed", type: "rect", x: 0, y: 0, width: 1, height: 1 }] } },
      ]);
      useEditorStore.getState().enterSvgEditMode("svg1");
      useEditorStore.getState().startSvgDraft("polygon", { x: 0, y: 0 });
      useEditorStore.getState().addSvgDraftPoint({ x: 10, y: 0 });
      useEditorStore.getState().addSvgDraftPoint({ x: 5, y: 10 });
      useEditorStore.getState().commitSvgDraft();
      expect(node("svg1").svgScene!.objects[1].fill).toBe("#ff0000");
    });
  });

  describe("addSvgObject / removeSvgObjects", () => {
    it("addSvgObject is vector content — unguarded, one history entry", () => {
      setupDocument([
        { id: "hero", tag: "div", lockChildStyles: true, children: [{ id: "svg1", tag: "svg", svgScene: { objects: [] } }] },
      ]);
      const pastBefore = useEditorStore.getState().past.length;
      useEditorStore.getState().addSvgObject("svg1", { id: "r1", type: "rect", x: 0, y: 0, width: 10, height: 10 });
      expect(childOf("hero", "svg1").svgScene!.objects).toHaveLength(1);
      expect(useEditorStore.getState().past.length).toBe(pastBefore + 1);
    });

    it("removeSvgObjects clears them from selection in the same commit", () => {
      setupDocument([{ id: "svg1", tag: "svg", svgScene: { objects: [{ id: "r1", type: "rect", x: 0, y: 0, width: 1, height: 1 }] } }]);
      useEditorStore.getState().selectSvgObjectOnly("r1");
      useEditorStore.getState().removeSvgObjects("svg1", ["r1"]);
      expect(node("svg1").svgScene!.objects).toHaveLength(0);
      expect(useEditorStore.getState().selectedSvgObjectIds).toEqual([]);
      expect(useEditorStore.getState().primarySvgObjectId).toBeNull();
    });

    it("removeSvgObjects on a protected SVG still succeeds — vector content, not styling", () => {
      setupDocument([
        {
          id: "hero",
          tag: "div",
          lockChildStyles: true,
          children: [{ id: "svg1", tag: "svg", svgScene: { objects: [{ id: "r1", type: "rect", x: 0, y: 0, width: 1, height: 1 }] } }],
        },
      ]);
      useEditorStore.getState().removeSvgObjects("svg1", ["r1"]);
      expect(childOf("hero", "svg1").svgScene!.objects).toHaveLength(0);
    });
  });

  describe("translate / resize", () => {
    it("translateSvgObjects moves the object, one history entry", () => {
      setupDocument([{ id: "svg1", tag: "svg", svgScene: { objects: [{ id: "r1", type: "rect", x: 0, y: 0, width: 1, height: 1 }] } }]);
      const pastBefore = useEditorStore.getState().past.length;
      useEditorStore.getState().translateSvgObjects("svg1", ["r1"], 5, 5);
      expect(node("svg1").svgScene!.objects[0]).toMatchObject({ x: 5, y: 5 });
      expect(useEditorStore.getState().past.length).toBe(pastBefore + 1);
    });

    it("translateSvgObjectsLive writes with no history push", () => {
      setupDocument([{ id: "svg1", tag: "svg", svgScene: { objects: [{ id: "r1", type: "rect", x: 0, y: 0, width: 1, height: 1 }] } }]);
      const pastBefore = useEditorStore.getState().past.length;
      useEditorStore.getState().translateSvgObjectsLive("svg1", ["r1"], 3, 3);
      expect(node("svg1").svgScene!.objects[0]).toMatchObject({ x: 3, y: 3 });
      expect(useEditorStore.getState().past.length).toBe(pastBefore);
    });

    it("a protected SVG still allows translate/resize — vector content, not styling", () => {
      setupDocument([
        {
          id: "hero",
          tag: "div",
          lockChildStyles: true,
          children: [{ id: "svg1", tag: "svg", svgScene: { objects: [{ id: "r1", type: "rect", x: 0, y: 0, width: 10, height: 10 }] } }],
        },
      ]);
      useEditorStore.getState().translateSvgObjects("svg1", ["r1"], 5, 5);
      useEditorStore.getState().resizeSvgObject("svg1", "r1", { x: 0, y: 0, width: 20, height: 20 });
      expect(childOf("hero", "svg1").svgScene!.objects[0]).toMatchObject({ width: 20, height: 20 });
    });

    it("resizeSvgObject resizes a rect, one history entry", () => {
      setupDocument([{ id: "svg1", tag: "svg", svgScene: { objects: [{ id: "r1", type: "rect", x: 0, y: 0, width: 1, height: 1 }] } }]);
      const pastBefore = useEditorStore.getState().past.length;
      useEditorStore.getState().resizeSvgObject("svg1", "r1", { x: 2, y: 2, width: 30, height: 40 });
      expect(node("svg1").svgScene!.objects[0]).toMatchObject({ x: 2, y: 2, width: 30, height: 40 });
      expect(useEditorStore.getState().past.length).toBe(pastBefore + 1);
    });

    it("resizeSvgObjectLive writes with no history push", () => {
      setupDocument([{ id: "svg1", tag: "svg", svgScene: { objects: [{ id: "r1", type: "rect", x: 0, y: 0, width: 1, height: 1 }] } }]);
      const pastBefore = useEditorStore.getState().past.length;
      useEditorStore.getState().resizeSvgObjectLive("svg1", "r1", { x: 0, y: 0, width: 15, height: 15 });
      expect(node("svg1").svgScene!.objects[0]).toMatchObject({ width: 15, height: 15 });
      expect(useEditorStore.getState().past.length).toBe(pastBefore);
    });

    it("addSvgObjectLive appends with no history push — the drawing-tool session's own per-frame write, wrapped by the generic transaction instead", () => {
      setupDocument([{ id: "svg1", tag: "svg", svgScene: { objects: [] } }]);
      const pastBefore = useEditorStore.getState().past.length;
      useEditorStore.getState().addSvgObjectLive("svg1", { id: "r1", type: "rect", x: 0, y: 0, width: 1, height: 1 });
      expect(node("svg1").svgScene!.objects).toHaveLength(1);
      expect(useEditorStore.getState().past.length).toBe(pastBefore);
    });

    it("setSvgLineEndpointLive moves only the second endpoint, no history push", () => {
      setupDocument([{ id: "svg1", tag: "svg", svgScene: { objects: [{ id: "l1", type: "line", x1: 0, y1: 0, x2: 1, y2: 1 }] } }]);
      const pastBefore = useEditorStore.getState().past.length;
      useEditorStore.getState().setSvgLineEndpointLive("svg1", "l1", 40, 50);
      expect(node("svg1").svgScene!.objects[0]).toMatchObject({ x1: 0, y1: 0, x2: 40, y2: 50 });
      expect(useEditorStore.getState().past.length).toBe(pastBefore);
    });

    it("setSvgLineEndpoint (one-shot) moves the second endpoint with one history entry", () => {
      setupDocument([{ id: "svg1", tag: "svg", svgScene: { objects: [{ id: "l1", type: "line", x1: 0, y1: 0, x2: 1, y2: 1 }] } }]);
      const pastBefore = useEditorStore.getState().past.length;
      useEditorStore.getState().setSvgLineEndpoint("svg1", "l1", 40, 50);
      expect(node("svg1").svgScene!.objects[0]).toMatchObject({ x1: 0, y1: 0, x2: 40, y2: 50 });
      expect(useEditorStore.getState().past.length).toBe(pastBefore + 1);
    });

    it("setSvgLineStart (one-shot) moves the first endpoint with one history entry", () => {
      setupDocument([{ id: "svg1", tag: "svg", svgScene: { objects: [{ id: "l1", type: "line", x1: 0, y1: 0, x2: 1, y2: 1 }] } }]);
      const pastBefore = useEditorStore.getState().past.length;
      useEditorStore.getState().setSvgLineStart("svg1", "l1", 5, 6);
      expect(node("svg1").svgScene!.objects[0]).toMatchObject({ x1: 5, y1: 6, x2: 1, y2: 1 });
      expect(useEditorStore.getState().past.length).toBe(pastBefore + 1);
    });

    it("setSvgLineEndpoint/setSvgLineStart are true no-ops (no history) for a stale object id", () => {
      setupDocument([{ id: "svg1", tag: "svg", svgScene: { objects: [{ id: "l1", type: "line", x1: 0, y1: 0, x2: 1, y2: 1 }] } }]);
      const pastBefore = useEditorStore.getState().past.length;
      useEditorStore.getState().setSvgLineEndpoint("svg1", "missing", 40, 50);
      useEditorStore.getState().setSvgLineStart("svg1", "missing", 40, 50);
      expect(useEditorStore.getState().past.length).toBe(pastBefore);
    });

    it("a full begin/addLive/resizeLive/commitTransaction drawing gesture produces exactly one history entry", () => {
      setupDocument([{ id: "svg1", tag: "svg", svgScene: { objects: [] } }]);
      const pastBefore = useEditorStore.getState().past.length;

      useEditorStore.getState().beginTransaction();
      useEditorStore.getState().addSvgObjectLive("svg1", { id: "r1", type: "rect", x: 0, y: 0, width: 1, height: 1 });
      useEditorStore.getState().resizeSvgObjectLive("svg1", "r1", { x: 10, y: 10, width: 50, height: 60 });
      useEditorStore.getState().resizeSvgObjectLive("svg1", "r1", { x: 10, y: 10, width: 80, height: 90 });
      useEditorStore.getState().commitTransaction();

      expect(node("svg1").svgScene!.objects).toHaveLength(1);
      expect(node("svg1").svgScene!.objects[0]).toMatchObject({ x: 10, y: 10, width: 80, height: 90 });
      expect(useEditorStore.getState().past.length).toBe(pastBefore + 1);

      useEditorStore.getState().undo();
      expect(node("svg1").svgScene!.objects).toHaveLength(0);
    });
  });

  describe("Parent Style Protection — vector Fill/Stroke/StrokeWidth (section 33/34)", () => {
    it("blocks a Fill change on a protected SVG's own vector objects: no document change, no history, notice shown", () => {
      setupDocument([
        {
          id: "hero",
          tag: "div",
          htmlId: "hero",
          lockChildStyles: true,
          children: [{ id: "svg1", tag: "svg", svgScene: { objects: [{ id: "r1", type: "rect", x: 0, y: 0, width: 1, height: 1 }] } }],
        },
      ]);
      const pastBefore = useEditorStore.getState().past.length;
      const docBefore = useEditorStore.getState().document;

      useEditorStore.getState().setSvgObjectsFill("svg1", ["r1"], "#ff0000");

      expect(useEditorStore.getState().document).toBe(docBefore);
      expect(useEditorStore.getState().past.length).toBe(pastBefore);
      expect(useEditorStore.getState().editorNotice?.message).toContain('"hero"');
    });

    it("blocks Stroke and Stroke Width the same way", () => {
      setupDocument([
        { id: "hero", tag: "div", lockChildStyles: true, children: [{ id: "svg1", tag: "svg", svgScene: { objects: [{ id: "r1", type: "rect", x: 0, y: 0, width: 1, height: 1 }] } }] },
      ]);
      useEditorStore.getState().setSvgObjectsStroke("svg1", ["r1"], "#000000");
      useEditorStore.getState().setSvgObjectsStrokeWidth("svg1", ["r1"], 5);
      expect(childOf("hero", "svg1").svgScene!.objects[0].stroke).toBeUndefined();
      expect(childOf("hero", "svg1").svgScene!.objects[0].strokeWidth).toBeUndefined();
    });

    it("allows Fill/Stroke/StrokeWidth on an unprotected SVG's vector objects, one history entry", () => {
      setupDocument([{ id: "svg1", tag: "svg", svgScene: { objects: [{ id: "r1", type: "rect", x: 0, y: 0, width: 1, height: 1 }] } }]);
      const pastBefore = useEditorStore.getState().past.length;
      useEditorStore.getState().setSvgObjectsFill("svg1", ["r1"], "#00ff00");
      expect(node("svg1").svgScene!.objects[0].fill).toBe("#00ff00");
      expect(useEditorStore.getState().past.length).toBe(pastBefore + 1);
    });

    it("the lock OWNER's own SVG (itself the locking node) remains editable for its own vector Fill", () => {
      setupDocument([{ id: "svg1", tag: "svg", lockChildStyles: true, svgScene: { objects: [{ id: "r1", type: "rect", x: 0, y: 0, width: 1, height: 1 }] } }]);
      useEditorStore.getState().setSvgObjectsFill("svg1", ["r1"], "#00ff00");
      expect(node("svg1").svgScene!.objects[0].fill).toBe("#00ff00");
      expect(useEditorStore.getState().editorNotice).toBeNull();
    });

    it("bulk Fill across multiple objects in the same (protected) SVG is blocked atomically with one check", () => {
      setupDocument([
        {
          id: "hero",
          tag: "div",
          lockChildStyles: true,
          children: [
            {
              id: "svg1",
              tag: "svg",
              svgScene: {
                objects: [
                  { id: "r1", type: "rect", x: 0, y: 0, width: 1, height: 1 },
                  { id: "r2", type: "rect", x: 0, y: 0, width: 1, height: 1 },
                ],
              },
            },
          ],
        },
      ]);
      useEditorStore.getState().setSvgObjectsFill("svg1", ["r1", "r2"], "#ff0000");
      const scene = childOf("hero", "svg1").svgScene!;
      expect(scene.objects[0].fill).toBeUndefined();
      expect(scene.objects[1].fill).toBeUndefined();
    });
  });

  describe("duplication", () => {
    it("duplicating the outer SVG preserves the whole scene with fresh vector ids", () => {
      setupDocument([{ id: "svg1", tag: "svg", svgScene: { objects: [{ id: "r1", type: "rect", x: 1, y: 2, width: 3, height: 4 }] } }]);
      useEditorStore.getState().setSelection(["svg1"], "svg1");
      useEditorStore.getState().duplicateSelection();

      const children = useEditorStore.getState().document.children!;
      expect(children).toHaveLength(2);
      const duplicate = children[1];
      expect(duplicate.id).not.toBe("svg1");
      expect(duplicate.svgScene!.objects[0].id).not.toBe("r1");
      expect(duplicate.svgScene!.objects[0]).toMatchObject({ x: 1, y: 2, width: 3, height: 4 });
    });
  });
});

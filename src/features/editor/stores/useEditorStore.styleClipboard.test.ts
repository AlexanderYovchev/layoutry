import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { registerDocumentSaveLimitGuard } from "@/features/editor/rules/documentSaveLimitGuard";
import type { ShadowLayer } from "@/features/editor/types/boxShadow";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { StyleClipboard } from "@/features/editor/types/styleClipboard";
import { clampGridChildPlacement } from "@/features/editor/utils/clampGridChildPlacement";
import { findNodeById } from "@/features/editor/utils/findNodeById";
import { createProjectMetadata, serializeProject } from "@/features/project/utils/serializeProject";
import {
  COPY_TOO_LARGE_NOTICE,
  STYLE_COPY_NO_SOURCE_NOTICE,
  STYLE_PASTE_EMPTY_CLIPBOARD_NOTICE,
  STYLE_PASTE_FREE_SIZE_NOTICE,
  STYLE_PASTE_INVALID_NOTICE,
  STYLE_PASTE_NOTHING_COMPATIBLE_NOTICE,
  STYLE_PASTE_UNCHANGED_NOTICE,
  styleCopiedNotice,
  styleCopyEmptyNotice,
  stylePastedWithSkipsNotice,
  useEditorStore,
} from "./useEditorStore";

/**
 * BC-11.2 — Copy/Paste CSS through the store: an authored, immutable
 * snapshot in a CSS clipboard independent of the element clipboard, merged
 * into every selected element where supported, all or nothing, one Undo step.
 */

const initialState = useEditorStore.getState();
const store = () => useEditorStore.getState();
const node = (id: string) => findNodeById(store().document, id)!;
const run = (action: () => void) => act(action);
const select = (ids: string[], primaryId?: string) => run(() => store().setSelection(ids, primaryId));
const load = (children: EditorElementNode[]) => run(() => store().replaceDocument({ id: "page-root", tag: "page", children }));
const px = (value: number) => ({ value, unit: "px" as const });
const notice = () => store().editorNotice?.message;
const flex = { direction: "row", wrap: "nowrap", justifyContent: "center", alignItems: "center", rowGap: 8, columnGap: 12 } as const;
const shadows: ShadowLayer[] = [
  { id: "s1", enabled: true, inset: false, offsetX: px(0), offsetY: px(4), blur: px(10), spread: px(0), color: "rgba(0, 0, 0, 0.3)" },
  { id: "s2", enabled: true, inset: true, offsetX: px(1), offsetY: px(1), blur: px(0), spread: px(1), color: "#ffffff" },
];
const gradient = { type: "linear" as const, angle: 90, stops: [{ id: "g1", color: "#0000ff", position: 0 }, { id: "g2", color: "#00ffff", position: 60 }, { id: "g3", color: "#ffffff", position: 100 }] };

/** The brief's buttons: A (blue/white/8px radius/12px padding) and B (gray/black/0/6, its own text, link and interaction). */
const buttonA: EditorElementNode = {
  id: "a",
  tag: "button",
  text: "Buy now",
  htmlId: "buy",
  className: "cta",
  background: { color: "#2563eb" },
  typography: { color: "#ffffff", fontSize: { value: 1.25, unit: "rem" } },
  borderRadius: { topLeft: px(8), topRight: px(8), bottomRight: px(8), bottomLeft: px(8) },
  spacing: { padding: { top: 12, right: 12, bottom: 12, left: 12 } },
  interactions: [{ id: "ia", trigger: "click", action: "toggle", targetId: "p" }],
};
const buttonB: EditorElementNode = {
  id: "b",
  tag: "button",
  text: "Cancel",
  htmlId: "cancel",
  background: { color: "#888888" },
  typography: { color: "#000000", fontWeight: 700 },
  borderRadius: { topLeft: px(0), topRight: px(0), bottomRight: px(0), bottomLeft: px(0) },
  spacing: { padding: { top: 6, right: 6, bottom: 6, left: 6 }, margin: { top: 3 } },
  boxShadow: shadows,
  interactions: [{ id: "ib", trigger: "click", action: "toggle", targetId: "p" }],
};

function basic() {
  load([buttonA, buttonB, { id: "p", tag: "p", text: "Para" }, { id: "box", tag: "div", children: [{ id: "inner", tag: "p", text: "Inner" }] }]);
}

describe("Copy/Paste CSS (BC-11.2)", () => {
  beforeEach(() => useEditorStore.setState(initialState, true));
  afterEach(() => useEditorStore.setState(initialState, true));

  describe("Copy CSS", () => {
    it("captures only the source's authored CSS, units kept, never identity/content/behaviour; no document or history change", () => {
      basic();
      select(["a"]);
      const before = store().document;
      run(() => store().copyStyle());
      const groups = store().styleClipboard!.groups;
      expect(Object.keys(groups).sort()).toEqual(["background", "borderRadius", "spacing", "typography"]);
      expect(groups.typography).toEqual({ color: "#ffffff", fontSize: { value: 1.25, unit: "rem" } });
      expect(JSON.stringify(groups)).not.toMatch(/Buy now|"buy"|cta|"ia"|targetId/);
      expect(store().document).toBe(before);
      expect(store().past).toHaveLength(0);
      expect(store().styleClipboard!.sourceName).toBe("buy");
      expect(notice()).toBe(styleCopiedNotice("buy"));
    });

    it("is an immutable snapshot: editing or deleting the source afterwards doesn't change it", () => {
      basic();
      select(["a"]);
      run(() => store().copyStyle());
      const copied = structuredClone(store().styleClipboard!.groups);
      run(() => store().setElementTypography("a", { color: "#123456" }));
      run(() => store().deleteSelection());
      expect(store().styleClipboard!.groups).toEqual(copied);
      expect(store().styleClipboard!.groups.typography).not.toBe(findNodeById(initialStateDocument(), "a")?.typography);
    });

    it("a source with no CSS of its own clears the CSS clipboard (no stale snapshot) and says so; nothing selected says so", () => {
      basic();
      select(["a"]);
      run(() => store().copyStyle());
      select(["p"]);
      run(() => store().copyStyle());
      expect(store().styleClipboard).toBeNull();
      expect(notice()).toBe(styleCopyEmptyNotice("Paragraph"));
      run(() => store().clearSelection());
      run(() => store().copyStyle());
      expect(notice()).toBe(STYLE_COPY_NO_SOURCE_NOTICE);
    });

    it("with several elements selected, the PRIMARY is the source; the selection is unchanged", () => {
      basic();
      select(["a", "b"], "b");
      run(() => store().copyStyle());
      expect(store().styleClipboard!.groups.boxShadow).toEqual(shadows);
      expect(store().selection).toEqual({ ids: ["a", "b"], primaryId: "b" });
    });
  });

  describe("Paste CSS", () => {
    it("the brief's example: B takes A's look (merge), keeps its own text, ids, interactions and un-copied CSS; one Undo step, Redo", () => {
      basic();
      select(["a"]);
      run(() => store().copyStyle());
      select(["b"]);
      run(() => store().pasteStyle());
      const b = node("b");
      expect(b.background).toEqual({ color: "#2563eb" });
      expect(b.typography).toEqual({ color: "#ffffff", fontSize: { value: 1.25, unit: "rem" }, fontWeight: 700 });
      expect(b.borderRadius?.topLeft).toEqual(px(8));
      expect(b.spacing).toEqual({ padding: { top: 12, right: 12, bottom: 12, left: 12 }, margin: { top: 3 } });
      expect(b.boxShadow).toEqual(shadows);
      expect([b.text, b.htmlId, b.className, b.interactions?.[0].id]).toEqual(["Cancel", "cancel", undefined, "ib"]);
      expect(store().past).toHaveLength(1);
      expect(notice()).not.toMatch(/Skipped/);
      run(() => store().undo());
      expect(node("b")).toEqual(buttonB);
      run(() => store().redo());
      expect(node("b").background).toEqual({ color: "#2563eb" });
    });

    it("several destinations, cross-container and cross-tag, a parent and its child each once; unsupported groups skipped and named once", () => {
      basic();
      select(["a"]);
      run(() => store().copyStyle());
      select(["p", "box", "inner"]);
      run(() => store().pasteStyle());
      // Text elements take typography; the div doesn't (no typography there), but takes the box CSS.
      expect(node("p").typography?.color).toBe("#ffffff");
      expect(node("inner").typography?.color).toBe("#ffffff");
      expect(node("box").typography).toBeUndefined();
      expect(node("box").background).toEqual({ color: "#2563eb" });
      expect(node("box").spacing?.padding?.top).toBe(12);
      expect(store().past).toHaveLength(1);
      expect(notice()).toBe(stylePastedWithSkipsNotice(["Typography"]));
    });

    it("nothing compatible: no change, no history, a notice", () => {
      load([{ id: "img", tag: "img", src: "https://example.com/a.png", mediaFit: { objectFit: "cover" } }, { id: "p", tag: "p", text: "P" }]);
      select(["img"]);
      run(() => store().copyStyle());
      select(["p"]);
      const before = store().document;
      run(() => store().pasteStyle());
      expect(store().document).toBe(before);
      expect(store().past).toHaveLength(0);
      expect(notice()).toBe(STYLE_PASTE_NOTHING_COMPATIBLE_NOTICE);
    });

    it("pasting the same CSS again is a no-op: no history entry", () => {
      basic();
      select(["a"]);
      run(() => store().copyStyle());
      select(["b"]);
      run(() => store().pasteStyle());
      run(() => store().pasteStyle());
      expect(store().past).toHaveLength(1);
      expect(notice()).toBe(STYLE_PASTE_UNCHANGED_NOTICE);
    });

    it("a style lock on any destination blocks the whole paste", () => {
      load([buttonA, { id: "lock", tag: "div", lockChildStyles: true, children: [{ id: "locked", tag: "p", text: "L" }] }, { id: "free", tag: "p", text: "F" }]);
      select(["a"]);
      run(() => store().copyStyle());
      select(["free", "locked"]);
      const before = store().document;
      run(() => store().pasteStyle());
      expect(store().document).toBe(before);
      expect(store().past).toHaveLength(0);
      expect(notice()).toBeDefined();
      expect(notice()).not.toMatch(/pasted\./);
    });

    it("an invalid value refuses the whole paste (validated before committing)", () => {
      basic();
      const corrupt: StyleClipboard = JSON.parse('{"version":1,"sourceName":"x","groups":{"typography":{"color":"#ff0000"},"display":{"display":"not-a-display"}}}');
      run(() => useEditorStore.setState({ styleClipboard: corrupt }));
      select(["p", "b"]);
      const before = store().document;
      run(() => store().pasteStyle());
      expect(store().document).toBe(before);
      expect(notice()).toBe(STYLE_PASTE_INVALID_NOTICE);
    });

    it("an empty CSS clipboard and an empty/stale selection are refused safely", () => {
      basic();
      select(["b"]);
      run(() => store().pasteStyle());
      expect(notice()).toBe(STYLE_PASTE_EMPTY_CLIPBOARD_NOTICE);
      select(["a"]);
      run(() => store().copyStyle());
      // A stale id in the selection: only the existing one is styled.
      run(() => useEditorStore.setState({ selection: { ids: ["gone", "p"], primaryId: "gone" } }));
      run(() => store().pasteStyle());
      expect(node("p").typography?.color).toBe("#ffffff");
      expect(store().past).toHaveLength(1);
    });
  });

  describe("independent clipboards", () => {
    it("copy a Button element, copy CSS from a heading, paste the Button, paste the heading CSS onto it", () => {
      load([buttonB, { id: "h", tag: "h2", text: "Title", typography: { color: "#ff0000", letterSpacing: { value: 0.1, unit: "em" } } }]);
      select(["b"]);
      run(() => store().copySelection());
      select(["h"]);
      run(() => store().copyStyle());
      expect(store().clipboard?.nodes[0].id).toBe("b");
      expect(store().styleClipboard?.groups.typography?.color).toBe("#ff0000");
      select(["page-root"]);
      run(() => store().pasteClipboard());
      const pasted = store().selection.ids[0];
      run(() => store().pasteStyle());
      expect(node(pasted).typography).toEqual({ color: "#ff0000", letterSpacing: { value: 0.1, unit: "em" }, fontWeight: 700 });
      expect(node(pasted).text).toBe("Cancel");
      expect(store().clipboard?.nodes[0].id).toBe("b");
    });
  });

  describe("layout CSS (D4=B)", () => {
    it("Flex container settings apply to a Flow container (block or grid), not to a Free one (skipped, named)", () => {
      load([
        { id: "src", tag: "div", flowLayout: { display: "flex", flex }, children: [] },
        { id: "blockBox", tag: "div", children: [] },
        { id: "gridBox", tag: "section", flowLayout: { display: "grid", grid: { columns: 3, rows: "auto", rowGap: 0, columnGap: 0 } }, children: [] },
        { id: "freeBox", tag: "div", layoutMode: "free", children: [] },
      ]);
      select(["src"]);
      run(() => store().copyStyle());
      select(["blockBox", "gridBox", "freeBox"]);
      run(() => store().pasteStyle());
      expect(node("blockBox").flowLayout).toEqual({ display: "flex", flex });
      expect(node("gridBox").flowLayout?.display).toBe("flex");
      expect(node("gridBox").flowLayout?.flex).toEqual(flex);
      expect(node("freeBox").flowLayout).toBeUndefined();
      expect(node("freeBox").layoutMode).toBe("free");
      expect(notice()).toBe(stylePastedWithSkipsNotice(["Content layout"]));
    });

    it("Flex/Grid child settings apply only under a Flex/Grid parent; a grid placement is clamped to the destination's grid", () => {
      load([
        { id: "row", tag: "div", flowLayout: { display: "flex", flex }, children: [{ id: "fc", tag: "p", text: "F", flexChild: { grow: 2, shrink: 0, basis: "auto", alignSelf: "end" } }, { id: "fd", tag: "p", text: "D" }] },
        { id: "plain", tag: "div", children: [{ id: "pd", tag: "p", text: "P" }] },
        { id: "g4", tag: "div", flowLayout: { display: "grid", grid: { columns: 4, rows: "auto", rowGap: 0, columnGap: 0 } }, children: [{ id: "gc", tag: "p", text: "G", gridChild: { columnStart: 3, columnSpan: 2, rowStart: "auto", rowSpan: 1 } }] },
        { id: "g2", tag: "div", flowLayout: { display: "grid", grid: { columns: 2, rows: "auto", rowGap: 0, columnGap: 0 } }, children: [{ id: "gd", tag: "p", text: "H" }] },
      ]);
      select(["fc"]);
      run(() => store().copyStyle());
      select(["fd", "pd"]);
      run(() => store().pasteStyle());
      expect(node("fd").flexChild).toEqual({ grow: 2, shrink: 0, basis: "auto", alignSelf: "end" });
      expect(node("pd").flexChild).toBeUndefined();
      expect(notice()).toBe(stylePastedWithSkipsNotice(["Flex child settings"]));
      select(["gc"]);
      run(() => store().copyStyle());
      select(["gd"]);
      run(() => store().pasteStyle());
      // Exactly the single-element clamp against the destination's own 2-column grid (column 3 is pulled in).
      expect(node("gd").gridChild).toEqual(clampGridChildPlacement({ columnStart: 3, columnSpan: 2, rowStart: "auto", rowSpan: 1 }, { columns: 2, rows: "auto", rowGap: 0, columnGap: 0 }));
      expect(node("gd").gridChild?.columnStart).not.toBe(3);
    });

    it("size: Flow width/height (own offsets kept), min/max, aspect ratio; a Free child keeps its x/y; position skipped on a Free child", () => {
      load([
        { id: "src", tag: "div", dimensions: { preferredWidth: 240, preferredHeight: 120, offsetX: 5, offsetY: 6 }, sizeConstraints: { maxWidth: 600 }, aspectRatio: { mode: "ratio", width: 2, height: 1 }, position: { position: "relative", top: { value: 4, unit: "px" } }, children: [] },
        { id: "flowDest", tag: "div", dimensions: { preferredWidth: 10, preferredHeight: 10, offsetX: 1, offsetY: 2 }, sizeConstraints: { minWidth: 50 }, children: [] },
        { id: "freeHost", tag: "div", layoutMode: "free", dimensions: { preferredWidth: 600, preferredHeight: 400, offsetX: 0, offsetY: 0 }, children: [{ id: "freeKid", tag: "div", freeLayout: { x: 30, y: 40, width: 50, height: 50 }, children: [] }] },
      ]);
      select(["src"]);
      run(() => store().copyStyle());
      select(["flowDest", "freeKid"]);
      run(() => store().pasteStyle());
      expect(node("flowDest").dimensions).toEqual({ preferredWidth: 240, preferredHeight: 120, offsetX: 1, offsetY: 2 });
      expect(node("flowDest").sizeConstraints).toEqual({ minWidth: 50, maxWidth: 600 });
      expect(node("flowDest").aspectRatio).toEqual({ mode: "ratio", width: 2, height: 1 });
      expect(node("flowDest").position).toEqual({ position: "relative", top: { value: 4, unit: "px" } });
      expect(node("freeKid").freeLayout).toEqual({ x: 30, y: 40, width: 240, height: 120 });
      expect(node("freeKid").position).toBeUndefined();
      expect(notice()).toBe(stylePastedWithSkipsNotice(["Position"]));
    });

    it("a copied size that wouldn't fit a Free destination's container refuses the whole paste (never shrunk)", () => {
      load([
        { id: "big", tag: "div", dimensions: { preferredWidth: 900, preferredHeight: 100, offsetX: 0, offsetY: 0 }, background: { color: "#ff0000" }, children: [] },
        { id: "other", tag: "div", children: [] },
        { id: "host", tag: "div", layoutMode: "free", dimensions: { preferredWidth: 400, preferredHeight: 300, offsetX: 0, offsetY: 0 }, children: [{ id: "kid", tag: "div", freeLayout: { x: 0, y: 0, width: 50, height: 50 }, children: [] }] },
      ]);
      select(["big"]);
      run(() => store().copyStyle());
      select(["other", "kid"]);
      const before = store().document;
      run(() => store().pasteStyle());
      expect(store().document).toBe(before);
      expect(notice()).toBe(STYLE_PASTE_FREE_SIZE_NOTICE);
    });
  });

  describe("complex values", () => {
    it("multi-layer shadows and multi-stop gradients are copied by value, never aliased between elements", () => {
      load([
        { id: "src", tag: "div", boxShadow: shadows, background: { sourceType: "gradient", gradient }, transform: { rotateDeg: 15, scale: 1.1 }, filters: { blur: { value: 2, unit: "px" } }, transition: { property: "box-shadow", durationMs: 300, timingFunction: "ease-in-out", delayMs: 50 }, children: [] },
        { id: "d1", tag: "div", background: { color: "#ffffff" }, transform: { translateX: 9 }, children: [] },
        { id: "d2", tag: "section", children: [] },
      ]);
      select(["src"]);
      run(() => store().copyStyle());
      select(["d1", "d2"]);
      run(() => store().pasteStyle());
      for (const id of ["d1", "d2"]) {
        expect(node(id).boxShadow).toEqual(shadows);
        expect(node(id).background?.gradient).toEqual(gradient);
        expect(node(id).transition).toEqual({ property: "box-shadow", durationMs: 300, timingFunction: "ease-in-out", delayMs: 50 });
      }
      expect(node("d1").boxShadow).not.toBe(node("d2").boxShadow);
      expect(node("d1").boxShadow).not.toBe(node("src").boxShadow);
      expect(node("d1").background).toEqual({ color: "#ffffff", sourceType: "gradient", gradient });
      expect(node("d1").transform).toEqual({ translateX: 9, rotateDeg: 15, scale: 1.1 });
      // Layer ids stay unique within each element.
      expect(new Set(node("d1").boxShadow!.map((layer) => layer.id)).size).toBe(2);
    });

    it("an uploaded background image pasted onto several elements must still fit the save limit", () => {
      load([{ id: "src", tag: "div", background: { sourceType: "image", image: "data:image/png;base64,AAAA" }, children: [] }, { id: "d", tag: "div", children: [] }]);
      select(["src"]);
      run(() => store().copyStyle());
      const unregister = registerDocumentSaveLimitGuard(() => false);
      try {
        select(["d"]);
        const before = store().document;
        run(() => store().pasteStyle());
        expect(store().document).toBe(before);
        expect(notice()).toBe(COPY_TOO_LARGE_NOTICE);
      } finally {
        unregister();
      }
    });
  });

  it("the CSS clipboard is never saved", () => {
    basic();
    select(["a"]);
    run(() => store().copyStyle());
    const text = serializeProject({ metadata: createProjectMetadata({ id: "p", now: new Date(0) }), document: store().document });
    expect(text).not.toMatch(/styleClipboard|sourceName/);
  });
});

function initialStateDocument(): EditorElementNode {
  return { id: "page-root", tag: "page", children: [buttonA] };
}

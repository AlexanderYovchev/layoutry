import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ShadowLayer } from "@/features/editor/types/boxShadow";
import type { EditorElementNode } from "@/features/editor/types/document";
import { findNodeById } from "@/features/editor/utils/findNodeById";
import {
  canCopyStyleSection,
  canPasteStyleSection,
  STYLE_PASTE_NOTHING_COMPATIBLE_NOTICE,
  STYLE_PASTE_UNCHANGED_NOTICE,
  styleSectionCopiedNotice,
  styleSectionCopyEmptyNotice,
  styleSectionMissingNotice,
  stylePastedWithSkipsNotice,
  useEditorStore,
} from "./useEditorStore";

/**
 * BC-11.3 — section-level Copy/Paste CSS through the store: one CSS group,
 * the one shared CSS clipboard, BC-11.2's atomic merge paste.
 */

const initialState = useEditorStore.getState();
const store = () => useEditorStore.getState();
const node = (id: string) => findNodeById(store().document, id)!;
const run = (action: () => void) => act(action);
const select = (ids: string[], primaryId?: string) => run(() => store().setSelection(ids, primaryId));
const load = (children: EditorElementNode[]) => run(() => store().replaceDocument({ id: "page-root", tag: "page", children }));
const notice = () => store().editorNotice?.message;
const px = (value: number) => ({ value, unit: "px" as const });
const shadows: ShadowLayer[] = [
  { id: "s1", enabled: true, inset: false, offsetX: px(0), offsetY: px(2), blur: px(6), spread: px(0), color: "#000000" },
  { id: "s2", enabled: true, inset: true, offsetX: px(1), offsetY: px(1), blur: px(0), spread: px(1), color: "#ffffff" },
];
const gradient = { type: "linear" as const, angle: 45, stops: [{ id: "g1", color: "#ff0000", position: 0 }, { id: "g2", color: "#0000ff", position: 100 }] };
const flex = { direction: "column", wrap: "wrap", justifyContent: "space-between", alignItems: "center", rowGap: 4, columnGap: 6 } as const;

/** A: typography 24px red + background + shadow + padding. B: typography 16px bold + its own background. */
function basic() {
  load([
    { id: "a", tag: "h2", text: "A", typography: { fontSize: px(24), color: "#ff0000" }, background: { color: "#00ff00", sourceType: "gradient", gradient }, boxShadow: shadows, spacing: { padding: { top: 9 } } },
    { id: "b", tag: "p", text: "B", htmlId: "bee", typography: { fontSize: px(16), fontWeight: 700 }, background: { color: "#111111" }, spacing: { margin: { top: 2 } } },
    { id: "div", tag: "div", children: [{ id: "inner", tag: "p", text: "Inner" }] },
    { id: "plain", tag: "p", text: "Plain" },
  ]);
}

describe("section-level Copy/Paste CSS (BC-11.3)", () => {
  beforeEach(() => useEditorStore.setState(initialState, true));
  afterEach(() => useEditorStore.setState(initialState, true));

  it("Copy Typography CSS snapshots only that group into the shared CSS clipboard; no document or history change", () => {
    basic();
    select(["a"]);
    const before = store().document;
    run(() => store().copyStyleSection("typography"));
    expect(store().styleClipboard?.groups).toEqual({ typography: { fontSize: px(24), color: "#ff0000" } });
    expect(store().document).toBe(before);
    expect(store().past).toHaveLength(0);
    expect(notice()).toBe(styleSectionCopiedNotice("Typography", "Heading"));
  });

  it("the brief's merge: Paste Typography CSS sets 24px + red and keeps bold; nothing else changes; one Undo, Redo", () => {
    basic();
    select(["a"]);
    run(() => store().copyStyleSection("typography"));
    select(["b"]);
    run(() => store().pasteStyleSection("typography"));
    expect(node("b").typography).toEqual({ fontSize: px(24), color: "#ff0000", fontWeight: 700 });
    expect(node("b").background).toEqual({ color: "#111111" });
    expect(node("b").spacing).toEqual({ margin: { top: 2 } });
    expect(node("b").boxShadow).toBeUndefined();
    expect(node("b").htmlId).toBe("bee");
    expect(store().past).toHaveLength(1);
    run(() => store().undo());
    expect(node("b").typography).toEqual({ fontSize: px(16), fontWeight: 700 });
    run(() => store().redo());
    expect(node("b").typography?.color).toBe("#ff0000");
    // Again: a no-op, no history.
    run(() => store().pasteStyleSection("typography"));
    expect(store().past).toHaveLength(1);
    expect(notice()).toBe(STYLE_PASTE_UNCHANGED_NOTICE);
  });

  it("global Copy CSS → Paste Background CSS applies only Background (the gradient included)", () => {
    basic();
    select(["a"]);
    run(() => store().copyStyle());
    select(["b"]);
    run(() => store().pasteStyleSection("background"));
    expect(node("b").background).toEqual({ color: "#00ff00", sourceType: "gradient", gradient });
    expect(node("b").typography).toEqual({ fontSize: px(16), fontWeight: 700 });
    expect(node("b").boxShadow).toBeUndefined();
    expect(node("b").spacing).toEqual({ margin: { top: 2 } });
  });

  it("Copy one section → global Paste CSS applies only that section", () => {
    basic();
    select(["a"]);
    run(() => store().copyStyleSection("boxShadow"));
    select(["b"]);
    run(() => store().pasteStyle());
    expect(node("b").boxShadow).toEqual(shadows);
    expect(node("b").boxShadow).not.toBe(node("a").boxShadow);
    expect(node("b").typography).toEqual({ fontSize: px(16), fontWeight: 700 });
    expect(node("b").background).toEqual({ color: "#111111" });
  });

  it("Copy Typography → Paste Background: nothing is reinterpreted; no change, no history, a notice", () => {
    basic();
    select(["a"]);
    run(() => store().copyStyleSection("typography"));
    select(["b"]);
    const before = store().document;
    run(() => store().pasteStyleSection("background"));
    expect(store().document).toBe(before);
    expect(store().past).toHaveLength(0);
    expect(notice()).toBe(styleSectionMissingNotice("Background"));
    expect(canPasteStyleSection(store(), "background")).toBe(false);
  });

  it("an empty section clears the CSS clipboard (no stale paste); a section the source doesn't offer copies nothing", () => {
    basic();
    select(["a"]);
    run(() => store().copyStyle());
    select(["plain"]);
    expect(canCopyStyleSection(store(), "typography")).toBe(false);
    run(() => store().copyStyleSection("typography"));
    expect(store().styleClipboard).toBeNull();
    expect(notice()).toBe(styleSectionCopyEmptyNotice("Typography", "Paragraph"));
    // A div never offers Typography, even if a stale value is stored on it.
    run(() => store().setElementTypography("div", { color: "#ff0000" }));
    select(["div"]);
    expect(canCopyStyleSection(store(), "typography")).toBe(false);
    run(() => store().copyStyleSection("typography"));
    expect(store().styleClipboard).toBeNull();
  });

  it("unsupported destinations: only a div selected → nothing compatible; with text elements too → applied there, Typography skipped, one Undo", () => {
    basic();
    select(["a"]);
    run(() => store().copyStyleSection("typography"));
    select(["div"]);
    expect(canPasteStyleSection(store(), "typography")).toBe(false);
    run(() => store().pasteStyleSection("typography"));
    expect(notice()).toBe(STYLE_PASTE_NOTHING_COMPATIBLE_NOTICE);
    expect(store().past).toHaveLength(0);
    select(["div", "inner", "plain"], "plain");
    expect(canPasteStyleSection(store(), "typography")).toBe(true);
    run(() => store().pasteStyleSection("typography"));
    expect([node("inner").typography?.color, node("plain").typography?.color]).toEqual(["#ff0000", "#ff0000"]);
    expect(node("div").typography).toBeUndefined();
    expect(notice()).toBe(stylePastedWithSkipsNotice(["Typography"]));
    expect(store().past).toHaveLength(1);
    // Copy and paste never change the selection.
    expect(store().selection).toEqual({ ids: ["div", "inner", "plain"], primaryId: "plain" });
  });

  it("a style lock on any destination blocks the whole section paste", () => {
    load([
      { id: "a", tag: "p", text: "A", typography: { color: "#ff0000" } },
      { id: "lock", tag: "div", lockChildStyles: true, children: [{ id: "locked", tag: "p", text: "L" }] },
      { id: "free", tag: "p", text: "F" },
    ]);
    select(["a"]);
    run(() => store().copyStyleSection("typography"));
    select(["free", "locked"]);
    const before = store().document;
    run(() => store().pasteStyleSection("typography"));
    expect(store().document).toBe(before);
    expect(store().past).toHaveLength(0);
  });

  it("Content Layout section: Flex settings onto a Grid container; a Free container is skipped and named, not converted", () => {
    load([
      { id: "src", tag: "div", flowLayout: { display: "flex", flex }, children: [] },
      { id: "grid", tag: "div", flowLayout: { display: "grid", grid: { columns: 2, rows: "auto", rowGap: 0, columnGap: 0 } }, children: [] },
      { id: "free", tag: "div", layoutMode: "free", children: [] },
    ]);
    select(["src"]);
    run(() => store().copyStyleSection("layout"));
    select(["grid", "free"]);
    run(() => store().pasteStyleSection("layout"));
    expect(node("grid").flowLayout?.display).toBe("flex");
    expect(node("grid").flowLayout?.flex).toEqual(flex);
    expect(node("free").layoutMode).toBe("free");
    expect(node("free").flowLayout).toBeUndefined();
    expect(notice()).toBe(stylePastedWithSkipsNotice(["Content layout"]));
  });

  it("Flex child section copies only the item settings, never the parent's container settings", () => {
    load([
      { id: "row", tag: "div", flowLayout: { display: "flex", flex }, children: [{ id: "x", tag: "p", text: "X", flexChild: { grow: 3, shrink: 0, basis: "auto", alignSelf: "end" } }, { id: "y", tag: "p", text: "Y" }] },
    ]);
    select(["x"]);
    run(() => store().copyStyleSection("flexChild"));
    expect(Object.keys(store().styleClipboard!.groups)).toEqual(["flexChild"]);
    select(["y"]);
    run(() => store().pasteStyleSection("flexChild"));
    expect(node("y").flexChild).toEqual({ grow: 3, shrink: 0, basis: "auto", alignSelf: "end" });
    expect(node("y").flowLayout).toBeUndefined();
  });

  it("the element clipboard is untouched by section copy/paste", () => {
    basic();
    select(["b"]);
    run(() => store().copySelection());
    const elementClipboard = store().clipboard;
    select(["a"]);
    run(() => store().copyStyleSection("typography"));
    select(["plain"]);
    run(() => store().pasteStyleSection("typography"));
    expect(store().clipboard).toBe(elementClipboard);
  });
});

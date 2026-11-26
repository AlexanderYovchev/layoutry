import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MAX_NAVIGATION_LINKS } from "@/features/editor/commands/navigationLinkCommands";
import { createBasicNavbarNode, createNavbarLinkNode, createPaginationNode } from "@/features/editor/factories/navigationCompositions";
import { exportHtmlCss } from "@/features/export/utils/exportHtmlCss";
import type { ShadowLayer } from "@/features/editor/types/boxShadow";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { FreeLayoutGeometry } from "@/features/editor/types/layout";
import { normalizeSelection } from "@/features/editor/types/selection";
import { collectNodeIds } from "@/features/editor/utils/collectNodeIds";
import { findNodeById } from "@/features/editor/utils/findNodeById";
import { createProjectMetadata, serializeProject } from "@/features/project/utils/serializeProject";
import { FREE_GROUP_PASTE_REJECTED_NOTICE, NAVIGATION_LINK_LIMIT_PASTE_NOTICE, useEditorStore } from "./useEditorStore";

/**
 * BC-10.6 — final multi-selection audit, store level: the cross-feature
 * scenarios the per-checkpoint tests didn't combine (selection cleanup
 * across clipboard + Undo, Reset Undo/Redo across sections, complex values
 * untouched by unrelated edits, clipboard → shared edit → Undo chains,
 * Free cross-container placement, approximate bounds, legacy Navbars,
 * repeated Pagination pastes, interactions across Cut/Undo/Redo, and
 * serialization).
 */

const initialState = useEditorStore.getState();
const store = () => useEditorStore.getState();
const node = (id: string) => findNodeById(store().document, id);
const childIds = (id: string) => (node(id)?.children ?? []).map((child) => child.id);
const geometry = (id: string): FreeLayoutGeometry => node(id)!.freeLayout!;
const run = (action: () => void) => act(action);
const select = (ids: string[]) => run(() => store().setSelection(ids));
const load = (children: EditorElementNode[]) => run(() => store().replaceDocument({ id: "page-root", tag: "page", children }));
/** The selection as every consumer reads it (useSelectedNodes): ids that no longer exist dropped. */
const visibleSelection = () => normalizeSelection(store().selection, collectNodeIds(store().document));
const free = (id: string, width: number, height: number, children: EditorElementNode[] = []): EditorElementNode => ({
  id,
  tag: "div",
  layoutMode: "free",
  dimensions: { preferredWidth: width, preferredHeight: height, offsetX: 0, offsetY: 0 },
  children,
});
const overlaps = (p: FreeLayoutGeometry, q: FreeLayoutGeometry) => p.x < q.x + q.width && p.x + p.width > q.x && p.y < q.y + q.height && p.y + p.height > q.y;
const inside = (g: FreeLayoutGeometry, width: number, height: number) => g.x >= 0 && g.y >= 0 && g.x + g.width <= width && g.y + g.height <= height;
const px = (value: number) => ({ value, unit: "px" as const });
const flex = { direction: "row", wrap: "nowrap", justifyContent: "start", alignItems: "start", rowGap: 0, columnGap: 0 } as const;
const shadows: ShadowLayer[] = [
  { id: "s1", enabled: true, inset: false, offsetX: px(1), offsetY: px(2), blur: px(3), spread: px(0), color: "#000000" },
  { id: "s2", enabled: true, inset: true, offsetX: px(0), offsetY: px(0), blur: px(8), spread: px(2), color: "rgba(255, 0, 0, 0.5)" },
];
const gradient = { type: "linear" as const, angle: 30, stops: [{ id: "g1", color: "#000000", position: 0 }, { id: "g2", color: "#00ff00", position: 40 }, { id: "g3", color: "#ffffff", position: 100 }] };

/** page > box(section) > [h(h2), p], z(p), go(button → p; → z), row(flex div) > [c1, c2] */
function richDocument(): EditorElementNode[] {
  return [
    {
      id: "box",
      tag: "section",
      children: [
        { id: "h", tag: "h2", text: "H", typography: { lineHeight: px(40) }, boxShadow: shadows, background: { color: "#ff0000", sourceType: "gradient", gradient } },
        { id: "p", tag: "p", text: "P", typography: { lineHeight: px(20), fontStyle: "italic" }, spacing: { padding: { top: 4 } }, filters: { opacity: 0.5 }, transform: { rotateDeg: 10 } },
      ],
    },
    { id: "z", tag: "p", text: "Z" },
    {
      id: "go",
      tag: "button",
      text: "Go",
      interactions: [
        { id: "i-int", trigger: "click", action: "toggle", targetId: "p" },
        { id: "i-ext", trigger: "click", action: "toggle", targetId: "z" },
      ],
    },
    { id: "row", tag: "div", flowLayout: { display: "flex", flex }, children: [{ id: "c1", tag: "p", text: "C1" }, { id: "c2", tag: "p", text: "C2" }] },
  ];
}

describe("BC-10.6 audit", () => {
  beforeEach(() => useEditorStore.setState(initialState, true));
  afterEach(() => useEditorStore.setState(initialState, true));

  describe("selection cleanup across operations", () => {
    it("Undo/Redo of paste, cut and duplicate never leave a selected id that doesn't exist", () => {
      load(richDocument());
      const allValid = () => visibleSelection().ids.every((id) => node(id) !== undefined) && store().selection.ids.every((id) => node(id) !== undefined);
      select(["h", "z"]);
      run(() => store().copySelection());
      select(["row"]);
      run(() => store().pasteClipboard());
      expect(allValid()).toBe(true);
      run(() => store().undo());
      expect(allValid()).toBe(true);
      run(() => store().redo());
      expect(allValid()).toBe(true);
      select(["c1", "z"]);
      run(() => store().duplicateSelection());
      run(() => store().undo());
      expect(allValid()).toBe(true);
      select(["c1", "z"]);
      run(() => store().cutSelection());
      run(() => store().confirmPendingDeletion());
      expect(allValid()).toBe(true);
      run(() => store().undo());
      run(() => store().redo());
      expect(allValid()).toBe(true);
    });

    it("one selected element vanishing (Undo of its creation) keeps the other valid ids selected", () => {
      load(richDocument());
      select(["z"]);
      run(() => store().duplicateSelection());
      const copy = store().selection.ids[0];
      select(["h", copy]);
      run(() => store().undo());
      // Undo restores the selection saved with the entry; whatever is read never holds the vanished copy.
      expect(visibleSelection().ids).not.toContain(copy);
      // Stale ids in a selection are ignored by read-time normalization while valid ones remain.
      run(() => useEditorStore.setState({ selection: { ids: ["h", "gone", "z"], primaryId: "gone" } }));
      expect(visibleSelection()).toEqual({ ids: ["h", "z"], primaryId: "z" });
    });
  });

  describe("Reset: every selected element, one Undo step, Redo, unrelated CSS kept", () => {
    const cases: { name: string; reset: (ids: string[]) => void; read: (id: string) => unknown }[] = [
      { name: "typography line height", reset: (ids) => store().setElementsTypographyField(ids, "lineHeight", undefined), read: (id) => node(id)?.typography?.lineHeight },
      { name: "padding", reset: (ids) => store().setElementsSettings(ids, "padding", undefined), read: (id) => node(id)?.spacing?.padding },
      { name: "background colour", reset: (ids) => store().setElementsBackgroundField(ids, "color", undefined), read: (id) => node(id)?.background?.color },
      { name: "border width", reset: (ids) => store().setElementsBorderAllSidesField(ids, "width", undefined), read: (id) => node(id)?.border?.top?.width },
      { name: "box shadow", reset: (ids) => store().setElementsSettings(ids, "boxShadow", undefined), read: (id) => node(id)?.boxShadow },
      { name: "flex child", reset: (ids) => store().setElementsSettings(ids, "flexChild", undefined), read: (id) => node(id)?.flexChild },
    ];
    for (const testCase of cases) {
      it(testCase.name, () => {
        load([
          {
            id: "row",
            tag: "div",
            flowLayout: { display: "flex", flex },
            children: [
              { id: "a", tag: "h2", text: "A", typography: { lineHeight: px(30), color: "#111111" }, spacing: { padding: { top: 3 }, margin: { top: 7 } }, background: { color: "#ff0000", sourceType: "gradient", gradient }, border: { top: { width: px(2), style: "solid" } }, boxShadow: shadows, flexChild: { grow: 1, shrink: 1, basis: "auto", alignSelf: "center" }, transform: { rotateDeg: 5 } },
              { id: "b", tag: "p", text: "B", typography: { lineHeight: px(18) }, spacing: { padding: { left: 9 } }, background: { color: "#00ff00" }, border: { top: { width: px(4), style: "dashed" } }, boxShadow: [shadows[1]], flexChild: { grow: 0, shrink: 1, basis: "auto", alignSelf: "end" } },
            ],
          },
        ]);
        const before = ["a", "b"].map(testCase.read);
        run(() => testCase.reset(["a", "b"]));
        expect(["a", "b"].map(testCase.read)).toEqual([undefined, undefined]);
        // Unrelated CSS on the same elements survives.
        expect(node("a")?.transform).toEqual({ rotateDeg: 5 });
        expect(node("a")?.spacing?.margin).toEqual({ top: 7 });
        if (testCase.name !== "box shadow") expect(node("a")?.boxShadow).toEqual(shadows);
        if (testCase.name !== "background colour") expect(node("a")?.background?.gradient).toEqual(gradient);
        expect(store().past).toHaveLength(1);
        run(() => store().undo());
        expect(["a", "b"].map(testCase.read)).toEqual(before);
        run(() => store().redo());
        expect(["a", "b"].map(testCase.read)).toEqual([undefined, undefined]);
      });
    }

    it("a no-op shared edit adds no history; a selected parent + child are each edited once", () => {
      load(richDocument());
      run(() => store().setElementsTypographyField(["h", "p"], "fontStyle", "italic"));
      expect(store().past).toHaveLength(1);
      run(() => store().setElementsTypographyField(["h", "p"], "fontStyle", "italic"));
      expect(store().past).toHaveLength(1);
      run(() => store().setElementsSettings(["box", "p", "box"], "filters", { opacity: 0.3 }));
      expect([node("box")?.filters, node("p")?.filters]).toEqual([{ opacity: 0.3 }, { opacity: 0.3 }]);
      expect(store().past).toHaveLength(2);
    });

    it("resetting the gradient's colour leaves the multi-stop gradient and the multi-layer shadow untouched", () => {
      load(richDocument());
      run(() => store().setElementsBackgroundField(["h", "p"], "color", undefined));
      expect(node("h")?.background).toEqual({ sourceType: "gradient", gradient });
      expect(node("h")?.boxShadow).toEqual(shadows);
      expect(node("p")?.transform).toEqual({ rotateDeg: 10 });
    });
  });

  describe("workflow B (store): cross-container copy → paste → shared edit → Undo ×2 → Redo", () => {
    it("ids, hierarchy, selection and references stay valid at every step", () => {
      load(richDocument());
      select(["go", "p", "c2"]);
      run(() => store().copySelection());
      select(["page-root"]);
      run(() => store().pasteClipboard());
      const pasted = store().selection.ids;
      expect(pasted).toHaveLength(3);
      const [pCopy, goCopy] = pasted;
      expect(node(goCopy)?.interactions?.map((binding) => binding.targetId)).toEqual([pCopy, "z"]);
      run(() => store().setElementsTypographyField(pasted, "fontWeight", 700));
      expect(pasted.every((id) => node(id)?.typography?.fontWeight === 700)).toBe(true);
      expect(node("p")?.typography?.fontWeight).toBeUndefined();
      run(() => store().undo());
      expect(pasted.every((id) => node(id)?.typography?.fontWeight === undefined)).toBe(true);
      expect(store().selection.ids).toEqual(pasted);
      run(() => store().undo());
      expect(pasted.every((id) => node(id) === undefined)).toBe(true);
      run(() => store().redo());
      expect(node(goCopy)?.interactions?.map((binding) => binding.targetId)).toEqual([pCopy, "z"]);
      const all = [...collectNodeIds(store().document)];
      expect(new Set(all).size).toBe(all.length);
    });
  });

  describe("workflow C (store): interactions across Cut → Undo → Redo → Paste", () => {
    it("internal references remap, external ones stay, a cut external target is cleaned and restored", () => {
      load(richDocument());
      // Cut the external target and something else: the trigger's binding to z goes, as Delete does.
      select(["z", "c1"]);
      run(() => store().cutSelection());
      run(() => store().confirmPendingDeletion());
      expect(node("go")?.interactions?.map((binding) => binding.targetId)).toEqual(["p"]);
      run(() => store().undo());
      expect(node("go")?.interactions?.map((binding) => binding.targetId)).toEqual(["p", "z"]);
      run(() => store().redo());
      expect(node("go")?.interactions?.map((binding) => binding.targetId)).toEqual(["p"]);
      // Pasting the cut z back: a new element; the original trigger doesn't point at the copy.
      select(["page-root"]);
      run(() => store().pasteClipboard());
      expect(node("go")?.interactions?.map((binding) => binding.targetId)).toEqual(["p"]);
    });
  });

  describe("Free-layout placement", () => {
    it("repro (fixed in BC-10.6): copies from two different Free containers, both at (20,20), are not pasted on top of each other", () => {
      load([
        free("a", 600, 400, [{ id: "a1", tag: "p", text: "A1", freeLayout: { x: 20, y: 20, width: 100, height: 40 } }, { id: "a2", tag: "p", text: "A2", freeLayout: { x: 140, y: 60, width: 80, height: 30 } }]),
        free("b", 300, 200, [{ id: "b1", tag: "p", text: "B1", freeLayout: { x: 20, y: 20, width: 100, height: 40 } }]),
        free("to", 600, 400),
      ]);
      select(["a1", "a2", "b1"]);
      run(() => store().copySelection());
      select(["to"]);
      run(() => store().pasteClipboard());
      const [x1, x2, y1] = childIds("to");
      // Same-container copies keep their exact offsets; the other container's copy is a separate sub-group below.
      expect([geometry(x2).x - geometry(x1).x, geometry(x2).y - geometry(x1).y]).toEqual([120, 40]);
      expect(geometry(y1).y).toBe(geometry(x1).y + 70 + 16);
      expect(geometry(y1).x).toBe(geometry(x1).x);
      for (const [p, q] of [[x1, y1], [x2, y1], [x1, x2]]) expect(overlaps(geometry(p), geometry(q))).toBe(false);
      for (const id of [x1, x2, y1]) expect(inside(geometry(id), 600, 400)).toBe(true);
    });

    it("approximate bounds: near the edge / near capacity it lands inside or refuses whole, never shrinks", () => {
      load([
        free("from", 600, 400, [{ id: "w1", tag: "p", text: "W1", freeLayout: { x: 0, y: 0, width: 240, height: 40 } }, { id: "w2", tag: "div", freeLayout: { x: 0, y: 60, width: 90, height: 120 }, layoutMode: "free", children: [{ id: "deep", tag: "p", text: "D", freeLayout: { x: 3, y: 4, width: 50, height: 20 } }] }]),
        free("narrow", 260, 400, [{ id: "n0", tag: "p", text: "N0", freeLayout: { x: 16, y: 16, width: 200, height: 300 } }]),
        free("tiny", 200, 400),
      ]);
      select(["w1", "w2"]);
      run(() => store().copySelection());
      // 240 wide fits in 260 (16px margin and a cascade, overlap allowed only as the existing last resort).
      select(["narrow"]);
      run(() => store().pasteClipboard());
      for (let repeat = 0; repeat < 4; repeat++) {
        select(["narrow"]);
        run(() => store().pasteClipboard());
      }
      const pasted = childIds("narrow").slice(1);
      expect(pasted).toHaveLength(10);
      for (const id of pasted) expect(inside(geometry(id), 260, 400)).toBe(true);
      for (const id of pasted.filter((_, index) => index % 2 === 0)) expect(geometry(id).width).toBe(240);
      for (const id of pasted.filter((_, index) => index % 2 === 1)) expect(node(id)?.children?.[0].freeLayout).toEqual({ x: 3, y: 4, width: 50, height: 20 });
      // 240 wide doesn't fit in 200: refused whole, with the notice, no history.
      select(["tiny"]);
      const before = store().document;
      const history = store().past.length;
      run(() => store().pasteClipboard());
      expect(store().document).toBe(before);
      expect(store().past).toHaveLength(history);
      expect(store().editorNotice?.message).toBe(FREE_GROUP_PASTE_REJECTED_NOTICE);
    });
  });

  describe("Navbar limit: legacy over-limit nav", () => {
    const links = (prefix: string, count: number) => Array.from({ length: count }, (_, index) => ({ ...createNavbarLinkNode(`${prefix}${index}`), id: `${prefix}${index}` }));

    it("pasting a link into a nav that already has more than 12 is refused; the nav isn't rewritten", () => {
      load([{ id: "legacy", tag: "nav", children: links("l", MAX_NAVIGATION_LINKS + 2) }, { id: "other", tag: "nav", children: links("o", 2) }]);
      const legacyBefore = node("legacy");
      select(["o0"]);
      run(() => store().copySelection());
      select(["legacy"]);
      run(() => store().pasteClipboard());
      expect(node("legacy")).toBe(legacyBefore);
      expect(store().editorNotice?.message).toBe(NAVIGATION_LINK_LIMIT_PASTE_NOTICE);
      // Editing it otherwise is untouched by the limit (not a clipboard operation).
      run(() => store().setElementsTypographyField(["l0", "l1"], "fontWeight", 700));
      expect(node("l0")?.typography?.fontWeight).toBe(700);
    });
  });

  describe("Pagination: repeated paste, multi-duplicate, Undo/Redo", () => {
    it("never more than one current page; Undo/Redo restore valid structures", () => {
      const pagination = createPaginationNode();
      load([pagination]);
      const pages = pagination.children!.filter((child) => child.tag === "a" && /^\d$/.test(child.text ?? ""));
      const currents = () => (node(pagination.id)?.children ?? []).filter((link) => link.ariaCurrent === "page");
      select([pages[0].id, pages[2].id]);
      run(() => store().copySelection());
      for (let repeat = 0; repeat < 3; repeat++) {
        select([pagination.id]);
        run(() => store().pasteClipboard());
        expect(currents()).toHaveLength(1);
      }
      select([pages[0].id, pages[1].id]);
      run(() => store().duplicateSelection());
      expect(currents().map((link) => link.id)).toEqual([pages[0].id]);
      for (let step = 0; step < 4; step++) {
        run(() => store().undo());
        expect(currents()).toHaveLength(1);
      }
      for (let step = 0; step < 4; step++) {
        run(() => store().redo());
        expect(currents()).toHaveLength(1);
      }
    });
  });

  describe("workflow D (store): duplicate → reset → serialize", () => {
    it("the originals are unaffected by a Reset on the copies; the saved file has no selection, clipboard or Inspector state, format 3", () => {
      load(richDocument());
      select(["h", "p"]);
      run(() => store().copySelection());
      run(() => store().duplicateSelection());
      const copies = store().selection.ids;
      run(() => store().setElementsTypographyField(copies, "lineHeight", undefined));
      expect(copies.map((id) => node(id)?.typography?.lineHeight)).toEqual([undefined, undefined]);
      expect([node("h")?.typography?.lineHeight, node("p")?.typography?.lineHeight]).toEqual([px(40), px(20)]);
      const text = serializeProject({ metadata: createProjectMetadata({ id: "p", now: new Date(0) }), document: store().document });
      const file: unknown = JSON.parse(text);
      expect(file).toMatchObject({ formatVersion: 4, formatRevision: 0 });
      expect(text).not.toMatch(/"(selection|selectionAnchorId|clipboard|pendingDeletion|primaryId|mixed|unresolved|renderedStyles)"/);
      expect(text).toContain(copies[0]);
    });
  });

  describe("workflow E (store + export): complex components duplicated as a group", () => {
    it("Navbar, Pagination, trigger + target, nested container with gradient + shadow: valid tree, references, one current page, clean export", () => {
      const navbar = { ...createBasicNavbarNode(), htmlId: "site-nav" };
      const pagination = createPaginationNode();
      load([
        navbar,
        pagination,
        { id: "t-go", tag: "button", text: "Toggle", interactions: [{ id: "t-i", trigger: "click", action: "toggle", targetId: "t-target" }] },
        { id: "t-target", tag: "p", text: "Target", htmlId: "target" },
        { id: "nest", tag: "section", background: { color: "#ffffff", sourceType: "gradient", gradient }, children: [{ id: "inner", tag: "div", boxShadow: shadows, children: [{ id: "leaf", tag: "p", text: "Leaf" }] }] },
      ]);
      const exportCode = () => {
        const result = exportHtmlCss(store().document, { mode: "standalone", title: "audit" });
        return { result, html: result.files[0].content };
      };
      const before = exportCode();
      select([navbar.id, pagination.id, "t-go", "t-target", "nest", "leaf"]);
      run(() => store().duplicateSelection());
      expect(store().past).toHaveLength(1);
      const copies = store().selection.ids;
      expect(copies).toHaveLength(5);
      const top = childIds("page-root");
      // Each copy right after its original.
      for (const original of [navbar.id, pagination.id, "t-go", "t-target", "nest"]) expect(copies).toContain(top[top.indexOf(original) + 1]);
      const goCopy = top[top.indexOf("t-go") + 1];
      const targetCopy = top[top.indexOf("t-target") + 1];
      expect(node(goCopy)?.interactions?.[0].targetId).toBe(targetCopy);
      expect(node("t-go")?.interactions?.[0].targetId).toBe("t-target");
      const nestCopy = node(top[top.indexOf("nest") + 1])!;
      expect(nestCopy.background?.gradient).toEqual(gradient);
      expect(nestCopy.children?.[0].boxShadow).toEqual(shadows);
      expect(nestCopy.children?.[0].children).toHaveLength(1);
      const paginationCopy = node(top[top.indexOf(pagination.id) + 1])!;
      expect(paginationCopy.children?.filter((link) => link.ariaCurrent === "page")).toHaveLength(1);
      expect([node(top[top.indexOf(navbar.id) + 1])?.htmlId, node(targetCopy)?.htmlId]).toEqual(["site-nav-copy", "target-copy"]);

      const after = exportCode();
      expect(after.result.ok).toBe(true);
      expect(after.result.diagnostics.filter((diagnostic) => diagnostic.code === "duplicate-html-id")).toEqual([]);
      const count = (html: string, pattern: RegExp) => html.match(pattern)?.length ?? 0;
      expect(count(before.html, /aria-controls="/g)).toBeGreaterThan(0);
      expect(count(after.html, /aria-controls="/g)).toBe(2 * count(before.html, /aria-controls="/g));
      expect(count(after.html, /aria-current="page"/g)).toBe(2 * count(before.html, /aria-current="page"/g));
      expect(after.html).not.toMatch(/data-selected|selection/i);
      run(() => store().undo());
      expect(childIds("page-root")).toEqual([navbar.id, pagination.id, "t-go", "t-target", "nest"]);
    });
  });
});

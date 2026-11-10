import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { MAX_NAVIGATION_LINKS } from "@/features/editor/commands/navigationLinkCommands";
import { createButtonNode } from "@/features/editor/factories/elementFactories";
import {
  createBasicNavbarNode,
  createBreadcrumbsNode,
  createNavbarWithCtaNode,
} from "@/features/editor/factories/navigationCompositions";
import { getInteractions } from "@/features/editor/types/interactions";
import type { EditorElementNode } from "@/features/editor/types/document";
import { checkDocumentIntegrity } from "@/features/project/utils/checkDocumentIntegrity";
import { DEFAULT_PROJECT_LIMITS } from "@/features/project/rules/projectLimits";
import { exportHtmlCss } from "@/features/export/utils/exportHtmlCss";
import { findNodeById } from "@/features/editor/utils/findNodeById";
import { parseProjectFile } from "@/features/project/utils/parseProjectFile";
import { createProjectMetadata, serializeProject } from "@/features/project/utils/serializeProject";
import { selectHasUnsavedChanges, useEditorStore } from "./useEditorStore";

const initialState = useEditorStore.getState();
const store = () => useEditorStore.getState();

function save(document = store().document): string {
  return serializeProject({ metadata: createProjectMetadata({ id: "project-1", now: new Date(0) }), document });
}

function saveAndReopen(): EditorElementNode {
  const result = parseProjectFile(save());
  if (!result.ok) throw new Error(result.error.message);
  return result.project.document;
}

function nav(navId: string, root = store().document): EditorElementNode {
  const node = findNodeById(root, navId);
  if (!node) throw new Error(`missing ${navId}`);
  return node;
}

const order = (navId: string, root?: EditorElementNode) =>
  (nav(navId, root).children ?? []).map((child) => `${child.tag}:${child.text ?? ""}`);
const ids = (navId: string, root?: EditorElementNode) => (nav(navId, root).children ?? []).map((child) => child.id);

function insert(node: EditorElementNode): string {
  store().insertElement("page-root", node);
  return node.id;
}

function allIds(root: EditorElementNode): string[] {
  const out: string[] = [];
  const stack = [root];
  for (let node = stack.pop(); node; node = stack.pop()) {
    out.push(node.id);
    if (node.children) stack.push(...node.children);
  }
  return out;
}

function expectValid(root = store().document) {
  expect(checkDocumentIntegrity(root, DEFAULT_PROJECT_LIMITS)).toBeNull();
  const every = allIds(root);
  expect(new Set(every).size).toBe(every.length);
}

/** The links of `navId` in an exported page, as "text|href", in source order. */
function exportedLinks(navId: string): string[] {
  const result = exportHtmlCss(store().document, { mode: "standalone", title: "BC-06.3" });
  expect(result.ok, JSON.stringify(result.diagnostics)).toBe(true);
  const html = result.files[0].content;
  const navCount = nav(navId).children?.length ?? 0;
  const navs = Array.from(html.matchAll(/<nav\b[^>]*>([\s\S]*?)<\/nav>/g)).map((match) => match[1]);
  const target = navs.find((markup) => (markup.match(/<(a|button|p|div)\b/g) ?? []).length >= navCount) ?? "";
  return Array.from(target.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/g)).map((match) => `${match[2].trim()}|${match[1]}`);
}

/**
 * BC-06.3 — final regression of Navigation links management against the
 * production store, commands, validator, serializer and exporter.
 */
describe("Navigation links final regression (BC-06.3)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  describe("styling inheritance", () => {
    it("copies every customized style field of the last link, including authored zero spacing (format 2)", () => {
      const navId = insert(createBasicNavbarNode());
      const contact = nav(navId).children![3];
      store().setElementTypography(contact.id, {
        fontFamily: "Georgia, serif",
        fontSize: { value: 19, unit: "px" },
        fontWeight: 600,
        color: "#7c3aed",
      });
      store().setElementMargin(contact.id, { top: 0, right: 12, bottom: 0, left: 0 });
      store().setElementPadding(contact.id, { top: 4, right: 0, bottom: 4, left: 10 });
      store().setElementBackground(contact.id, { color: "#fef3c7" });
      store().setElementBorder(contact.id, {
        top: { width: { value: 2, unit: "px" }, style: "dashed", color: "#7c3aed" },
        right: { width: { value: 2, unit: "px" }, style: "dashed", color: "#7c3aed" },
        bottom: { width: { value: 2, unit: "px" }, style: "dashed", color: "#7c3aed" },
        left: { width: { value: 2, unit: "px" }, style: "dashed", color: "#7c3aed" },
      });
      store().setElementBorderRadius(contact.id, {
        topLeft: { value: 6, unit: "px" },
        topRight: { value: 6, unit: "px" },
        bottomRight: { value: 6, unit: "px" },
        bottomLeft: { value: 6, unit: "px" },
      });
      const source = nav(navId).children![3];

      store().addNavigationLink(navId);
      const added = nav(navId).children![4];
      for (const field of ["typography", "spacing", "background", "border", "borderRadius"] as const) {
        expect(added[field], field).toEqual(source[field]);
      }
      expect(added.spacing?.margin).toEqual({ top: 0, right: 12, bottom: 0, left: 0 });

      // Authored zeros survive save + reopen on the new link too.
      const reopened = findNodeById(saveAndReopen(), added.id)!;
      expect(reopened.spacing).toEqual(source.spacing);
      expect(reopened.typography).toEqual(source.typography);
      // The source link is untouched.
      expect(nav(navId).children![3]).toBe(source);
    });

    it("inherits from the LAST link, not the first or a CTA", () => {
      const navbar = createNavbarWithCtaNode();
      const navId = insert(navbar);
      const [home, , pricing] = navbar.children!;
      store().setElementTypography(home.id, { color: "#ff0000" });
      store().setElementTypography(pricing.id, { color: "#00aa00" });
      store().addNavigationLink(navId);
      expect(nav(navId).children![3].typography).toEqual({ color: "#00aa00" });
    });

    it("never inherits a hidden state from a hidden last link (BC-06-H): display none, visibility hidden, opacity 0", () => {
      const navId = insert(createBasicNavbarNode());
      const contact = nav(navId).children![3];
      store().setElementDisplay(contact.id, { display: "none", visibility: "hidden", cursor: "pointer" });
      store().setElementFilters(contact.id, { opacity: 0, blur: { value: 1, unit: "px" } });

      store().addNavigationLink(navId);

      const added = nav(navId).children![4];
      expect(added.display).toEqual({ cursor: "pointer" });
      expect(added.filters).toEqual({ blur: { value: 1, unit: "px" } });
      expectValid();
    });

    it("drops the display/filter records entirely when hiding was all they held", () => {
      const navId = insert(createBasicNavbarNode());
      const contact = nav(navId).children![3];
      store().setElementDisplay(contact.id, { display: "none" });
      store().setElementFilters(contact.id, { opacity: 0 });
      store().addNavigationLink(navId);
      const added = nav(navId).children![4];
      expect("display" in added).toBe(false);
      expect("filters" in added).toBe(false);
      expect(() => save()).not.toThrow();
    });

    it("keeps a visible-but-dimmed link's opacity (only 0 is a hidden state)", () => {
      const navId = insert(createBasicNavbarNode());
      store().setElementFilters(nav(navId).children![3].id, { opacity: 60 });
      store().addNavigationLink(navId);
      expect(nav(navId).children![4].filters).toEqual({ opacity: 60 });
    });
  });

  describe("count limits", () => {
    it("11 → 12 succeeds, the 13th is refused with no history; removal re-enables Add only below 12", () => {
      const navId = insert({ id: "nav-1", tag: "nav", children: Array.from({ length: 11 }, (_, i) => ({ id: `a-${i}`, tag: "a", text: `L${i}`, href: "#" })) });
      store().addNavigationLink(navId);
      expect(nav(navId).children).toHaveLength(12);
      const history = store().past.length;
      store().addNavigationLink(navId);
      expect(nav(navId).children).toHaveLength(MAX_NAVIGATION_LINKS);
      expect(store().past.length).toBe(history);
      store().removeNavigationLink(navId, "a-0");
      store().addNavigationLink(navId);
      expect(nav(navId).children).toHaveLength(12);
    });

    it("a 14-link nav is never truncated, can be edited, removed from and saved", () => {
      const navId = insert({ id: "nav-14", tag: "nav", children: Array.from({ length: 14 }, (_, i) => ({ id: `a-${i}`, tag: "a", text: `L${i}`, href: "#" })) });
      store().setElementText("a-5", "Edited");
      store().setElementHref("a-5", "/edited");
      store().moveNavigationLink(navId, "a-5", "up");
      store().addNavigationLink(navId);
      expect(nav(navId).children).toHaveLength(14);
      const reopened = saveAndReopen();
      expect(ids(navId, reopened)).toEqual(ids(navId));
      store().removeNavigationLink(navId, "a-13");
      store().removeNavigationLink(navId, "a-12");
      store().addNavigationLink(navId);
      expect(nav(navId).children).toHaveLength(12);
      store().removeNavigationLink(navId, "a-11");
      store().addNavigationLink(navId);
      expect(nav(navId).children).toHaveLength(12);
      expect(nav(navId).children!.at(-1)?.text).toBe("New link");
    });
  });

  describe("removal positions", () => {
    for (const [label, index, expected] of [
      ["first", 0, ["a:About", "a:Services", "a:Contact"]],
      ["middle", 2, ["a:Home", "a:About", "a:Contact"]],
      ["last", 3, ["a:Home", "a:About", "a:Services"]],
    ] as const) {
      it(`removes the ${label} link only; Undo/Redo round-trip; saveable throughout`, () => {
        const navId = insert(createBasicNavbarNode());
        const before = nav(navId);
        const removed = before.children![index];
        store().removeNavigationLink(navId, removed.id);
        expect(order(navId)).toEqual([...expected]);
        // Unrelated links are the same objects.
        for (const child of nav(navId).children!) expect(before.children).toContain(child);
        expectValid();
        store().undo();
        expect(nav(navId)).toEqual(before);
        store().redo();
        expect(order(navId)).toEqual([...expected]);
        expect(() => save()).not.toThrow();
      });
    }

    it("removes the only link, leaving an empty nav that still saves", () => {
      const navId = insert({ id: "nav-1", tag: "nav", children: [{ id: "a-only", tag: "a", text: "Only", href: "#" }] });
      store().removeNavigationLink(navId, "a-only");
      expect(nav(navId).children).toEqual([]);
      expect(() => save()).not.toThrow();
    });

    it("survives 10 repeated remove/Undo/Redo cycles with a targeted customized link", () => {
      const navId = insert(createBasicNavbarNode());
      const trigger = createButtonNode();
      insert(trigger);
      const about = nav(navId).children![1];
      store().setElementHref(about.id, "/about");
      store().setElementTypography(about.id, { color: "#123456", fontWeight: 700 });
      store().addInteraction(trigger.id, { trigger: "click", action: "toggle", targetId: about.id });
      const customized = nav(navId).children![1];
      for (let cycle = 0; cycle < 10; cycle++) {
        store().removeNavigationLink(navId, about.id);
        expect(getInteractions(findNodeById(store().document, trigger.id)!)).toEqual([]);
        expectValid();
        store().undo();
        expect(nav(navId).children![1]).toEqual(customized);
        expect(getInteractions(findNodeById(store().document, trigger.id)!)).toHaveLength(1);
        expectValid();
        store().redo();
        store().undo();
      }
      expect(() => save()).not.toThrow();
    });
  });

  describe("reordering", () => {
    it("first down, last up, middle up and middle down give the exact orders and keep ids", () => {
      const navId = insert(createBasicNavbarNode());
      const [home, about, services, contact] = ids(navId);
      store().moveNavigationLink(navId, home, "down");
      expect(ids(navId)).toEqual([about, home, services, contact]);
      store().moveNavigationLink(navId, contact, "up");
      expect(ids(navId)).toEqual([about, home, contact, services]);
      store().moveNavigationLink(navId, home, "up");
      expect(ids(navId)).toEqual([home, about, contact, services]);
      store().moveNavigationLink(navId, about, "down");
      expect(ids(navId)).toEqual([home, contact, about, services]);
    });

    it("reorders duplicate labels by id, keeping each link's destination, style and interactions", () => {
      const navId = insert({
        id: "nav-1",
        tag: "nav",
        children: [
          { id: "a-1", tag: "a", text: "Docs", href: "/v1", typography: { color: "#111111" } },
          { id: "a-2", tag: "a", text: "Docs", href: "/v2", typography: { color: "#222222" }, interactions: [{ id: "int-1", trigger: "click", action: "toggle", targetId: "a-1" }] },
        ],
      });
      const [first, second] = nav(navId).children!;
      store().moveNavigationLink(navId, "a-2", "up");
      expect(nav(navId).children).toEqual([second, first]);
      expect(nav(navId).children![0]).toBe(second);
      expectValid();
    });

    it("mixed content: links swap slots, every non-link child keeps its index and identity", () => {
      const nested: EditorElementNode = { id: "div-mixed", tag: "div", children: [{ id: "a-nested", tag: "a", text: "Nested", href: "#" }] };
      const children: EditorElementNode[] = [
        { id: "a-1", tag: "a", text: "One", href: "#" },
        { id: "button-mixed", tag: "button", text: "Action" },
        { id: "p-mixed", tag: "p", text: "|" },
        nested,
        { id: "a-2", tag: "a", text: "Two", href: "#" },
        { id: "a-3", tag: "a", text: "Three", href: "#" },
      ];
      const navId = insert({ id: "nav-mixed", tag: "nav", children });
      const before = nav(navId).children!;
      store().moveNavigationLink(navId, "a-1", "down");
      expect(ids(navId)).toEqual(["a-2", "button-mixed", "p-mixed", "div-mixed", "a-1", "a-3"]);
      for (const index of [1, 2, 3]) expect(nav(navId).children![index]).toBe(before[index]);
      store().addNavigationLink(navId);
      expect(ids(navId).slice(0, 6)).toEqual(["a-2", "button-mixed", "p-mixed", "div-mixed", "a-1", "a-3"]);
      expect(nav(navId).children![6].text).toBe("New link");
      store().removeNavigationLink(navId, "a-nested");
      expect(findNodeById(store().document, "a-nested")).toBeDefined();
      expect(nav(navId).children).toHaveLength(7);
      expectValid();
    });

    it("no-op moves and refused actions push no history", () => {
      const navbar = createNavbarWithCtaNode();
      const navId = insert(navbar);
      const history = store().past.length;
      const document = store().document;
      store().moveNavigationLink(navId, navbar.children![0].id, "up");
      store().moveNavigationLink(navId, navbar.children![2].id, "down");
      store().moveNavigationLink(navId, navbar.children![3].id, "up");
      store().removeNavigationLink(navId, navbar.children![3].id);
      store().removeNavigationLink("missing", navbar.children![0].id);
      expect(store().past.length).toBe(history);
      expect(store().document).toBe(document);
    });

    it("Breadcrumbs keep their separators when links move or are added", () => {
      const navId = insert(createBreadcrumbsNode());
      const separators = nav(navId).children!.filter((child) => child.tag === "p");
      store().moveNavigationLink(navId, nav(navId).children![2].id, "up");
      store().addNavigationLink(navId);
      expect(order(navId)).toEqual(["a:Products", "p:/", "a:Home", "p:/", "a:Current Page", "a:New link"]);
      expect(nav(navId).children!.filter((child) => child.tag === "p")).toEqual(separators);
    });
  });

  describe("descendant removal", () => {
    it("Delete of a whole nav removes bindings that targeted any of its links", () => {
      const navId = insert(createBasicNavbarNode());
      const trigger = createButtonNode();
      insert(trigger);
      for (const link of nav(navId).children!) store().addInteraction(trigger.id, { trigger: "click", action: "toggle", targetId: link.id });
      store().selectElement(navId);
      store().deleteSelection();
      expect(getInteractions(findNodeById(store().document, trigger.id)!)).toEqual([]);
      expectValid();
      store().undo();
      expect(getInteractions(findNodeById(store().document, trigger.id)!)).toHaveLength(4);
      store().redo();
      expect(() => save()).not.toThrow();
    });
  });

  describe("Undo/Redo stress sequence (brief section 13)", () => {
    it("add ×3, customize ×2, reorder, remove, Undo ×4, Redo ×2, add, save, reopen, export — consistent at every step", () => {
      const navId = insert(createNavbarWithCtaNode());
      const cta = nav(navId).children![3];
      const history0 = store().past.length;

      store().addNavigationLink(navId);
      store().addNavigationLink(navId);
      store().addNavigationLink(navId);
      const added = ids(navId).slice(3, 6);
      store().setElementText(added[0], "Blog");
      store().setElementHref(added[0], "/blog");
      store().setElementTypography(added[1], { color: "#b91c1c" });
      store().moveNavigationLink(navId, added[0], "up");
      store().moveNavigationLink(navId, added[0], "up");
      store().moveNavigationLink(navId, added[2], "up");
      store().removeNavigationLink(navId, added[1]);
      expect(store().past.length).toBe(history0 + 10);
      const afterRemove = store().document;
      expectValid();

      for (let i = 0; i < 4; i++) store().undo();
      // Back to just after the second customization.
      expect(order(navId)).toEqual(["a:Home", "a:Features", "a:Pricing", "a:Blog", "a:New link", "a:New link", "button:Get Started"]);
      expect(nav(navId).children![4].typography).toEqual({ color: "#b91c1c" });
      expectValid();

      store().redo();
      store().redo();
      expect(order(navId)).toEqual(["a:Home", "a:Blog", "a:Features", "a:Pricing", "a:New link", "a:New link", "button:Get Started"]);
      expect(store().future.length).toBe(2);
      expect(store().document).not.toBe(afterRemove);

      store().addNavigationLink(navId);
      expect(store().future).toEqual([]);
      const finalOrder = ["a:Home", "a:Blog", "a:Features", "a:Pricing", "a:New link", "a:New link", "a:New link", "button:Get Started"];
      expect(order(navId)).toEqual(finalOrder);
      expect(nav(navId).children!.at(-1)).toBe(cta);
      // The newest link copies the last link (added[2], plain) — not the red one.
      expect(nav(navId).children![6].typography).toEqual(nav(navId).children![5].typography);
      expectValid();

      expect(selectHasUnsavedChanges(store())).toBe(true);
      const text = save();
      store().markDocumentPersisted(store().document);
      expect(selectHasUnsavedChanges(store())).toBe(false);
      const reopened = parseProjectFile(text);
      if (!reopened.ok) throw new Error(reopened.error.message);
      expect(nav(navId, reopened.project.document)).toEqual(nav(navId));
      expect(exportedLinks(navId)).toEqual(["Home|#", "Blog|/blog", "Features|#", "Pricing|#", "New link|#", "New link|#", "New link|#"]);

      // Undo after save makes the document dirty again; Redo back to the saved one clears it.
      store().undo();
      expect(selectHasUnsavedChanges(store())).toBe(true);
      store().redo();
      expect(selectHasUnsavedChanges(store())).toBe(false);
    });
  });

  describe("copy, paste and duplication independence", () => {
    it("editing one of two navs never changes the other; internal interactions are remapped in the copy", () => {
      const navId = insert(createBasicNavbarNode());
      const [home, about] = nav(navId).children!;
      store().addInteraction(home.id, { trigger: "click", action: "toggle", targetId: about.id });
      store().selectElement(navId);
      store().duplicateSelection();
      const copyId = store().selection.primaryId!;
      const copy = nav(copyId);
      // The copy's Home toggles the copy's About, not the original's.
      expect(getInteractions(copy.children![0]).map((binding) => binding.targetId)).toEqual([copy.children![1].id]);

      const originalBefore = nav(navId);
      store().addNavigationLink(copyId);
      store().moveNavigationLink(copyId, copy.children![0].id, "down");
      store().removeNavigationLink(copyId, copy.children![1].id);
      expect(nav(navId)).toBe(originalBefore);

      // The copy's Home toggled the copy's About; removing it cleaned only that binding.
      expect(getInteractions(nav(copyId).children!.find((child) => child.id === copy.children![0].id)!)).toEqual([]);
      expect(getInteractions(nav(navId).children![0]).map((binding) => binding.targetId)).toEqual([about.id]);
      expectValid();
      expect(saveAndReopen()).toBeDefined();
    });

    it("pasting a Navbar twice gives three independent subtrees with unique ids", () => {
      const navId = insert(createNavbarWithCtaNode());
      store().selectElement(navId);
      store().copySelection();
      store().selectElement("page-root");
      store().pasteClipboard();
      const first = store().selection.primaryId!;
      store().selectElement("page-root");
      store().pasteClipboard();
      const second = store().selection.primaryId!;
      expect(new Set([navId, first, second]).size).toBe(3);
      store().addNavigationLink(second);
      expect(order(navId)).toHaveLength(4);
      expect(order(first)).toHaveLength(4);
      expect(order(second)).toEqual(["a:Home", "a:Features", "a:Pricing", "a:New link", "button:Get Started"]);
      expectValid();
    });

    it("duplicating a single link (Ctrl+D) then managing the nav keeps ids unique", () => {
      const navId = insert(createBasicNavbarNode());
      store().selectElement(nav(navId).children![1].id);
      store().duplicateSelection();
      expect(order(navId)).toEqual(["a:Home", "a:About", "a:About", "a:Services", "a:Contact"]);
      store().moveNavigationLink(navId, store().selection.primaryId!, "down");
      store().addNavigationLink(navId);
      expect(order(navId)).toEqual(["a:Home", "a:About", "a:Services", "a:About", "a:Contact", "a:New link"]);
      expectValid();
    });
  });

  describe("persistence", () => {
    it("a format 1 file whose Navbar has 14 links migrates without truncation and stays manageable", () => {
      const raw = JSON.parse(readFileSync(path.join(process.cwd(), "test", "fixtures", "persistence", "project-1.1-every-element.layoutry"), "utf8"));
      expect(raw.formatVersion).toBe(1);
      const legacyNav = findNodeById(raw.document, "nav-3ca05eea") as EditorElementNode;
      const template = legacyNav.children![3];
      for (let i = 0; i < 10; i++) legacyNav.children!.push({ ...template, id: `a-legacy${String(i).padStart(2, "0")}`, text: `Legacy ${i}` });
      const result = parseProjectFile(JSON.stringify(raw));
      if (!result.ok) throw new Error(result.error.message);
      store().replaceDocument(result.project.document);
      expect(nav("nav-3ca05eea").children).toHaveLength(14);

      store().addNavigationLink("nav-3ca05eea");
      expect(nav("nav-3ca05eea").children).toHaveLength(14);
      store().moveNavigationLink("nav-3ca05eea", "a-legacy09", "up");
      store().removeNavigationLink("nav-3ca05eea", "a-legacy00");

      const text = save();
      expect(JSON.parse(text).formatVersion).toBe(2);
      const reopened = parseProjectFile(text);
      if (!reopened.ok) throw new Error(reopened.error.message);
      expect(ids("nav-3ca05eea", reopened.project.document)).toEqual(ids("nav-3ca05eea"));
      expect(nav("nav-3ca05eea", reopened.project.document)).toEqual(nav("nav-3ca05eea"));
    });
  });

  describe("workload", () => {
    it("100 add/move/remove cycles keep the document bounded and every step exactly one history entry", () => {
      const navId = insert(createNavbarWithCtaNode());
      const baseline = nav(navId);
      const history0 = store().past.length;
      const started = performance.now();
      for (let cycle = 0; cycle < 100; cycle++) {
        store().addNavigationLink(navId);
        const newId = ids(navId)[3];
        store().moveNavigationLink(navId, newId, "up");
        store().moveNavigationLink(navId, newId, "down");
        store().removeNavigationLink(navId, newId);
      }
      const elapsed = performance.now() - started;
      expect(order(navId)).toEqual(baseline.children!.map((child) => `${child.tag}:${child.text ?? ""}`));
      expect(ids(navId)).toEqual(baseline.children!.map((child) => child.id));
      expect(store().past.length).toBe(history0 + 400);
      expectValid();
      process.stdout.write(`[BC-06.3 workload] 400 operations in ${elapsed.toFixed(1)} ms; history ${store().past.length} entries (uncapped by design)
`);

      for (let i = 0; i < 400; i++) store().undo();
      expect(nav(navId)).toEqual(baseline);
      for (let i = 0; i < 400; i++) store().redo();
      expect(ids(navId)).toEqual(baseline.children!.map((child) => child.id));
      expectValid();
    });
  });
});

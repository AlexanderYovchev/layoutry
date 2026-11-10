import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { MAX_NAVIGATION_LINKS } from "@/features/editor/commands/navigationLinkCommands";
import { createButtonNode, createNavNode } from "@/features/editor/factories/elementFactories";
import {
  createBasicNavbarNode,
  createBreadcrumbsNode,
  createNavbarWithCtaNode,
} from "@/features/editor/factories/navigationCompositions";
import { getInteractions } from "@/features/editor/types/interactions";
import type { EditorElementNode } from "@/features/editor/types/document";
import { collectNodeIds } from "@/features/editor/utils/collectNodeIds";
import { findNodeById } from "@/features/editor/utils/findNodeById";
import { parseProjectFile } from "@/features/project/utils/parseProjectFile";
import { createProjectMetadata, serializeProject } from "@/features/project/utils/serializeProject";
import { useEditorStore } from "./useEditorStore";

const initialState = useEditorStore.getState();
const store = () => useEditorStore.getState();

function saveAndReopen(): EditorElementNode {
  const text = serializeProject({ metadata: createProjectMetadata({ id: "project-1", now: new Date(0) }), document: store().document });
  const result = parseProjectFile(text);
  if (!result.ok) throw new Error(result.error.message);
  return result.project.document;
}

function navNow(navId: string): EditorElementNode {
  const node = findNodeById(store().document, navId);
  if (!node) throw new Error(`missing ${navId}`);
  return node;
}

function children(navId: string): string[] {
  return (navNow(navId).children ?? []).map((child) => `${child.tag}:${child.text ?? ""}`);
}

function insert(node: EditorElementNode): string {
  store().insertElement("page-root", node);
  return node.id;
}

function allIdsUnique(root: EditorElementNode): boolean {
  const ids = collectNodeIds(root);
  let count = 0;
  const stack = [root];
  for (let node = stack.pop(); node; node = stack.pop()) {
    count += 1;
    if (node.children) stack.push(...node.children);
  }
  return ids.size === count;
}

describe("Navigation links store actions (BC-06.2)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  describe("addNavigationLink", () => {
    it("adds one styled 'New link' after the last link as one history entry, keeping the nav selected", () => {
      const navId = insert(createBasicNavbarNode());
      const contact = navNow(navId).children![3];
      store().setElementTypography(contact.id, { color: "#aa0000", fontWeight: 700 });
      store().selectElement(navId);
      const historyBefore = store().past.length;

      store().addNavigationLink(navId);

      expect(store().past.length).toBe(historyBefore + 1);
      expect(children(navId)).toEqual(["a:Home", "a:About", "a:Services", "a:Contact", "a:New link"]);
      const added = navNow(navId).children![4];
      expect(added.href).toBe("#");
      expect(added.typography).toEqual({ color: "#aa0000", fontWeight: 700 });
      expect(added.id).not.toBe(contact.id);
      expect(store().selection).toEqual({ ids: [navId], primaryId: navId });
      expect(allIdsUnique(store().document)).toBe(true);
    });

    it("lands before Navbar with CTA's button, which stays last and untouched", () => {
      const navbar = createNavbarWithCtaNode();
      const cta = navbar.children![3];
      const navId = insert(navbar);
      store().addNavigationLink(navId);
      expect(children(navId)).toEqual(["a:Home", "a:Features", "a:Pricing", "a:New link", "button:Get Started"]);
      expect(navNow(navId).children![4]).toBe(cta);
    });

    it("never copies the last link's interactions, authored id or destination", () => {
      const navId = insert(createBasicNavbarNode());
      const target = createButtonNode();
      insert(target);
      const contact = navNow(navId).children![3];
      store().setElementHref(contact.id, "/contact");
      store().setElementHtmlId(contact.id, "contact");
      store().addInteraction(contact.id, { trigger: "click", action: "toggle", targetId: target.id });

      store().addNavigationLink(navId);

      const added = navNow(navId).children![4];
      expect(added.href).toBe("#");
      expect(added.htmlId).toBeUndefined();
      expect(getInteractions(added)).toEqual([]);
      expect(() => saveAndReopen()).not.toThrow();
    });

    it("an empty nav gets the starter Navbar link, and does not crash", () => {
      const navId = insert(createNavNode());
      store().addNavigationLink(navId);
      expect(navNow(navId).children).toEqual([expect.objectContaining({ tag: "a", text: "New link", href: "#", typography: { color: "#3f3f46" } })]);
    });

    it(`stops at ${MAX_NAVIGATION_LINKS} links with no history entry for the refused add`, () => {
      const navId = insert(createBasicNavbarNode());
      for (let i = 0; i < 20; i++) store().addNavigationLink(navId);
      const links = navNow(navId).children!.filter((child) => child.tag === "a");
      expect(links).toHaveLength(MAX_NAVIGATION_LINKS);
      const historyAtCap = store().past.length;
      const documentAtCap = store().document;
      store().addNavigationLink(navId);
      expect(store().past.length).toBe(historyAtCap);
      expect(store().document).toBe(documentAtCap);
    });

    it("keeps a nav that already has more than 12 links, and refuses to add", () => {
      const over: EditorElementNode = {
        id: "nav-over",
        tag: "nav",
        children: Array.from({ length: 14 }, (_, index) => ({ id: `a-over-${index}`, tag: "a", text: `Link ${index}`, href: "#" })),
      };
      insert(over);
      store().addNavigationLink("nav-over");
      expect(navNow("nav-over").children).toHaveLength(14);
      store().removeNavigationLink("nav-over", "a-over-0");
      store().removeNavigationLink("nav-over", "a-over-1");
      expect(navNow("nav-over").children).toHaveLength(12);
      store().addNavigationLink("nav-over");
      expect(navNow("nav-over").children).toHaveLength(12);
      store().removeNavigationLink("nav-over", "a-over-2");
      store().addNavigationLink("nav-over");
      expect(navNow("nav-over").children).toHaveLength(12);
      expect(navNow("nav-over").children!.at(-1)?.text).toBe("New link");
    });

    it("places a new link in a Free-layout nav like any insertion", () => {
      const navbar = createBasicNavbarNode();
      const navId = insert({ ...navbar, layoutMode: "free", children: navbar.children!.map((child, index) => ({ ...child, freeLayout: { x: index * 90, y: 8, width: 80, height: 24 } })) });
      store().addNavigationLink(navId);
      const added = navNow(navId).children![4];
      expect(added.freeLayout).toBeDefined();
    });

    it("Undo removes the added link; Redo restores the same id", () => {
      const navId = insert(createBasicNavbarNode());
      store().addNavigationLink(navId);
      const addedId = navNow(navId).children![4].id;
      store().undo();
      expect(navNow(navId).children).toHaveLength(4);
      store().redo();
      expect(navNow(navId).children![4].id).toBe(addedId);
    });
  });

  describe("removeNavigationLink", () => {
    it("removes exactly the chosen link as one entry; Undo restores it whole, in place", () => {
      const navbar = createNavbarWithCtaNode();
      const navId = insert(navbar);
      const features = navNow(navId).children![1];
      store().setElementHref(features.id, "/features");
      store().setElementTypography(features.id, { color: "#0000aa" });
      const customized = navNow(navId).children![1];
      store().selectElement(navId);
      const historyBefore = store().past.length;

      store().removeNavigationLink(navId, features.id);

      expect(store().past.length).toBe(historyBefore + 1);
      expect(children(navId)).toEqual(["a:Home", "a:Pricing", "button:Get Started"]);
      expect(store().selection.primaryId).toBe(navId);

      store().undo();
      expect(navNow(navId).children![1]).toEqual(customized);
      store().redo();
      expect(children(navId)).toEqual(["a:Home", "a:Pricing", "button:Get Started"]);
    });

    it("refuses to remove the CTA through the link list", () => {
      const navbar = createNavbarWithCtaNode();
      const navId = insert(navbar);
      const historyBefore = store().past.length;
      store().removeNavigationLink(navId, navbar.children![3].id);
      expect(navNow(navId).children).toHaveLength(4);
      expect(store().past.length).toBe(historyBefore);
    });

    it("removes the interaction that targeted the link, keeps the others, and the project stays saveable", () => {
      const navId = insert(createBasicNavbarNode());
      const trigger = createButtonNode();
      insert(trigger);
      const [home, about] = navNow(navId).children!;
      store().addInteraction(trigger.id, { trigger: "click", action: "toggle", targetId: about.id });
      store().addInteraction(trigger.id, { trigger: "click", action: "hide", targetId: home.id });
      // A binding ON the removed link that targets a surviving node.
      store().addInteraction(about.id, { trigger: "click", action: "show", targetId: home.id });

      store().removeNavigationLink(navId, about.id);

      expect(getInteractions(findNodeById(store().document, trigger.id)!).map((binding) => binding.targetId)).toEqual([home.id]);
      expect(() => saveAndReopen()).not.toThrow();
      store().undo();
      expect(getInteractions(findNodeById(store().document, trigger.id)!).map((binding) => binding.targetId)).toEqual([about.id, home.id]);
      expect(getInteractions(findNodeById(store().document, about.id)!)).toHaveLength(1);
      expect(() => saveAndReopen()).not.toThrow();
    });

    it("allows removing every link; the nav and its CTA remain", () => {
      const navbar = createNavbarWithCtaNode();
      const navId = insert(navbar);
      for (const link of navbar.children!.slice(0, 3)) store().removeNavigationLink(navId, link.id);
      expect(children(navId)).toEqual(["button:Get Started"]);
      store().addNavigationLink(navId);
      expect(children(navId)).toEqual(["a:New link", "button:Get Started"]);
    });
  });

  describe("moveNavigationLink", () => {
    it("moves up and down, one entry each, preserving the link node; Undo/Redo restore order", () => {
      const navId = insert(createBasicNavbarNode());
      const about = navNow(navId).children![1];
      const historyBefore = store().past.length;

      store().moveNavigationLink(navId, about.id, "down");
      expect(children(navId)).toEqual(["a:Home", "a:Services", "a:About", "a:Contact"]);
      expect(navNow(navId).children![2]).toBe(about);
      store().moveNavigationLink(navId, about.id, "up");
      store().moveNavigationLink(navId, about.id, "up");
      expect(children(navId)).toEqual(["a:About", "a:Home", "a:Services", "a:Contact"]);
      expect(store().past.length).toBe(historyBefore + 3);

      store().undo();
      expect(children(navId)).toEqual(["a:Home", "a:About", "a:Services", "a:Contact"]);
      store().redo();
      expect(children(navId)).toEqual(["a:About", "a:Home", "a:Services", "a:Contact"]);
    });

    it("pushes no history entry at either end", () => {
      const navId = insert(createBasicNavbarNode());
      const [home, , , contact] = navNow(navId).children!;
      const historyBefore = store().past.length;
      store().moveNavigationLink(navId, home.id, "up");
      store().moveNavigationLink(navId, contact.id, "down");
      expect(store().past.length).toBe(historyBefore);
    });

    it("keeps interactions on and to a moved link working", () => {
      const navId = insert(createBasicNavbarNode());
      const [home, about] = navNow(navId).children!;
      store().addInteraction(home.id, { trigger: "click", action: "toggle", targetId: about.id });
      store().moveNavigationLink(navId, home.id, "down");
      expect(getInteractions(findNodeById(store().document, home.id)!).map((binding) => binding.targetId)).toEqual([about.id]);
      expect(() => saveAndReopen()).not.toThrow();
    });

    it("never moves Breadcrumbs separators", () => {
      const navId = insert(createBreadcrumbsNode());
      const current = navNow(navId).children![4];
      store().moveNavigationLink(navId, current.id, "up");
      expect(children(navId)).toEqual(["a:Home", "p:/", "a:Current Page", "p:/", "a:Products"]);
    });
  });

  describe("copy, paste, duplicate, save and reopen", () => {
    it("a duplicated Navbar has fresh ids, the same links and order; Add copies from its own last link", () => {
      const navId = insert(createBasicNavbarNode());
      store().addNavigationLink(navId);
      store().moveNavigationLink(navId, navNow(navId).children![4].id, "up");
      store().selectElement(navId);
      store().duplicateSelection();
      const copyId = store().selection.primaryId!;
      expect(copyId).not.toBe(navId);
      expect(children(copyId)).toEqual(children(navId));
      expect(allIdsUnique(store().document)).toBe(true);

      // Restyle the copy's last link: the copy's Add must follow it, the original's must not.
      const copyLast = navNow(copyId).children!.at(-1)!;
      store().setElementTypography(copyLast.id, { color: "#00aa00" });
      store().addNavigationLink(copyId);
      store().addNavigationLink(navId);
      expect(navNow(copyId).children!.at(-1)?.typography).toEqual({ color: "#00aa00" });
      expect(navNow(navId).children!.at(-1)?.typography).toEqual({ color: "#3f3f46" });
      expect(allIdsUnique(store().document)).toBe(true);
    });

    it("copy + paste of an edited Navbar with CTA keeps links, order, styling, URLs and the CTA", () => {
      const navId = insert(createNavbarWithCtaNode());
      store().addNavigationLink(navId);
      const added = navNow(navId).children![3];
      store().setElementHref(added.id, "/blog");
      store().selectElement(navId);
      store().copySelection();
      store().selectElement("page-root");
      store().pasteClipboard();
      const pastedId = store().selection.primaryId!;
      expect(pastedId).not.toBe(navId);
      expect(children(pastedId)).toEqual(["a:Home", "a:Features", "a:Pricing", "a:New link", "button:Get Started"]);
      expect(navNow(pastedId).children![3].href).toBe("/blog");
      expect(allIdsUnique(store().document)).toBe(true);
    });

    it("save and reopen preserves management changes exactly", () => {
      const navId = insert(createNavbarWithCtaNode());
      store().addNavigationLink(navId);
      store().moveNavigationLink(navId, navNow(navId).children![0].id, "down");
      store().removeNavigationLink(navId, navNow(navId).children![2].id);
      const reopened = saveAndReopen();
      expect(findNodeById(reopened, navId)).toEqual(navNow(navId));
    });

    it("a format 1 project's Navbar migrates and can be managed and saved (no format change)", () => {
      const text = readFileSync(path.join(process.cwd(), "test", "fixtures", "persistence", "project-1.1-every-element.layoutry"), "utf8");
      const result = parseProjectFile(text);
      if (!result.ok) throw new Error(result.error.message);
      store().replaceDocument(result.project.document);
      const navId = "nav-3ca05eea";
      expect(children(navId)).toEqual(["a:Home", "a:About", "a:Services", "a:Contact"]);

      store().addNavigationLink(navId);
      store().moveNavigationLink(navId, navNow(navId).children![4].id, "up");
      store().removeNavigationLink(navId, navNow(navId).children![0].id);

      expect(children(navId)).toEqual(["a:About", "a:Services", "a:New link", "a:Contact"]);
      const saved = serializeProject({ metadata: result.project.metadata, document: store().document });
      expect(JSON.parse(saved).formatVersion).toBe(2);
      expect(parseProjectFile(saved).ok).toBe(true);
    });
  });
});

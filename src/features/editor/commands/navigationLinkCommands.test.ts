import { describe, expect, it } from "vitest";
import {
  canAddNavigationLink,
  createNavigationLink,
  getNavigationLinks,
  insertNavigationLink,
  isNavigationLinkContainer,
  MAX_NAVIGATION_LINKS,
  moveNavigationLink,
  NEW_NAVIGATION_LINK_TEXT,
  removeNavigationLink,
} from "@/features/editor/commands/navigationLinkCommands";
import {
  createBasicNavbarNode,
  createBreadcrumbsNode,
  createNavbarWithCtaNode,
} from "@/features/editor/factories/navigationCompositions";
import { createNavNode } from "@/features/editor/factories/elementFactories";
import type { EditorElementNode } from "@/features/editor/types/document";

function page(...children: EditorElementNode[]): EditorElementNode {
  return { id: "page-root", tag: "page", children };
}

function link(id: string, text = id): EditorElementNode {
  return { id, tag: "a", text, href: "#" };
}

function nav(id: string, children: EditorElementNode[]): EditorElementNode {
  return { id, tag: "nav", children };
}

function childTexts(root: EditorElementNode, navId: string): string[] {
  const target = root.children?.find((child) => child.id === navId);
  return (target?.children ?? []).map((child) => `${child.tag}:${child.text ?? ""}`);
}

describe("navigation link eligibility (BC-06.2)", () => {
  it("every nav qualifies; other containers do not", () => {
    expect(isNavigationLinkContainer(createBasicNavbarNode())).toBe(true);
    expect(isNavigationLinkContainer(createNavNode())).toBe(true);
    expect(isNavigationLinkContainer({ id: "div-1", tag: "div", children: [link("a-1")] })).toBe(false);
    expect(getNavigationLinks({ id: "div-1", tag: "div", children: [link("a-1")] })).toEqual([]);
  });

  it("finds the four default Navbar links in order", () => {
    expect(getNavigationLinks(createBasicNavbarNode()).map((child) => child.text)).toEqual(["Home", "About", "Services", "Contact"]);
  });

  it("does not count Navbar with CTA's button as a link", () => {
    const navbar = createNavbarWithCtaNode();
    expect(navbar.children).toHaveLength(4);
    expect(getNavigationLinks(navbar).map((child) => child.text)).toEqual(["Home", "Features", "Pricing"]);
  });

  it("lists only direct links in a mixed nav (separators and nested links are not links of this nav)", () => {
    const breadcrumbs = createBreadcrumbsNode();
    expect(getNavigationLinks(breadcrumbs).map((child) => child.text)).toEqual(["Home", "Products", "Current Page"]);
    const wrapped = nav("nav-1", [{ id: "div-1", tag: "div", children: [link("a-nested")] }, link("a-1")]);
    expect(getNavigationLinks(wrapped).map((child) => child.id)).toEqual(["a-1"]);
  });
});

describe("createNavigationLink", () => {
  const template: EditorElementNode = {
    id: "a-template",
    tag: "a",
    text: "Contact",
    href: "/contact",
    htmlId: "contact-link",
    displayName: "Contact link",
    title: "Contact us",
    className: "nav-item",
    typography: { color: "#ff0000", fontSize: { value: 18, unit: "px" } },
    spacing: { padding: { top: 4, right: 8, bottom: 4, left: 8 } },
    background: { color: "#eeeeee" },
    border: { bottom: { width: { value: 2, unit: "px" }, style: "solid", color: "#000000" } },
    borderRadius: { topLeft: { value: 4, unit: "px" } },
    dimensions: { preferredWidth: 120, preferredHeight: 40, offsetX: 0, offsetY: 0 },
    freeLayout: { x: 10, y: 10, width: 120, height: 40 },
    aspectRatioLocked: true,
    interactions: [{ id: "interaction-1", trigger: "click", action: "toggle", targetId: "div-x" }],
    initialPreviewVisibility: "hidden",
    position: { position: "absolute", top: { value: 0, unit: "px" }, left: { value: 300, unit: "px" } },
    gridChild: { columnStart: 4, columnSpan: 2, rowStart: 1, rowSpan: 1 },
  };

  it("copies style fields but gets its own id, text and safe destination", () => {
    const created = createNavigationLink(template);
    expect(created.id).not.toBe(template.id);
    expect(created.id).toMatch(/^a-/);
    expect(created.tag).toBe("a");
    expect(created.text).toBe(NEW_NAVIGATION_LINK_TEXT);
    expect(created.href).toBe("#");
    expect(created.typography).toEqual(template.typography);
    expect(created.spacing).toEqual(template.spacing);
    expect(created.background).toEqual(template.background);
    expect(created.border).toEqual(template.border);
    expect(created.borderRadius).toEqual(template.borderRadius);
    expect(created.className).toBe("nav-item");
  });

  it("never copies identity, behaviour, per-link content or per-link size", () => {
    const created = createNavigationLink(template);
    for (const field of ["htmlId", "interactions", "initialPreviewVisibility", "displayName", "title", "dimensions", "freeLayout", "aspectRatioLocked", "position", "children"] as const) {
      expect(created[field]).toBeUndefined();
    }
  });

  it("copies grid spans but auto-places the new link instead of reusing the template's cell", () => {
    expect(createNavigationLink(template).gridChild).toEqual({ columnStart: "auto", columnSpan: 2, rowStart: "auto", rowSpan: 1 });
    expect(template.gridChild).toEqual({ columnStart: 4, columnSpan: 2, rowStart: 1, rowSpan: 1 });
  });

  it("does not share nested style objects with the template", () => {
    const created = createNavigationLink(template);
    expect(created.typography).not.toBe(template.typography);
    expect(created.spacing).not.toBe(template.spacing);
  });

  it("uses the starter Navbar link when there is nothing to copy", () => {
    const created = createNavigationLink(undefined);
    expect(created).toMatchObject({ tag: "a", text: NEW_NAVIGATION_LINK_TEXT, href: "#", typography: { color: "#3f3f46" } });
  });

  it("gives every new link a unique id", () => {
    const ids = new Set(Array.from({ length: 50 }, () => createNavigationLink(template).id));
    expect(ids.size).toBe(50);
  });
});

describe("insertNavigationLink", () => {
  it("inserts after the last link, keeping a trailing CTA last", () => {
    const navbar = createNavbarWithCtaNode();
    const root = page(navbar);
    const next = insertNavigationLink(root, navbar.id, link("a-new", "New link"));
    expect(childTexts(next, navbar.id)).toEqual(["a:Home", "a:Features", "a:Pricing", "a:New link", "button:Get Started"]);
  });

  it("inserts first in a nav with no links, before any other child", () => {
    const root = page(nav("nav-1", [{ id: "button-1", tag: "button", text: "CTA" }]));
    const next = insertNavigationLink(root, "nav-1", link("a-new", "New link"));
    expect(childTexts(next, "nav-1")).toEqual(["a:New link", "button:CTA"]);
    const empty = page(nav("nav-2", []));
    expect(childTexts(insertNavigationLink(empty, "nav-2", link("a-new", "New link")), "nav-2")).toEqual(["a:New link"]);
  });

  it(`refuses at ${MAX_NAVIGATION_LINKS} links, counting links only`, () => {
    const links = Array.from({ length: MAX_NAVIGATION_LINKS }, (_, index) => link(`a-${index}`));
    const full = page(nav("nav-1", [...links, { id: "button-1", tag: "button", text: "CTA" }]));
    expect(canAddNavigationLink(full.children![0])).toBe(false);
    expect(insertNavigationLink(full, "nav-1", link("a-new"))).toBe(full);

    const almost = page(nav("nav-1", [...links.slice(1), { id: "button-1", tag: "button", text: "CTA" }]));
    expect(canAddNavigationLink(almost.children![0])).toBe(true);
    expect(insertNavigationLink(almost, "nav-1", link("a-new"))).not.toBe(almost);
  });

  it("keeps an over-limit nav intact and refuses to add to it", () => {
    const over = page(nav("nav-1", Array.from({ length: 15 }, (_, index) => link(`a-${index}`))));
    expect(insertNavigationLink(over, "nav-1", link("a-new"))).toBe(over);
    expect(getNavigationLinks(over.children![0])).toHaveLength(15);
  });

  it("is a no-op for a non-nav id or a non-link node", () => {
    const root = page({ id: "div-1", tag: "div", children: [] }, nav("nav-1", []));
    expect(insertNavigationLink(root, "div-1", link("a-new"))).toBe(root);
    expect(insertNavigationLink(root, "nav-1", { id: "button-1", tag: "button" })).toBe(root);
    expect(insertNavigationLink(root, "missing", link("a-new"))).toBe(root);
  });
});

describe("removeNavigationLink", () => {
  it("removes exactly the chosen link and keeps everything else in place", () => {
    const navbar = createNavbarWithCtaNode();
    const features = navbar.children![1];
    const root = page(navbar);
    const next = removeNavigationLink(root, navbar.id, features.id);
    expect(childTexts(next, navbar.id)).toEqual(["a:Home", "a:Pricing", "button:Get Started"]);
    // Surviving children are the same objects.
    expect(next.children![0].children![0]).toBe(navbar.children![0]);
  });

  it("never removes a non-link child, even by id", () => {
    const navbar = createNavbarWithCtaNode();
    const cta = navbar.children![3];
    const root = page(navbar);
    expect(removeNavigationLink(root, navbar.id, cta.id)).toBe(root);
  });

  it("is a no-op for a link of another nav or an unknown id", () => {
    const root = page(nav("nav-1", [link("a-1")]), nav("nav-2", [link("a-2")]));
    expect(removeNavigationLink(root, "nav-1", "a-2")).toBe(root);
    expect(removeNavigationLink(root, "nav-1", "missing")).toBe(root);
  });
});

describe("moveNavigationLink", () => {
  it("moves a link one place up or down", () => {
    const root = page(nav("nav-1", [link("a-1", "Home"), link("a-2", "About"), link("a-3", "Services")]));
    const down = moveNavigationLink(root, "nav-1", "a-1", "down");
    expect(childTexts(down, "nav-1")).toEqual(["a:About", "a:Home", "a:Services"]);
    const up = moveNavigationLink(down, "nav-1", "a-3", "up");
    expect(childTexts(up, "nav-1")).toEqual(["a:About", "a:Services", "a:Home"]);
  });

  it("reuses the same node objects (ids, styles and interactions untouched)", () => {
    const styled: EditorElementNode = {
      ...link("a-1", "Home"),
      typography: { color: "#123456" },
      interactions: [{ id: "interaction-1", trigger: "click", action: "toggle", targetId: "a-2" }],
    };
    const root = page(nav("nav-1", [styled, link("a-2", "About")]));
    const next = moveNavigationLink(root, "nav-1", "a-1", "down");
    expect(next.children![0].children![1]).toBe(styled);
  });

  it("is a no-op at either end and for an unknown id", () => {
    const root = page(nav("nav-1", [link("a-1"), link("a-2")]));
    expect(moveNavigationLink(root, "nav-1", "a-1", "up")).toBe(root);
    expect(moveNavigationLink(root, "nav-1", "a-2", "down")).toBe(root);
    expect(moveNavigationLink(root, "nav-1", "missing", "down")).toBe(root);
  });

  it("keeps the CTA last: the last link cannot move past it", () => {
    const navbar = createNavbarWithCtaNode();
    const root = page(navbar);
    expect(moveNavigationLink(root, navbar.id, navbar.children![2].id, "down")).toBe(root);
    const next = moveNavigationLink(root, navbar.id, navbar.children![2].id, "up");
    expect(childTexts(next, navbar.id)).toEqual(["a:Home", "a:Pricing", "a:Features", "button:Get Started"]);
  });

  it("swaps links across separators, leaving every separator where it was", () => {
    const breadcrumbs = createBreadcrumbsNode();
    const root = page(breadcrumbs);
    const next = moveNavigationLink(root, breadcrumbs.id, breadcrumbs.children![0].id, "down");
    expect(childTexts(next, breadcrumbs.id)).toEqual(["a:Products", "p:/", "a:Home", "p:/", "a:Current Page"]);
    expect(next.children![0].children![1]).toBe(breadcrumbs.children![1]);
    expect(next.children![0].children![3]).toBe(breadcrumbs.children![3]);
  });
});

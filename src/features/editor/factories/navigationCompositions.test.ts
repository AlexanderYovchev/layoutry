import { describe, expect, it } from "vitest";
import {
  createBasicNavbarNode,
  createBreadcrumbsNode,
  createCenteredNavbarNode,
  createNavbarWithCtaNode,
  createPaginationNode,
  createSidebarNavigationNode,
} from "./navigationCompositions";

/**
 * Checkpoint 1.15.6.3 — Components -> Navigation. Every factory here must
 * produce ONLY ordinary primitives (nav/a/button/p), never a proprietary
 * component tag (navbarComponent/breadcrumbComponent/paginationComponent),
 * and never a `navigationVariant`-style state field — these tests assert
 * that boundary directly, plus the generic "fresh id everywhere" and
 * "genuine nav root" guarantees every composition factory in this codebase
 * already provides (see buttonCompositions.test.ts, which this mirrors).
 */

type AnyNode = { id: string; tag: string; children?: AnyNode[] };

function collectIds(node: AnyNode): string[] {
  return [node.id, ...(node.children ?? []).flatMap(collectIds)];
}

function collectTags(node: AnyNode): string[] {
  return [node.tag, ...(node.children ?? []).flatMap(collectTags)];
}

describe("Basic Navbar (Checkpoint 1.15.6.3, Part A)", () => {
  it("is a genuine <nav> root with 4 ordinary Link children — no proprietary node type", () => {
    const node = createBasicNavbarNode();
    expect(node.tag).toBe("nav");
    expect(node.children).toHaveLength(4);
    expect(node.children?.every((child) => child.tag === "a")).toBe(true);
  });

  it("uses ordinary managed Flex Row layout, not Free", () => {
    const node = createBasicNavbarNode();
    expect(node.layoutMode).not.toBe("free");
    expect(node.flowLayout?.display).toBe("flex");
    expect(node.flowLayout?.flex?.direction).toBe("row");
    expect(node.flowLayout?.flex?.justifyContent).toBe("start");
  });

  it("stores no proprietary variant field on the node at all", () => {
    const node = createBasicNavbarNode() as unknown as Record<string, unknown>;
    expect(node.navigationVariant).toBeUndefined();
    expect(node.variant).toBeUndefined();
    expect(node.componentType).toBeUndefined();
  });

  it("each Link has distinct starter text and the existing Link href default", () => {
    const links = createBasicNavbarNode().children ?? [];
    expect(new Set(links.map((l) => l.text)).size).toBe(4);
    expect(links.every((l) => l.href === "#")).toBe(true);
  });

  it("every node gets its own fresh id, and two separate compositions never share one", () => {
    const idsA = collectIds(createBasicNavbarNode());
    expect(new Set(idsA).size).toBe(idsA.length);
    const idsB = collectIds(createBasicNavbarNode());
    expect(idsA.some((id) => idsB.includes(id))).toBe(false);
  });
});

describe("Navbar with CTA (Checkpoint 1.15.6.3, Part B)", () => {
  it("is nav > Link x3, Button — the smallest clean tree, no wrapper Container", () => {
    const node = createNavbarWithCtaNode();
    expect(node.tag).toBe("nav");
    expect(node.children).toHaveLength(4);
    const tags = node.children?.map((c) => c.tag) ?? [];
    expect(tags).toEqual(["a", "a", "a", "button"]);
  });

  it("distributes links against the CTA via ordinary justify-content: space-between, no spacer node", () => {
    const node = createNavbarWithCtaNode();
    expect(node.flowLayout?.flex?.justifyContent).toBe("space-between");
    expect(node.children?.every((c) => c.tag !== "div")).toBe(true);
  });

  it("the CTA reuses the Primary Button preset's own authored style fields, not a re-authored duplicate", () => {
    const [, , , cta] = createNavbarWithCtaNode().children ?? [];
    expect(cta.tag).toBe("button");
    expect(cta.text).toBe("Get Started");
    expect(cta.background?.color).toBeDefined();
    expect(cta.typography?.color).toBeDefined();
    expect(cta.borderRadius).toBeDefined();
    expect(cta.spacing).toBeDefined();
  });

  it("every node gets its own fresh id, and two separate compositions never share one", () => {
    const idsA = collectIds(createNavbarWithCtaNode());
    expect(new Set(idsA).size).toBe(idsA.length);
    const idsB = collectIds(createNavbarWithCtaNode());
    expect(idsA.some((id) => idsB.includes(id))).toBe(false);
  });
});

describe("Centered Navbar (Checkpoint 1.15.6.3, Part C)", () => {
  it("is structurally identical to Basic Navbar except for justify-content", () => {
    const basic = createBasicNavbarNode();
    const centered = createCenteredNavbarNode();
    expect(collectTags(centered)).toEqual(collectTags(basic));
    expect(centered.children?.map((c) => c.text)).toEqual(basic.children?.map((c) => c.text));
    expect(centered.flowLayout?.flex?.justifyContent).toBe("center");
    expect(basic.flowLayout?.flex?.justifyContent).not.toBe("center");
  });
});

describe("Breadcrumbs (Checkpoint 1.15.6.3, Part D)", () => {
  it("is nav > Link, Text('/'), Link, Text('/'), Link — no proprietary Breadcrumb node", () => {
    const node = createBreadcrumbsNode();
    expect(node.tag).toBe("nav");
    const tags = node.children?.map((c) => c.tag) ?? [];
    expect(tags).toEqual(["a", "p", "a", "p", "a"]);
  });

  it("separators are real authored '/' text, not a fake editor-only icon", () => {
    const node = createBreadcrumbsNode();
    const separators = (node.children ?? []).filter((c) => c.tag === "p");
    expect(separators).toHaveLength(2);
    expect(separators.every((s) => s.text === "/")).toBe(true);
  });

  it("the current-page entry is represented via ordinary authored typography, not a stored isCurrent/aria-current field", () => {
    const node = createBreadcrumbsNode() as unknown as { children: Array<Record<string, unknown>> };
    const links = node.children.filter((c) => c.tag === "a");
    const current = links[links.length - 1];
    expect(current.isCurrent).toBeUndefined();
    expect(current["aria-current"]).toBeUndefined();
    expect((current.typography as { color?: string } | undefined)?.color).toBeDefined();
  });

  it("every node gets its own fresh id, and two separate compositions never share one", () => {
    const idsA = collectIds(createBreadcrumbsNode());
    expect(new Set(idsA).size).toBe(idsA.length);
    const idsB = collectIds(createBreadcrumbsNode());
    expect(idsA.some((id) => idsB.includes(id))).toBe(false);
  });
});

describe("Pagination (Checkpoint 1.15.6.3, Part E)", () => {
  it("is nav > Button('Previous'), Link('1'), Link('2'), Link('3'), Button('Next')", () => {
    const node = createPaginationNode();
    expect(node.tag).toBe("nav");
    const tags = node.children?.map((c) => c.tag) ?? [];
    expect(tags).toEqual(["button", "a", "a", "a", "button"]);
    expect(node.children?.map((c) => c.text)).toEqual(["Previous", "1", "2", "3", "Next"]);
  });

  it("represents the active page via ordinary authored background/typography, never a stored activePage/currentPage field", () => {
    const node = createPaginationNode() as unknown as Record<string, unknown>;
    expect(node.activePage).toBeUndefined();
    expect(node.currentPage).toBeUndefined();
    expect(node.paginationState).toBeUndefined();

    const [, page1, page2] = createPaginationNode().children ?? [];
    expect(page1.background?.color).toBeDefined();
    expect(page2.background).toBeUndefined();
  });

  it("every node gets its own fresh id, and two separate compositions never share one", () => {
    const idsA = collectIds(createPaginationNode());
    expect(new Set(idsA).size).toBe(idsA.length);
    const idsB = collectIds(createPaginationNode());
    expect(idsA.some((id) => idsB.includes(id))).toBe(false);
  });
});

describe("Sidebar Navigation (Checkpoint 1.15.6.3, Part F)", () => {
  it("is nav > Link x4 in a Flex Column — vertical navigation only, not a full Sidebar shell", () => {
    const node = createSidebarNavigationNode();
    expect(node.tag).toBe("nav");
    expect(node.children).toHaveLength(4);
    expect(node.children?.every((c) => c.tag === "a")).toBe(true);
    expect(node.flowLayout?.flex?.direction).toBe("column");
  });

  it("does not stamp a manual dimensions/resize intent — stays naturally resizable", () => {
    const node = createSidebarNavigationNode();
    expect(node.dimensions).toBeUndefined();
  });

  it("every node gets its own fresh id, and two separate compositions never share one", () => {
    const idsA = collectIds(createSidebarNavigationNode());
    expect(new Set(idsA).size).toBe(idsA.length);
    const idsB = collectIds(createSidebarNavigationNode());
    expect(idsA.some((id) => idsB.includes(id))).toBe(false);
  });
});

describe("Every Navigation composition (Checkpoint 1.15.6.3, general)", () => {
  const factories = [
    ["Basic Navbar", createBasicNavbarNode],
    ["Navbar with CTA", createNavbarWithCtaNode],
    ["Centered Navbar", createCenteredNavbarNode],
    ["Breadcrumbs", createBreadcrumbsNode],
    ["Pagination", createPaginationNode],
    ["Sidebar Navigation", createSidebarNavigationNode],
  ] as const;

  it.each(factories)("%s roots with a genuine <nav>, never Free/absolute positioning anywhere in the composition", (_label, factory) => {
    const node = factory();
    expect(node.tag).toBe("nav");
    expect(node.layoutMode).not.toBe("free");
    expect(node.freeLayout).toBeUndefined();
    for (const child of node.children ?? []) {
      expect(child.layoutMode).not.toBe("free");
      expect(child.freeLayout).toBeUndefined();
    }
  });

  it.each(factories)("%s only ever uses genuine HTML primitives (nav/a/button/p)", (_label, factory) => {
    const tags = new Set(collectTags(factory()));
    for (const tag of tags) {
      expect(["nav", "a", "button", "p"]).toContain(tag);
    }
  });
});

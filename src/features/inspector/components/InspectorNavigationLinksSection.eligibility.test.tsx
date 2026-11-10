import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  createBasicNavbarNode,
  createBreadcrumbsNode,
  createNavbarWithCtaNode,
  createPaginationNode,
  createSidebarNavigationNode,
} from "@/features/editor/factories/navigationCompositions";
import { createNavNode } from "@/features/editor/factories/elementFactories";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";
import { createSelection, selectionFromSingle } from "@/features/editor/types/selection";
import { NAVIGATION_LINKS_COPY } from "@/features/inspector/utils/navigationLinksCopy";
import { InspectorContent } from "./InspectorContent";

const initialState = useEditorStore.getState();

function show(children: EditorElementNode[], selectedIds: string[]) {
  useEditorStore.setState((state) => ({
    document: { ...state.document, children },
    selection: selectedIds.length === 1 ? selectionFromSingle(selectedIds[0]) : createSelection(selectedIds, selectedIds[0]),
  }));
  render(<InspectorContent />);
}

const sectionHeader = () => screen.queryByRole("button", { name: NAVIGATION_LINKS_COPY.title });

function links(count: number): EditorElementNode[] {
  return Array.from({ length: count }, (_, index) => ({ id: `a-${index}`, tag: "a", text: `Link ${index + 1}`, href: "#" }));
}

/**
 * BC-06.3 — which selections get the Navigation links section, through the
 * real Inspector (InspectorContent → InspectorNodeSummary), not the section
 * in isolation. Every `nav` does; nothing else does, even a container full
 * of links; a multi-selection never does.
 */
describe("Navigation links section eligibility (BC-06.3)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  const navCases: [string, () => EditorElementNode, string][] = [
    ["Basic Navbar", createBasicNavbarNode, "4 links"],
    ["Navbar with CTA", createNavbarWithCtaNode, "3 links"],
    ["Breadcrumbs", createBreadcrumbsNode, "3 links"],
    ["Pagination", createPaginationNode, "3 links"],
    ["Sidebar Navigation", createSidebarNavigationNode, "4 links"],
    ["blank Nav (zero links)", createNavNode, NAVIGATION_LINKS_COPY.empty],
    ["nav with one link", () => ({ id: "nav-one", tag: "nav", children: links(1) }), "1 link"],
    ["nav with twelve links", () => ({ id: "nav-12", tag: "nav", children: links(12) }), "12 links"],
    ["legacy nav with fifteen links", () => ({ id: "nav-15", tag: "nav", children: links(15) }), "15 links"],
  ];

  for (const [name, build, count] of navCases) {
    it(`shows the section with the real count for a ${name}`, () => {
      const nav = build();
      show([nav], [nav.id]);
      expect(sectionHeader()).toBeInTheDocument();
      expect(screen.getByText(count)).toBeInTheDocument();
    });
  }

  it("counts Pagination's page links, not its Previous/Next buttons", () => {
    const pagination = createPaginationNode();
    show([pagination], [pagination.id]);
    const list = screen.getByRole("list", { name: NAVIGATION_LINKS_COPY.title });
    expect(within(list).getAllByRole("listitem")).toHaveLength(pagination.children!.filter((child) => child.tag === "a").length);
    expect(within(list).queryByRole("button", { name: /Previous|Next/ })).toBeNull();
  });

  const otherCases: [string, EditorElementNode][] = [
    ["a div full of links", { id: "div-1", tag: "div", children: links(3) }],
    ["a header full of links", { id: "header-1", tag: "header", children: links(3) }],
    ["a footer full of links", { id: "footer-1", tag: "footer", children: links(3) }],
    ["an unordered list", { id: "ul-1", tag: "ul", children: [{ id: "li-1", tag: "li", text: "Item" }] }],
    ["a single link", { id: "a-solo", tag: "a", text: "Solo", href: "#" }],
  ];

  for (const [name, node] of otherCases) {
    it(`does not show the section for ${name}`, () => {
      show([node], [node.id]);
      expect(sectionHeader()).toBeNull();
      expect(screen.queryByRole("button", { name: /^Remove / })).toBeNull();
    });
  }

  it("does not show the section for a link inside a nav (the link's own Link section applies)", () => {
    const navbar = createBasicNavbarNode();
    show([navbar], [navbar.children![0].id]);
    expect(sectionHeader()).toBeNull();
  });

  it("does not show the section for a multi-selection, even of two navs", () => {
    const first = createBasicNavbarNode();
    const second = createNavbarWithCtaNode();
    show([first, second], [first.id, second.id]);
    expect(sectionHeader()).toBeNull();
  });
});

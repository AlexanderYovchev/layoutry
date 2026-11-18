import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createBasicNavbarNode, createPaginationNode } from "@/features/editor/factories/navigationCompositions";
import { setPaginationControlVisible } from "@/features/editor/commands/paginationCommands";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";
import { getPaginationParts } from "@/features/editor/types/pagination";
import { selectionFromSingle } from "@/features/editor/types/selection";
import { PAGINATION_CHILD_COPY, PAGINATION_COPY } from "@/features/inspector/utils/paginationCopy";
import { InspectorContent } from "./InspectorContent";

/** BC-09.4 — the Inspector explains what a Pagination does with the selected child, without blocking any edit. */

const initialState = useEditorStore.getState();

function withEllipsis(): EditorElementNode {
  const nav = createPaginationNode();
  return setPaginationControlVisible({ id: "page-root", tag: "page", children: [nav] }, nav.id, "ellipsis", true).children![0];
}

function show(nav: EditorElementNode, selectedId: string) {
  useEditorStore.setState((state) => ({ document: { ...state.document, children: [nav] }, selection: selectionFromSingle(selectedId) }));
  render(<InspectorContent />);
}

const note = () => screen.queryByRole("button", { name: PAGINATION_CHILD_COPY.title });

describe("Pagination child explanations (BC-09.4)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("a disabled Previous: not navigating, interactions don't run; its Link section stays editable", () => {
    const nav = createPaginationNode();
    show(nav, getPaginationParts(nav).controls.previous!.id);
    expect(screen.getByText(PAGINATION_CHILD_COPY.disabled)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Link destination" })).toBeEnabled();
  });

  it("the current page: intentionally not activatable", () => {
    const nav = createPaginationNode();
    show(nav, getPaginationParts(nav).pages[0].id);
    expect(screen.getByText(PAGINATION_CHILD_COPY.currentPage)).toBeInTheDocument();
  });

  it("the ellipsis: decorative", () => {
    const nav = withEllipsis();
    show(nav, getPaginationParts(nav).controls.ellipsis!.id);
    expect(screen.getByText(PAGINATION_CHILD_COPY.ellipsis)).toBeInTheDocument();
  });

  it("an enabled Next: its destination is managed", () => {
    const nav = createPaginationNode();
    show(nav, getPaginationParts(nav).controls.next!.id);
    expect(screen.getByText(PAGINATION_CHILD_COPY.managedDestination)).toBeInTheDocument();
  });

  it("nothing for an ordinary page or a Navbar link", () => {
    const nav = createPaginationNode();
    show(nav, getPaginationParts(nav).pages[1].id);
    expect(note()).toBeNull();
  });

  it("nothing for a Navbar link", () => {
    const navbar = createBasicNavbarNode();
    show(navbar, navbar.children![0].id);
    expect(note()).toBeNull();
  });

  it("the Interactions section says a current page's interactions won't run, and keeps them", () => {
    const nav = createPaginationNode();
    const current = getPaginationParts(nav).pages[0];
    current.interactions = [{ id: "i-1", trigger: "click", action: "toggle", targetId: nav.children![2].id }];
    show(nav, current.id);
    const header = screen.getByRole("button", { name: "Interactions" });
    if (header.getAttribute("aria-expanded") !== "true") fireEvent.click(header);
    expect(screen.getByText(PAGINATION_CHILD_COPY.interactionsInactive)).toBeInTheDocument();
    expect(useEditorStore.getState().document.children![0].children![1].interactions).toHaveLength(1);
  });

  it("no such note for an ordinary page's interactions", () => {
    const nav = createPaginationNode();
    const page = getPaginationParts(nav).pages[1];
    page.interactions = [{ id: "i-1", trigger: "click", action: "toggle", targetId: nav.children![3].id }];
    show(nav, page.id);
    const header = screen.getByRole("button", { name: "Interactions" });
    if (header.getAttribute("aria-expanded") !== "true") fireEvent.click(header);
    expect(screen.queryByText(PAGINATION_CHILD_COPY.interactionsInactive)).toBeNull();
  });

  it("the Pagination section explains managed destinations and hiding", () => {
    const nav = createPaginationNode();
    show(nav, nav.id);
    expect(screen.getByText(PAGINATION_COPY.controlsNote)).toBeInTheDocument();
    expect(screen.getByText(PAGINATION_COPY.hideNote)).toBeInTheDocument();
  });
});

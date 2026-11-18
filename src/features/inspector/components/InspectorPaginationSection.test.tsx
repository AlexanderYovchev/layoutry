import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createBasicNavbarNode, createBreadcrumbsNode, createPaginationNode } from "@/features/editor/factories/navigationCompositions";
import { createNavNode } from "@/features/editor/factories/elementFactories";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";
import { getPaginationParts } from "@/features/editor/types/pagination";
import { selectionFromSingle } from "@/features/editor/types/selection";
import { findNodeById } from "@/features/editor/utils/findNodeById";
import { PAGINATION_COPY } from "@/features/inspector/utils/paginationCopy";
import { legacyPaginationNode } from "../../../../test/fixtures/legacyPagination";
import { InspectorContent } from "./InspectorContent";

/** BC-09.3 — the Pagination section through the real Inspector. */

const initialState = useEditorStore.getState();
const store = () => useEditorStore.getState();

function show(node: EditorElementNode, selectedId = node.id) {
  useEditorStore.setState((state) => ({ document: { ...state.document, children: [node] }, selection: selectionFromSingle(selectedId) }));
  return render(<InspectorContent />);
}

const section = () => screen.queryByRole("button", { name: PAGINATION_COPY.title });
const pagesList = () => screen.getByRole("list", { name: PAGINATION_COPY.pagesList });
const rows = () => within(pagesList()).getAllByRole("listitem");
const navNow = (id: string) => findNodeById(store().document, id)!;

function commitText(field: HTMLElement, value: string) {
  fireEvent.change(field, { target: { value } });
  fireEvent.keyDown(field, { key: "Enter" });
}

describe("Pagination section (BC-09.3)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("shows only for a marked Pagination", () => {
    show(createPaginationNode());
    expect(section()).toBeInTheDocument();
    expect(screen.getByText("3 pages, page 1 is current")).toBeInTheDocument();
  });

  for (const [name, build] of [
    ["a legacy Pagination", legacyPaginationNode],
    ["a Navbar", createBasicNavbarNode],
    ["Breadcrumbs", createBreadcrumbsNode],
    ["a plain nav", createNavNode],
  ] as const) {
    it(`does not show for ${name}`, () => {
      show(build());
      expect(section()).toBeNull();
    });
  }

  it("does not show when a page inside the Pagination is selected (its own Link section does)", () => {
    const nav = createPaginationNode();
    show(nav, nav.children![2].id);
    expect(section()).toBeNull();
    expect(screen.getByRole("textbox", { name: "Link destination" })).toBeInTheDocument();
  });

  it("lists pages by position without exposing ids, marks the current one, and sets another as current", () => {
    const nav = createPaginationNode();
    const { container } = show(nav);
    expect(rows()).toHaveLength(3);
    expect(within(rows()[0]).getByText(PAGINATION_COPY.current)).toBeInTheDocument();
    expect(container.textContent).not.toContain(nav.children![1].id);
    fireEvent.click(screen.getByRole("button", { name: "Set page 3 as the current page" }));
    expect(screen.getByText("3 pages, page 3 is current")).toBeInTheDocument();
    expect(within(rows()[2]).getByText(PAGINATION_COPY.current)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Set page 1 as the current page" })).toBeInTheDocument();
  });

  it("adds pages up to 12, then Add is refused with a reason; removes down to 1, then Remove is refused", () => {
    const nav = createPaginationNode();
    show(nav);
    const add = screen.getByRole("button", { name: PAGINATION_COPY.addPage });
    for (let count = 3; count < 12; count++) fireEvent.click(add);
    expect(rows()).toHaveLength(12);
    expect(add).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText(PAGINATION_COPY.maximumNote)).toBeInTheDocument();
    const history = store().past.length;
    fireEvent.click(add);
    expect(store().past.length).toBe(history);
    while (rows().length > 1) fireEvent.click(screen.getByRole("button", { name: `Remove page ${rows().length}` }));
    const remove = screen.getByRole("button", { name: "Remove page 1" });
    expect(remove).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(remove);
    expect(rows()).toHaveLength(1);
    // About 20 full Inspector renders in jsdom.
  }, 30_000);

  it("edits a label with one Undo step; a blank label is refused and the old one kept", () => {
    const nav = createPaginationNode();
    show(nav);
    const field = screen.getByRole("textbox", { name: "Page 2 label" });
    const history = store().past.length;
    commitText(field, "Intro");
    expect(getPaginationParts(navNow(nav.id)).pages[1].text).toBe("Intro");
    expect(store().past.length).toBe(history + 1);
    commitText(screen.getByRole("textbox", { name: "Page 2 label" }), "   ");
    expect(screen.getByRole("alert")).toHaveTextContent(PAGINATION_COPY.blankLabel);
    expect(screen.getByRole("textbox", { name: "Page 2 label" })).toHaveValue("Intro");
    expect(store().past.length).toBe(history + 1);
  });

  it("refuses unsafe destinations the export would refuse, keeps the old one, and accepts a safe one", () => {
    const nav = createPaginationNode();
    show(nav);
    for (const unsafe of ["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "vbscript:x", "file:///C:/x"]) {
      commitText(screen.getByRole("textbox", { name: "Page 2 destination" }), unsafe);
      expect(screen.getByRole("alert")).toHaveTextContent(PAGINATION_COPY.invalidDestination);
      expect(screen.getByRole("textbox", { name: "Page 2 destination" })).toHaveValue("#");
    }
    commitText(screen.getByRole("textbox", { name: "Page 2 destination" }), "/blog/page/2");
    expect(screen.queryByRole("alert")).toBeNull();
    const { pages, controls } = getPaginationParts(navNow(nav.id));
    expect(pages[1].href).toBe("/blog/page/2");
    // Next on page 1 links to page 2's destination.
    expect(controls.next?.href).toBe("/blog/page/2");
  });

  it("the current page keeps an editable, recoverable destination, with a note", () => {
    show(createPaginationNode());
    expect(screen.getByText(PAGINATION_COPY.currentDestinationNote)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Page 1 destination" })).toHaveValue("#");
  });

  it("toggles controls; the ellipsis can't be turned on with one page", () => {
    const nav = createPaginationNode();
    show(nav);
    const first = screen.getByRole("switch", { name: "Show First" });
    expect(screen.getByRole("switch", { name: "Show Previous" })).toHaveAttribute("aria-checked", "true");
    expect(first).toHaveAttribute("aria-checked", "false");
    fireEvent.click(first);
    expect(screen.getByRole("switch", { name: "Show First" })).toHaveAttribute("aria-checked", "true");
    expect(getPaginationParts(navNow(nav.id)).controls.first).toBeDefined();
    fireEvent.click(screen.getByRole("switch", { name: "Show Ellipsis (…)" }));
    expect(screen.getByText(PAGINATION_COPY.ellipsisConsecutive)).toBeInTheDocument();
    commitText(screen.getByRole("textbox", { name: "Page 3 label" }), "10");
    expect(screen.queryByText(PAGINATION_COPY.ellipsisConsecutive)).toBeNull();
    fireEvent.click(screen.getByRole("switch", { name: "Show Ellipsis (…)" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove page 3" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove page 2" }));
    expect(screen.getByRole("switch", { name: "Show Ellipsis (…)" })).toBeDisabled();
    expect(screen.getByText(PAGINATION_COPY.ellipsisNeedsPages)).toBeInTheDocument();
  });

  it("stays in sync with Undo/Redo (no stale field values)", () => {
    const nav = createPaginationNode();
    show(nav);
    commitText(screen.getByRole("textbox", { name: "Page 1 label" }), "One");
    fireEvent.click(screen.getByRole("button", { name: PAGINATION_COPY.addPage }));
    expect(rows()).toHaveLength(4);
    act(() => store().undo());
    expect(rows()).toHaveLength(3);
    act(() => store().undo());
    expect(screen.getByRole("textbox", { name: "Page 1 label" })).toHaveValue("1");
    act(() => store().redo());
    expect(screen.getByRole("textbox", { name: "Page 1 label" })).toHaveValue("One");
  });

  it("Escape reverts a draft without committing", () => {
    const nav = createPaginationNode();
    show(nav);
    const field = screen.getByRole("textbox", { name: "Page 2 label" });
    const history = store().past.length;
    fireEvent.change(field, { target: { value: "Draft" } });
    fireEvent.keyDown(field, { key: "Escape" });
    expect(field).toHaveValue("2");
    fireEvent.blur(field);
    expect(store().past.length).toBe(history);
  });
});

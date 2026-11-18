import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPaginationNode } from "@/features/editor/factories/navigationCompositions";
import { canActivateInteractions } from "@/features/editor/rules/accessibilityAttributes";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";
import { findDismissibleRelationships } from "@/features/editor/utils/dismissibleTargets";
import { CanvasInteractionBoundary } from "./CanvasInteractionBoundary";

/**
 * BC-09.2.1 — a control marked `disabled` in the document never runs its
 * authored click interactions in Preview (click, keyboard-dispatched click
 * or element.click()), while an enabled control with the same binding
 * does, and Design selection is unaffected. Export: see
 * exportDisabledTriggers.test.ts.
 */

const initialState = useEditorStore.getState();
const store = () => useEditorStore.getState();

const toggle = (id: string, targetId: string) => [{ id, trigger: "click" as const, action: "toggle" as const, targetId }];

/** Previous (disabled) and Next (enabled) both toggle a panel; Next of a last-page Pagination is disabled too. */
function paginationDocument(): EditorElementNode {
  const firstPage = createPaginationNode();
  const [previous, , , , next] = firstPage.children!;
  previous.id = "prev-1";
  previous.interactions = toggle("i-prev", "panel-prev");
  next.id = "next-1";
  next.interactions = toggle("i-next", "panel-next");

  const lastPage = createPaginationNode();
  const [lastPrevious, page1, , page3, lastNext] = lastPage.children!;
  // A last-page Pagination: page 3 current, Previous enabled, Next disabled.
  delete page1.ariaCurrent;
  page3.ariaCurrent = "page";
  delete lastPrevious.disabled;
  lastPrevious.id = "prev-last";
  lastNext.id = "next-last";
  lastNext.disabled = true;
  lastNext.interactions = toggle("i-next-last", "panel-last");

  const hidden = (id: string): EditorElementNode => ({ id, tag: "p", text: id, initialPreviewVisibility: "hidden" });
  return {
    id: "page-root",
    tag: "page",
    children: [firstPage, lastPage, hidden("panel-prev"), hidden("panel-next"), hidden("panel-last"), { id: "button-off", tag: "button", text: "Off", disabled: true, interactions: toggle("i-button", "panel-prev") }],
  };
}

function renderPreview(document: EditorElementNode) {
  useEditorStore.setState({ document });
  store().enterPreview();
  return render(
    <main aria-label="Workspace">
      <CanvasInteractionBoundary document={document} />
    </main>,
  );
}

const element = (id: string) => {
  const found = document.querySelector<HTMLElement>(`[data-node-id="${id}"]`);
  if (!found) throw new Error(id);
  return found;
};
const visibility = () => store().runtimeVisibility;

describe("disabled controls never run interactions (BC-09.2.1)", () => {
  beforeEach(() => {
    useEditorStore.setState(initialState, true);
  });
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("the rule reads only the document field", () => {
    expect(canActivateInteractions({ id: "a", tag: "a", disabled: true }, undefined)).toBe(false);
    expect(canActivateInteractions({ id: "a", tag: "a" }, undefined)).toBe(true);
    // A muted, not-allowed look is not "disabled".
    expect(canActivateInteractions({ id: "a", tag: "a", typography: { color: "#a1a1aa" }, display: { cursor: "not-allowed" } }, undefined)).toBe(true);
    expect(canActivateInteractions({ id: "b", tag: "button", disabled: true }, undefined)).toBe(false);
  });

  it("Preview: clicking a disabled Previous does nothing; the enabled Next with the same binding toggles its panel", () => {
    renderPreview(paginationDocument());
    const before = visibility();
    fireEvent.click(element("prev-1"));
    expect(visibility()).toBe(before);
    fireEvent.click(element("next-1"));
    expect(visibility()["panel-next"]).toBe(true);
    expect(visibility()["panel-prev"]).toBe(false);
  });

  it("Preview: a disabled Next on the last page does nothing; its enabled Previous stays a working link", () => {
    renderPreview(paginationDocument());
    fireEvent.click(element("next-last"));
    expect(visibility()["panel-last"]).toBe(false);
    expect(element("prev-last")).toHaveAttribute("href", "#");
    expect(element("next-last")).not.toHaveAttribute("href");
  });

  it("Preview: element.click() and a keyboard-style dispatched click are refused too, and so is a disabled button", () => {
    renderPreview(paginationDocument());
    element("prev-1").click();
    element("next-last").dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 }));
    element("button-off").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(visibility()["panel-prev"]).toBe(false);
    expect(visibility()["panel-last"]).toBe(false);
  });

  it("Preview: the executor itself refuses a disabled node, so no other caller can bypass it", () => {
    useEditorStore.setState({ document: paginationDocument() });
    store().enterPreview();
    const before = visibility();
    store().executeInteractionsForNode("prev-1", "click");
    store().executeInteractionsForNode("button-off", "click");
    expect(visibility()).toBe(before);
    store().executeInteractionsForNode("next-1", "click");
    expect(visibility()["panel-next"]).toBe(true);
  });

  it("Preview: a disabled trigger advertises no aria-controls/aria-expanded; the enabled one does", () => {
    renderPreview(paginationDocument());
    expect(element("prev-1")).not.toHaveAttribute("aria-controls");
    expect(element("prev-1")).not.toHaveAttribute("aria-expanded");
    expect(element("prev-1")).toHaveAttribute("aria-disabled", "true");
    expect(element("next-1")).toHaveAttribute("aria-expanded", "false");
  });

  it("Preview: a disabled trigger owns no outside-click dismissal relationship", () => {
    const document = paginationDocument();
    const shown = { "panel-prev": true, "panel-next": true, "panel-last": true };
    expect(findDismissibleRelationships(document, shown).map((relationship) => relationship.triggerId)).toEqual(["next-1"]);
  });

  it("Preview: the document and history never change", () => {
    renderPreview(paginationDocument());
    const document = store().document;
    const history = [store().past.length, store().future.length];
    for (const id of ["prev-1", "next-1", "next-last", "button-off"]) fireEvent.click(element(id));
    expect(store().document).toBe(document);
    expect([store().past.length, store().future.length]).toEqual(history);
  });

  it("Design: a disabled link and a disabled button are still selected by a click, and run nothing", () => {
    const document = paginationDocument();
    useEditorStore.setState({ document });
    render(
      <main aria-label="Workspace">
        <CanvasInteractionBoundary document={document} />
      </main>,
    );
    fireEvent.click(element("prev-1"));
    expect(store().selection.primaryId).toBe("prev-1");
    fireEvent.click(screen.getByRole("button", { name: "Off" }));
    expect(store().selection.primaryId).toBe("button-off");
    expect(store().runtimeVisibility).toEqual({});
  });
});

/**
 * BC-09.3 (approved): a Pagination's current page and its ellipsis never
 * run authored interactions either. Scoped to marked Paginations: an
 * aria-current link elsewhere still does.
 */
describe("Pagination current page and ellipsis never run interactions (BC-09.3)", () => {
  beforeEach(() => {
    useEditorStore.setState(initialState, true);
  });
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  function currentPageDocument(): EditorElementNode {
    const pagination = createPaginationNode();
    const [, current, page2] = pagination.children!;
    current.id = "page-current";
    current.interactions = toggle("i-current", "panel-a");
    page2.id = "page-2";
    page2.interactions = toggle("i-page2", "panel-b");
    pagination.children!.splice(3, 0, { id: "dots", tag: "p", text: "…", displayName: "Ellipsis", interactions: toggle("i-dots", "panel-a") });
    const hidden = (id: string): EditorElementNode => ({ id, tag: "p", text: id, initialPreviewVisibility: "hidden" });
    const navbar: EditorElementNode = { id: "navbar", tag: "nav", children: [{ id: "nav-active", tag: "a", text: "Home", href: "/", ariaCurrent: "page", interactions: toggle("i-nav", "panel-c") }] };
    return { id: "page-root", tag: "page", children: [pagination, navbar, hidden("panel-a"), hidden("panel-b"), hidden("panel-c")] };
  }

  it("the rule needs the Pagination parent: alone, an aria-current link can activate", () => {
    const document = currentPageDocument();
    const pagination = document.children![0];
    const current = pagination.children![1];
    expect(canActivateInteractions(current, pagination)).toBe(false);
    expect(canActivateInteractions(current, undefined)).toBe(true);
    expect(canActivateInteractions(pagination.children![2], pagination)).toBe(true);
  });

  it("Preview: clicking the current page or the ellipsis runs nothing; an ordinary page and a Navbar's aria-current link still do", () => {
    renderPreview(currentPageDocument());
    fireEvent.click(element("page-current"));
    fireEvent.click(element("dots"));
    element("page-current").click();
    expect(visibility()["panel-a"]).toBe(false);
    fireEvent.click(element("page-2"));
    expect(visibility()["panel-b"]).toBe(true);
    fireEvent.click(element("nav-active"));
    expect(visibility()["panel-c"]).toBe(true);
  });

  it("Preview: the current page advertises no trigger state; the ordinary page does", () => {
    renderPreview(currentPageDocument());
    expect(element("page-current")).not.toHaveAttribute("aria-controls");
    expect(element("page-current")).not.toHaveAttribute("aria-expanded");
    expect(element("page-current")).not.toHaveAttribute("href");
    expect(element("page-2")).toHaveAttribute("aria-expanded", "false");
  });

  it("Design: the current page is still selected by a click", () => {
    const document = currentPageDocument();
    useEditorStore.setState({ document });
    render(
      <main aria-label="Workspace">
        <CanvasInteractionBoundary document={document} />
      </main>,
    );
    fireEvent.click(element("page-current"));
    expect(store().selection.primaryId).toBe("page-current");
    expect(store().runtimeVisibility).toEqual({});
  });
});

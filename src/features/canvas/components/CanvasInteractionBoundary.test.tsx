import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createDropdownButtonNode } from "@/features/editor/factories/buttonCompositions";
import { createCollapsibleNode } from "@/features/editor/factories/interactionCompositions";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { selectionFromSingle } from "@/features/editor/types/selection";
import { StructureTree } from "@/features/editor/components/structure/StructureTree";
import type { EditorElementNode } from "@/features/editor/types/document";
import { CanvasInteractionBoundary } from "./CanvasInteractionBoundary";
import { DocumentCanvas } from "./DocumentCanvas";

const initialState = useEditorStore.getState();

const tree: EditorElementNode = {
  id: "page-root",
  tag: "page",
  children: [
    {
      id: "container-1",
      tag: "div",
      children: [
        { id: "heading-1", tag: "h1", text: "Title" },
        { id: "button-1", tag: "button", text: "Click me" },
      ],
    },
  ],
};

function renderInWorkspace(document: EditorElementNode = tree) {
  return render(
    <main aria-label="Workspace">
      <CanvasInteractionBoundary document={document} />
    </main>,
  );
}

describe("CanvasInteractionBoundary", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("selects the node clicked on the canvas", () => {
    renderInWorkspace();

    fireEvent.click(screen.getByRole("heading", { name: "Title" }));

    expect(useEditorStore.getState().selection.primaryId).toBe("heading-1");
  });

  it("selects the deepest node under the pointer, not an ancestor container", () => {
    renderInWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "Click me" }));

    expect(useEditorStore.getState().selection.primaryId).toBe("button-1");
  });

  it("clears selection when clicking blank canvas space", () => {
    useEditorStore.setState({ selection: selectionFromSingle("heading-1") });
    const { container } = renderInWorkspace();

    fireEvent.click(container.querySelector('main[aria-label="Workspace"]')!);

    expect(useEditorStore.getState().selection.primaryId).toBeUndefined();
  });

  it("clears rather than selects when the pseudo document root itself is clicked", () => {
    useEditorStore.setState({ selection: selectionFromSingle("heading-1") });
    renderInWorkspace();

    const rootElement = document.querySelector('[data-node-id="page-root"]')!;
    fireEvent.click(rootElement);

    expect(useEditorStore.getState().selection.primaryId).toBeUndefined();
  });

  it("clears selection on Escape", () => {
    useEditorStore.setState({ selection: selectionFromSingle("heading-1") });
    renderInWorkspace();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(useEditorStore.getState().selection.primaryId).toBeUndefined();
  });

  it("does not clear selection on Escape when another handler already consumed it", () => {
    window.addEventListener(
      "keydown",
      (event) => event.preventDefault(),
      { once: true },
    );
    useEditorStore.setState({ selection: selectionFromSingle("heading-1") });
    renderInWorkspace();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(useEditorStore.getState().selection.primaryId).toBe("heading-1");
  });

  it("ignores clicks outside the Workspace region", () => {
    useEditorStore.setState({ selection: selectionFromSingle("heading-1") });
    render(
      <div>
        <main aria-label="Workspace">
          <CanvasInteractionBoundary document={tree} />
        </main>
        <div data-testid="outside-chrome">Toolbar</div>
      </div>,
    );

    fireEvent.click(screen.getByTestId("outside-chrome"));

    expect(useEditorStore.getState().selection.primaryId).toBe("heading-1");
  });

  it("shows a selection overlay with the node's display name when a node is selected", () => {
    useEditorStore.setState({ selection: selectionFromSingle("heading-1") });
    const { container } = renderInWorkspace();

    const overlay = container.querySelector('[data-canvas-overlay="selection"]');
    expect(overlay).toBeInTheDocument();
    expect(overlay).toHaveTextContent("Heading");
  });

  it("shows a hover overlay for the node under the pointer, and clears it on pointer-out", () => {
    const { container } = renderInWorkspace();

    fireEvent.pointerOver(screen.getByRole("heading", { name: "Title" }), {
      pointerType: "mouse",
    });
    expect(
      container.querySelector('[data-canvas-overlay="hover"]'),
    ).toBeInTheDocument();

    fireEvent.pointerOut(screen.getByRole("heading", { name: "Title" }), {
      pointerType: "mouse",
      relatedTarget: container,
    });
    expect(
      container.querySelector('[data-canvas-overlay="hover"]'),
    ).not.toBeInTheDocument();
  });

  it("does not show a hover overlay for the already-selected node", () => {
    useEditorStore.setState({ selection: selectionFromSingle("heading-1") });
    const { container } = renderInWorkspace();

    fireEvent.pointerOver(screen.getByRole("heading", { name: "Title" }), {
      pointerType: "mouse",
    });

    expect(
      container.querySelector('[data-canvas-overlay="hover"]'),
    ).not.toBeInTheDocument();
    expect(
      container.querySelector('[data-canvas-overlay="selection"]'),
    ).toBeInTheDocument();
  });

  it("ignores touch pointer events for hover", () => {
    const { container } = renderInWorkspace();

    fireEvent.pointerOver(screen.getByRole("heading", { name: "Title" }), {
      pointerType: "touch",
    });

    expect(
      container.querySelector('[data-canvas-overlay="hover"]'),
    ).not.toBeInTheDocument();
  });

  it("wraps the document tree in its own isolate stacking-context boundary, separate from the overlay layer (Checkpoint 5.3 editor-chrome protection)", () => {
    const { container } = renderInWorkspace();

    const documentRoot = container.querySelector('[data-node-id="page-root"]')!;
    const isolateWrapper = documentRoot.parentElement!;
    expect(isolateWrapper).toHaveClass("isolate");

    // CanvasOverlay (the selection/hover/drop-indicator layer) must be a
    // sibling of the isolate wrapper, not a descendant of it — otherwise
    // a document node's own z-index could still climb over the overlay
    // from *inside* the same stacking context.
    const canvasRoot = isolateWrapper.parentElement!;
    const overlayRoot = canvasRoot.querySelector(':scope > [aria-hidden="true"]');
    expect(overlayRoot).not.toBeNull();
    expect(isolateWrapper.contains(overlayRoot)).toBe(false);
    expect(canvasRoot.contains(overlayRoot)).toBe(true);
  });

  it("keeps the shared store in sync with the Structure panel", () => {
    // Both DocumentCanvas and StructureTree read state.document from the
    // same store, so seeding it with `tree` makes this a true end-to-end
    // check of the shared-store architecture rather than two unrelated
    // trees that happen to reuse the same ids.
    useEditorStore.setState({ document: tree });
    render(
      <main aria-label="Workspace">
        <DocumentCanvas />
      </main>,
    );
    const { container: structureContainer } = render(<StructureTree />);

    fireEvent.click(screen.getByRole("heading", { name: "Title" }));

    const headingRow = within(structureContainer)
      .getByText("Heading")
      .closest('[role="treeitem"]');
    expect(headingRow).toHaveAttribute("aria-selected", "true");
  });

  describe("Generic dismissal (Checkpoint 1.15.6.8.3)", () => {
    it("an outside click dismisses an open Dropdown menu in Preview", () => {
      const dropdown = createDropdownButtonNode();
      const [trigger, menu] = dropdown.children!;
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [dropdown] } }));
      useEditorStore.getState().enterPreview();
      const { container } = renderInWorkspace(useEditorStore.getState().document);

      fireEvent.click(screen.getByRole("button", { name: "Menu" }));
      expect(useEditorStore.getState().runtimeVisibility[menu.id]).toBe(true);

      fireEvent.click(container.querySelector('main[aria-label="Workspace"]')!);

      expect(useEditorStore.getState().runtimeVisibility[menu.id]).toBe(false);
      // Only ever a runtime write — nothing authored changes.
      expect(trigger.interactions).toEqual(dropdown.children![0].interactions);
    });

    it("a click on the trigger's own region does not dismiss it — its own click still toggles normally (no close-then-reopen bug)", () => {
      const dropdown = createDropdownButtonNode();
      const [, menu] = dropdown.children!;
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [dropdown] } }));
      useEditorStore.getState().enterPreview();
      renderInWorkspace(useEditorStore.getState().document);

      const trigger = screen.getByRole("button", { name: "Menu" });
      fireEvent.click(trigger);
      expect(useEditorStore.getState().runtimeVisibility[menu.id]).toBe(true);

      fireEvent.click(trigger);

      expect(useEditorStore.getState().runtimeVisibility[menu.id]).toBe(false);
    });

    it("a click inside the menu (target) region does not dismiss it", () => {
      const dropdown = createDropdownButtonNode();
      const [, menu] = dropdown.children!;
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [dropdown] } }));
      useEditorStore.getState().enterPreview();
      renderInWorkspace(useEditorStore.getState().document);

      fireEvent.click(screen.getByRole("button", { name: "Menu" }));
      fireEvent.click(screen.getByRole("link", { name: "Item 1" }));

      expect(useEditorStore.getState().runtimeVisibility[menu.id]).toBe(true);
    });

    it("clicking a second Dropdown's trigger dismisses the first, and opens the second, in the SAME click (no separate outside-click event, no reflow-target-miss race — see this checkpoint's own report)", () => {
      const dropdownA = createDropdownButtonNode();
      const dropdownB = createDropdownButtonNode();
      const [, menuA] = dropdownA.children!;
      const [triggerB, menuB] = dropdownB.children!;
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [dropdownA, dropdownB] } }));
      useEditorStore.getState().enterPreview();
      renderInWorkspace(useEditorStore.getState().document);

      const triggers = screen.getAllByRole("button", { name: "Menu" });
      fireEvent.click(triggers[0]);
      expect(useEditorStore.getState().runtimeVisibility[menuA.id]).toBe(true);

      fireEvent.click(triggers[1]);

      expect(useEditorStore.getState().runtimeVisibility[menuA.id]).toBe(false);
      expect(useEditorStore.getState().runtimeVisibility[menuB.id]).toBe(true);
      expect(triggerB.id).toBe(dropdownB.children![0].id);
    });

    it("Escape closes one open Dropdown and keeps Preview active", () => {
      const dropdown = createDropdownButtonNode();
      const [, menu] = dropdown.children!;
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [dropdown] } }));
      useEditorStore.getState().enterPreview();
      renderInWorkspace(useEditorStore.getState().document);

      fireEvent.click(screen.getByRole("button", { name: "Menu" }));
      expect(useEditorStore.getState().runtimeVisibility[menu.id]).toBe(true);

      fireEvent.keyDown(window, { key: "Escape" });

      expect(useEditorStore.getState().runtimeVisibility[menu.id]).toBe(false);
      expect(useEditorStore.getState().editorMode).toBe("preview");
    });

    it("Escape exits Preview once no dismissible target remains open", () => {
      const dropdown = createDropdownButtonNode();
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [dropdown] } }));
      useEditorStore.getState().enterPreview();
      renderInWorkspace(useEditorStore.getState().document);

      // Menu never opened — nothing dismissible.
      fireEvent.keyDown(window, { key: "Escape" });

      expect(useEditorStore.getState().editorMode).toBe("design");
    });

    it("repeated Escape closes multiple open relationships one at a time before exiting Preview", () => {
      // Two open relationships are seeded directly via runtimeVisibility
      // rather than by clicking each trigger in turn — a genuine finding
      // from this checkpoint's own live QA: outside-click dismissal now
      // runs on EVERY click, including a second Dropdown's own trigger
      // click, so opening B by clicking it always dismisses A first
      // (see the "opening a second Dropdown's trigger" test above and
      // Part D of this checkpoint's own report). Two Dropdowns can
      // therefore never end up simultaneously open through ordinary
      // sequential clicking — this test instead proves the ESCAPE-
      // PRIORITY algorithm itself handles multiple open relationships
      // correctly, independent of how that state was reached (e.g. a
      // future trigger type could reach it even if click can't).
      const dropdownA = createDropdownButtonNode();
      const dropdownB = createDropdownButtonNode();
      const [, menuA] = dropdownA.children!;
      const [, menuB] = dropdownB.children!;
      useEditorStore.setState((state) => ({
        document: { ...state.document, children: [dropdownA, dropdownB] },
        runtimeVisibility: { [menuA.id]: true, [menuB.id]: true },
      }));
      useEditorStore.setState({ editorMode: "preview" });
      renderInWorkspace(useEditorStore.getState().document);

      fireEvent.keyDown(window, { key: "Escape" });
      const afterFirstEscape = useEditorStore.getState().runtimeVisibility;
      const stillOpenCount = [menuA.id, menuB.id].filter((id) => afterFirstEscape[id]).length;
      expect(stillOpenCount).toBe(1);
      expect(useEditorStore.getState().editorMode).toBe("preview");

      fireEvent.keyDown(window, { key: "Escape" });
      expect(useEditorStore.getState().runtimeVisibility[menuA.id]).toBe(false);
      expect(useEditorStore.getState().runtimeVisibility[menuB.id]).toBe(false);
      expect(useEditorStore.getState().editorMode).toBe("preview");

      fireEvent.keyDown(window, { key: "Escape" });
      expect(useEditorStore.getState().editorMode).toBe("design");
    });

    it("Collapsible (default-visible content) never becomes outside-click dismissible", () => {
      const collapsible = createCollapsibleNode();
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [collapsible] } }));
      useEditorStore.getState().enterPreview();
      const { container } = renderInWorkspace(useEditorStore.getState().document);

      expect(screen.getByText("Collapsible content")).toBeInTheDocument();

      fireEvent.click(container.querySelector('main[aria-label="Workspace"]')!);

      expect(screen.getByText("Collapsible content")).toBeInTheDocument();
    });

    it("Escape does not consume on a visible-by-default Collapsible — it falls through to exiting Preview", () => {
      const collapsible = createCollapsibleNode();
      useEditorStore.setState((state) => ({ document: { ...state.document, children: [collapsible] } }));
      useEditorStore.getState().enterPreview();
      renderInWorkspace(useEditorStore.getState().document);

      fireEvent.keyDown(window, { key: "Escape" });

      expect(useEditorStore.getState().editorMode).toBe("design");
    });

    it("an outside click in Design mode never dismisses anything — Design behavior is completely unaffected", () => {
      const dropdown = createDropdownButtonNode();
      const [, menu] = dropdown.children!;
      // Force the menu open in runtimeVisibility even though we're in
      // Design — a contrived state that should never occur in practice,
      // but proves the dismissal logic itself is gated on isPreview
      // rather than merely "usually" not finding anything to dismiss.
      useEditorStore.setState((state) => ({
        document: { ...state.document, children: [dropdown] },
        runtimeVisibility: { [menu.id]: true },
      }));
      const { container } = renderInWorkspace(useEditorStore.getState().document);

      fireEvent.click(container.querySelector('main[aria-label="Workspace"]')!);

      expect(useEditorStore.getState().runtimeVisibility[menu.id]).toBe(true);
    });
  });
});

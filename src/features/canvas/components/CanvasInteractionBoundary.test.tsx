import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
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

    expect(useEditorStore.getState().selectedElementId).toBe("heading-1");
  });

  it("selects the deepest node under the pointer, not an ancestor container", () => {
    renderInWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "Click me" }));

    expect(useEditorStore.getState().selectedElementId).toBe("button-1");
  });

  it("clears selection when clicking blank canvas space", () => {
    useEditorStore.setState({ selectedElementId: "heading-1" });
    const { container } = renderInWorkspace();

    fireEvent.click(container.querySelector('main[aria-label="Workspace"]')!);

    expect(useEditorStore.getState().selectedElementId).toBeNull();
  });

  it("clears rather than selects when the pseudo document root itself is clicked", () => {
    useEditorStore.setState({ selectedElementId: "heading-1" });
    renderInWorkspace();

    const rootElement = document.querySelector('[data-node-id="page-root"]')!;
    fireEvent.click(rootElement);

    expect(useEditorStore.getState().selectedElementId).toBeNull();
  });

  it("clears selection on Escape", () => {
    useEditorStore.setState({ selectedElementId: "heading-1" });
    renderInWorkspace();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(useEditorStore.getState().selectedElementId).toBeNull();
  });

  it("does not clear selection on Escape when another handler already consumed it", () => {
    window.addEventListener(
      "keydown",
      (event) => event.preventDefault(),
      { once: true },
    );
    useEditorStore.setState({ selectedElementId: "heading-1" });
    renderInWorkspace();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(useEditorStore.getState().selectedElementId).toBe("heading-1");
  });

  it("ignores clicks outside the Workspace region", () => {
    useEditorStore.setState({ selectedElementId: "heading-1" });
    render(
      <div>
        <main aria-label="Workspace">
          <CanvasInteractionBoundary document={tree} />
        </main>
        <div data-testid="outside-chrome">Toolbar</div>
      </div>,
    );

    fireEvent.click(screen.getByTestId("outside-chrome"));

    expect(useEditorStore.getState().selectedElementId).toBe("heading-1");
  });

  it("shows a selection overlay with the node's display name when a node is selected", () => {
    useEditorStore.setState({ selectedElementId: "heading-1" });
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
    useEditorStore.setState({ selectedElementId: "heading-1" });
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
});

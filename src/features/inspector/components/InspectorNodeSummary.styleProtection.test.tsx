import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { InspectorNodeSummary } from "./InspectorNodeSummary";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";

const initialState = useEditorStore.getState();

function setupDocument(children: import("@/features/editor/types/document").EditorElementNode[]) {
  useEditorStore.setState((state) => ({ document: { ...state.document, children } }));
}

describe("InspectorNodeSummary — Parent Style Protection (Checkpoint 1.15.3)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("shows the Protection section on an eligible owner tag (div)", () => {
    setupDocument([{ id: "hero", tag: "div" }]);
    render(<InspectorNodeSummary node={{ id: "hero", tag: "div" }} parentId={null} parentLayoutMode="flow" parentFlowDisplay="block" />);
    expect(screen.getByText("Protection")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Lock child styles" })).toBeInTheDocument();
  });

  it("omits the Protection section on a tag not eligible to own a lock (e.g. a paragraph)", () => {
    setupDocument([{ id: "p1", tag: "p" }]);
    render(<InspectorNodeSummary node={{ id: "p1", tag: "p" }} parentId={null} parentLayoutMode="flow" parentFlowDisplay="block" />);
    expect(screen.queryByText("Protection")).not.toBeInTheDocument();
  });

  it("shows no protection notice for an unlocked node", () => {
    setupDocument([{ id: "p1", tag: "p" }]);
    render(<InspectorNodeSummary node={{ id: "p1", tag: "p" }} parentId={null} parentLayoutMode="flow" parentFlowDisplay="block" />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows the protection notice AND keeps CSS sections visible (not hidden) for a protected descendant", () => {
    setupDocument([{ id: "hero", tag: "div", htmlId: "hero", lockChildStyles: true, children: [{ id: "p1", tag: "p" }] }]);
    render(<InspectorNodeSummary node={{ id: "p1", tag: "p" }} parentId="hero" parentLayoutMode="flow" parentFlowDisplay="block" />);

    expect(screen.getByRole("status")).toHaveTextContent('Child styles locked by “hero”. Unlock the parent to edit CSS.');
    // Typography section is still rendered (not hidden) — its label is visible even though its own controls are inert underneath.
    expect(screen.getByText("Typography")).toBeInTheDocument();
  });

  it("semantic sections (Identity) remain fully interactive for a protected descendant", () => {
    setupDocument([{ id: "hero", tag: "div", lockChildStyles: true, children: [{ id: "link1", tag: "a" }] }]);
    render(<InspectorNodeSummary node={{ id: "link1", tag: "a" }} parentId="hero" parentLayoutMode="flow" parentFlowDisplay="block" />);

    // The Link section (semantic) should be present and NOT wrapped in the disabled group.
    expect(screen.getByRole("button", { name: "Link" })).toBeInTheDocument();
  });

  it("the lock OWNER itself shows no protection notice (section 8)", () => {
    setupDocument([{ id: "hero", tag: "div", lockChildStyles: true }]);
    render(<InspectorNodeSummary node={{ id: "hero", tag: "div", lockChildStyles: true }} parentId={null} parentLayoutMode="flow" parentFlowDisplay="block" />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  describe("Shape (Checkpoint 1.15.4)", () => {
    it("Shape stays visible (not hidden) but is inert for a protected descendant", () => {
      setupDocument([
        { id: "hero", tag: "div", htmlId: "hero", lockChildStyles: true, children: [{ id: "child", tag: "div" }] },
      ]);
      render(<InspectorNodeSummary node={{ id: "child", tag: "div" }} parentId="hero" parentLayoutMode="flow" parentFlowDisplay="block" />);

      const shapeGroup = screen.getByRole("group", { name: "Shape" });
      expect(shapeGroup).toBeInTheDocument();
      expect(shapeGroup.closest("[inert]")).not.toBeNull();
    });

    it("the store guard still rejects a Shape change on a protected node even if a click reaches the button (defense in depth)", () => {
      setupDocument([
        { id: "hero", tag: "div", htmlId: "hero", lockChildStyles: true, children: [{ id: "child", tag: "div" }] },
      ]);
      render(<InspectorNodeSummary node={{ id: "child", tag: "div" }} parentId="hero" parentLayoutMode="flow" parentFlowDisplay="block" />);

      fireEvent.click(screen.getByRole("button", { name: "Hexagon" }));

      const child = useEditorStore.getState().document.children![0].children![0];
      expect(child.shape).toBeUndefined();
    });

    it("the lock owner remains free to change its own Shape", () => {
      setupDocument([{ id: "hero", tag: "div", lockChildStyles: true }]);
      render(<InspectorNodeSummary node={{ id: "hero", tag: "div", lockChildStyles: true }} parentId={null} parentLayoutMode="flow" parentFlowDisplay="block" />);

      fireEvent.click(screen.getByRole("button", { name: "Star" }));

      expect(useEditorStore.getState().document.children![0].shape).toBe("star");
    });
  });
});

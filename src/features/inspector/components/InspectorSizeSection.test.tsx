import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { InspectorSizeSection } from "./InspectorSizeSection";
import type { EditorElementNode } from "@/features/editor/types/document";

const initialState = useEditorStore.getState();

function setupNode(node: EditorElementNode) {
  useEditorStore.setState((state) => ({
    document: { ...state.document, children: [node] },
  }));
}

function committedNode() {
  return useEditorStore.getState().document.children?.find((c) => c.id === "n1");
}

describe("InspectorSizeSection", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  describe("Flow Width/Height", () => {
    it("shows Auto for both fields when the node has never been resized", () => {
      render(<InspectorSizeSection node={{ id: "n1", tag: "div" }} isFreeChild={false} />);
      expect(screen.getByLabelText("Width")).toHaveValue(null);
      expect(screen.getByLabelText("Height")).toHaveValue(null);
    });

    it("shows the stored preferredWidth/preferredHeight when set", () => {
      render(
        <InspectorSizeSection
          node={{ id: "n1", tag: "div", dimensions: { preferredWidth: 320, preferredHeight: 180, offsetX: 0, offsetY: 0 } }}
          isFreeChild={false}
        />,
      );
      expect(screen.getByLabelText("Width")).toHaveValue(320);
      expect(screen.getByLabelText("Height")).toHaveValue(180);
    });

    it("committing Width from Auto materializes both axes, seeding Height from a sensible fallback (no rendered size available in this test environment)", () => {
      setupNode({ id: "n1", tag: "div" });
      render(<InspectorSizeSection node={{ id: "n1", tag: "div" }} isFreeChild={false} />);

      const widthField = screen.getByLabelText("Width");
      fireEvent.change(widthField, { target: { value: "400" } });
      fireEvent.blur(widthField);

      const dimensions = committedNode()?.dimensions;
      expect(dimensions?.preferredWidth).toBe(400);
      expect(dimensions?.preferredHeight).toBeGreaterThan(0);
    });

    it("committing Width alone preserves an already-explicit Height", () => {
      setupNode({ id: "n1", tag: "div", dimensions: { preferredWidth: 200, preferredHeight: 150, offsetX: 0, offsetY: 0 } });
      render(
        <InspectorSizeSection
          node={{ id: "n1", tag: "div", dimensions: { preferredWidth: 200, preferredHeight: 150, offsetX: 0, offsetY: 0 } }}
          isFreeChild={false}
        />,
      );

      const widthField = screen.getByLabelText("Width");
      fireEvent.change(widthField, { target: { value: "500" } });
      fireEvent.blur(widthField);

      expect(committedNode()?.dimensions).toEqual({ preferredWidth: 500, preferredHeight: 150, offsetX: 0, offsetY: 0 });
    });

    it("preserves offsetX/offsetY (a west/north anchor shift) when only Width changes", () => {
      setupNode({ id: "n1", tag: "div", dimensions: { preferredWidth: 200, preferredHeight: 150, offsetX: -40, offsetY: -10 } });
      render(
        <InspectorSizeSection
          node={{ id: "n1", tag: "div", dimensions: { preferredWidth: 200, preferredHeight: 150, offsetX: -40, offsetY: -10 } }}
          isFreeChild={false}
        />,
      );

      const widthField = screen.getByLabelText("Width");
      fireEvent.change(widthField, { target: { value: "500" } });
      fireEvent.blur(widthField);

      expect(committedNode()?.dimensions).toEqual({ preferredWidth: 500, preferredHeight: 150, offsetX: -40, offsetY: -10 });
    });

    it("clearing the Width field back to empty (Auto) clears both axes", () => {
      setupNode({ id: "n1", tag: "div", dimensions: { preferredWidth: 200, preferredHeight: 150, offsetX: 0, offsetY: 0 } });
      render(
        <InspectorSizeSection
          node={{ id: "n1", tag: "div", dimensions: { preferredWidth: 200, preferredHeight: 150, offsetX: 0, offsetY: 0 } }}
          isFreeChild={false}
        />,
      );

      const widthField = screen.getByLabelText("Width");
      fireEvent.change(widthField, { target: { value: "" } });
      fireEvent.blur(widthField);

      expect(committedNode()?.dimensions).toBeUndefined();
    });

    it("Reset Width clears both axes (documented atomic-model behavior — the model has no way to represent Auto width with an explicit height)", () => {
      setupNode({ id: "n1", tag: "div", dimensions: { preferredWidth: 200, preferredHeight: 150, offsetX: 0, offsetY: 0 } });
      render(
        <InspectorSizeSection
          node={{ id: "n1", tag: "div", dimensions: { preferredWidth: 200, preferredHeight: 150, offsetX: 0, offsetY: 0 } }}
          isFreeChild={false}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Reset width" }));
      expect(committedNode()?.dimensions).toBeUndefined();
    });

    it("Reset Height also clears both axes, the same documented behavior", () => {
      setupNode({ id: "n1", tag: "div", dimensions: { preferredWidth: 200, preferredHeight: 150, offsetX: 0, offsetY: 0 } });
      render(
        <InspectorSizeSection
          node={{ id: "n1", tag: "div", dimensions: { preferredWidth: 200, preferredHeight: 150, offsetX: 0, offsetY: 0 } }}
          isFreeChild={false}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Reset height" }));
      expect(committedNode()?.dimensions).toBeUndefined();
    });

    it("Reset is disabled when the node has never been resized", () => {
      render(<InspectorSizeSection node={{ id: "n1", tag: "div" }} isFreeChild={false} />);
      expect(screen.getByRole("button", { name: "Reset width" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Reset height" })).toBeDisabled();
    });

    it("applies the tag's own resize floor when committing a too-small Width (reuses resizeNode's clamp)", () => {
      setupNode({ id: "n1", tag: "div" });
      render(<InspectorSizeSection node={{ id: "n1", tag: "div" }} isFreeChild={false} />);

      const widthField = screen.getByLabelText("Width");
      fireEvent.change(widthField, { target: { value: "5" } });
      fireEvent.blur(widthField);

      // A div is a container tag — 160 is its own floor (see getResizeConstraintsForTag).
      expect(committedNode()?.dimensions?.preferredWidth).toBe(160);
    });
  });

  describe("Free Width/Height", () => {
    it("shows the current freeLayout width/height, never Auto", () => {
      render(
        <InspectorSizeSection node={{ id: "n1", tag: "img", freeLayout: { x: 10, y: 20, width: 100, height: 80 } }} isFreeChild />,
      );
      expect(screen.getByLabelText("Width")).toHaveValue(100);
      expect(screen.getByLabelText("Height")).toHaveValue(80);
    });

    it("renders no Reset control for Free Width/Height (Free requires concrete geometry)", () => {
      render(
        <InspectorSizeSection node={{ id: "n1", tag: "img", freeLayout: { x: 10, y: 20, width: 100, height: 80 } }} isFreeChild />,
      );
      expect(screen.queryByRole("button", { name: "Reset width" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Reset height" })).not.toBeInTheDocument();
    });

    it("committing Width writes through setFreeChildGeometry, preserving x/y and Height", () => {
      setupNode({ id: "n1", tag: "img", freeLayout: { x: 10, y: 20, width: 100, height: 80 } });
      render(
        <InspectorSizeSection node={{ id: "n1", tag: "img", freeLayout: { x: 10, y: 20, width: 100, height: 80 } }} isFreeChild />,
      );

      const widthField = screen.getByLabelText("Width");
      fireEvent.change(widthField, { target: { value: "250" } });
      fireEvent.blur(widthField);

      expect(committedNode()?.freeLayout).toEqual({ x: 10, y: 20, width: 250, height: 80 });
    });

    it("committing Height writes through setFreeChildGeometry, preserving x/y and Width", () => {
      setupNode({ id: "n1", tag: "img", freeLayout: { x: 10, y: 20, width: 100, height: 80 } });
      render(
        <InspectorSizeSection node={{ id: "n1", tag: "img", freeLayout: { x: 10, y: 20, width: 100, height: 80 } }} isFreeChild />,
      );

      const heightField = screen.getByLabelText("Height");
      fireEvent.change(heightField, { target: { value: "180" } });
      fireEvent.blur(heightField);

      expect(committedNode()?.freeLayout).toEqual({ x: 10, y: 20, width: 100, height: 180 });
    });

    it("renders nothing at all if the Free child somehow has no freeLayout yet", () => {
      const { container } = render(<InspectorSizeSection node={{ id: "n1", tag: "img" }} isFreeChild />);
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe("Min/Max constraints", () => {
    it("shows Reset disabled and value 0 when unset", () => {
      render(<InspectorSizeSection node={{ id: "n1", tag: "div" }} isFreeChild={false} />);
      expect(screen.getByRole("button", { name: "Reset min width" })).toBeDisabled();
      expect(screen.getByLabelText("Min Width")).toHaveValue(0);
    });

    it("commits Min Width independently of Max Width", () => {
      setupNode({ id: "n1", tag: "div", sizeConstraints: { maxWidth: 800 } });
      render(<InspectorSizeSection node={{ id: "n1", tag: "div", sizeConstraints: { maxWidth: 800 } }} isFreeChild={false} />);

      const minWidthField = screen.getByLabelText("Min Width");
      fireEvent.change(minWidthField, { target: { value: "100" } });
      fireEvent.blur(minWidthField);

      expect(committedNode()?.sizeConstraints).toEqual({ maxWidth: 800, minWidth: 100 });
    });

    it("commits Max Height independently of Min Height", () => {
      setupNode({ id: "n1", tag: "div" });
      render(<InspectorSizeSection node={{ id: "n1", tag: "div" }} isFreeChild={false} />);

      const maxHeightField = screen.getByLabelText("Max Height");
      fireEvent.change(maxHeightField, { target: { value: "400" } });
      fireEvent.blur(maxHeightField);

      expect(committedNode()?.sizeConstraints).toEqual({ maxHeight: 400 });
    });

    it("allows Min Width to exceed Max Width without rewriting either (no relationship enforced)", () => {
      setupNode({ id: "n1", tag: "div", sizeConstraints: { maxWidth: 100 } });
      render(<InspectorSizeSection node={{ id: "n1", tag: "div", sizeConstraints: { maxWidth: 100 } }} isFreeChild={false} />);

      const minWidthField = screen.getByLabelText("Min Width");
      fireEvent.change(minWidthField, { target: { value: "500" } });
      fireEvent.blur(minWidthField);

      expect(committedNode()?.sizeConstraints).toEqual({ maxWidth: 100, minWidth: 500 });
    });

    it("resets exactly one constraint field, leaving siblings untouched", () => {
      setupNode({ id: "n1", tag: "div", sizeConstraints: { minWidth: 100, maxWidth: 800, minHeight: 50, maxHeight: 400 } });
      render(
        <InspectorSizeSection
          node={{ id: "n1", tag: "div", sizeConstraints: { minWidth: 100, maxWidth: 800, minHeight: 50, maxHeight: 400 } }}
          isFreeChild={false}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Reset max width" }));

      expect(committedNode()?.sizeConstraints).toEqual({ minWidth: 100, minHeight: 50, maxHeight: 400 });
    });

    it("applies Min/Max to a Free child too (universal, not Flow-only)", () => {
      setupNode({ id: "n1", tag: "img", freeLayout: { x: 0, y: 0, width: 100, height: 80 } });
      render(
        <InspectorSizeSection node={{ id: "n1", tag: "img", freeLayout: { x: 0, y: 0, width: 100, height: 80 } }} isFreeChild />,
      );

      const maxWidthField = screen.getByLabelText("Max Width");
      fireEvent.change(maxWidthField, { target: { value: "300" } });
      fireEvent.blur(maxWidthField);

      expect(committedNode()?.sizeConstraints).toEqual({ maxWidth: 300 });
      // Free geometry itself is untouched by a constraints edit.
      expect(committedNode()?.freeLayout).toEqual({ x: 0, y: 0, width: 100, height: 80 });
    });
  });

  describe("Aspect Ratio (Checkpoint 5.5, composed here)", () => {
    it("still renders the Aspect Ratio control inside the same section", () => {
      render(<InspectorSizeSection node={{ id: "n1", tag: "div" }} isFreeChild={false} />);
      expect(screen.getByRole("group", { name: "Aspect Ratio" })).toBeInTheDocument();
    });

    it("committing an Aspect Ratio preset never mutates Width/Height/Min/Max", () => {
      setupNode({ id: "n1", tag: "div", dimensions: { preferredWidth: 200, preferredHeight: 150, offsetX: 0, offsetY: 0 } });
      render(
        <InspectorSizeSection
          node={{ id: "n1", tag: "div", dimensions: { preferredWidth: 200, preferredHeight: 150, offsetX: 0, offsetY: 0 } }}
          isFreeChild={false}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Square" }));

      expect(committedNode()?.aspectRatio).toEqual({ mode: "ratio", width: 1, height: 1 });
      expect(committedNode()?.dimensions).toEqual({ preferredWidth: 200, preferredHeight: 150, offsetX: 0, offsetY: 0 });
    });
  });

  describe("Resize Proportions (Free only)", () => {
    it("does not render for a Flow node — the resize engine has no ratio-lock behavior there", () => {
      render(<InspectorSizeSection node={{ id: "n1", tag: "div" }} isFreeChild={false} />);
      expect(screen.queryByText("Lock resize proportions")).not.toBeInTheDocument();
    });

    it("renders for a Free child, defaulting from the tag's own capability (img defaults locked)", () => {
      render(
        <InspectorSizeSection node={{ id: "n1", tag: "img", freeLayout: { x: 0, y: 0, width: 100, height: 80 } }} isFreeChild />,
      );
      expect(screen.getByRole("button", { name: /Lock resize proportions/ })).toHaveAttribute("aria-pressed", "true");
    });

    it("a generic container defaults unlocked", () => {
      render(
        <InspectorSizeSection node={{ id: "n1", tag: "div", freeLayout: { x: 0, y: 0, width: 100, height: 80 } }} isFreeChild />,
      );
      expect(screen.getByRole("button", { name: /Lock resize proportions/ })).toHaveAttribute("aria-pressed", "false");
    });

    it("toggling writes an explicit aspectRatioLocked value", () => {
      setupNode({ id: "n1", tag: "div", freeLayout: { x: 0, y: 0, width: 100, height: 80 } });
      render(
        <InspectorSizeSection node={{ id: "n1", tag: "div", freeLayout: { x: 0, y: 0, width: 100, height: 80 } }} isFreeChild />,
      );

      fireEvent.click(screen.getByRole("button", { name: /Lock resize proportions/ }));
      expect(committedNode()?.aspectRatioLocked).toBe(true);
    });

    it("Reset removes the explicit override, returning to the capability-derived default", () => {
      setupNode({ id: "n1", tag: "img", aspectRatioLocked: false, freeLayout: { x: 0, y: 0, width: 100, height: 80 } });
      render(
        <InspectorSizeSection
          node={{ id: "n1", tag: "img", aspectRatioLocked: false, freeLayout: { x: 0, y: 0, width: 100, height: 80 } }}
          isFreeChild
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Reset resize proportions" }));
      expect(committedNode()?.aspectRatioLocked).toBeUndefined();
    });

    it("Reset is disabled when there's no explicit override", () => {
      render(
        <InspectorSizeSection node={{ id: "n1", tag: "img", freeLayout: { x: 0, y: 0, width: 100, height: 80 } }} isFreeChild />,
      );
      expect(screen.getByRole("button", { name: "Reset resize proportions" })).toBeDisabled();
    });
  });

  describe("Undo/Redo", () => {
    it("keeps the Inspector's Width field synchronized through undo and redo", () => {
      // A bare static `node` prop never round-trips a store commit back
      // into a new render on its own — this wrapper subscribes to the
      // store instead, mirroring how the real Inspector re-derives `node`
      // from the document on every store change (see useSelectedNode).
      // Without this, InspectorNumericValueControl's own `value` prop
      // would never actually observe the intermediate 400 -> undefined
      // transition, and its resync-on-change logic would have nothing to
      // react to — the same test-authoring pitfall documented in
      // InspectorMediaSection.test.tsx (Checkpoint 5.6).
      function ConnectedSection() {
        const node = useEditorStore((state) => state.document.children?.find((c) => c.id === "n1"));
        if (!node) return null;
        return <InspectorSizeSection node={node} isFreeChild={false} />;
      }

      setupNode({ id: "n1", tag: "div" });
      const { rerender } = render(<ConnectedSection />);

      const widthField = screen.getByLabelText("Width");
      fireEvent.change(widthField, { target: { value: "400" } });
      fireEvent.blur(widthField);
      expect(committedNode()?.dimensions?.preferredWidth).toBe(400);
      expect(screen.getByLabelText("Width")).toHaveValue(400);

      useEditorStore.getState().undo();
      expect(committedNode()?.dimensions).toBeUndefined();
      // A direct store-action call (not routed through a fireEvent/RTL
      // helper) doesn't reliably flush the Zustand subscription's own
      // re-render synchronously in this test environment — an explicit
      // rerender forces it, the same technique InspectorMediaSection's
      // own undo/redo regression test (Checkpoint 5.6) already needed.
      rerender(<ConnectedSection />);
      expect(screen.getByLabelText("Width")).toHaveValue(null);

      useEditorStore.getState().redo();
      rerender(<ConnectedSection />);
      expect(committedNode()?.dimensions?.preferredWidth).toBe(400);
      expect(screen.getByLabelText("Width")).toHaveValue(400);
    });
  });
});

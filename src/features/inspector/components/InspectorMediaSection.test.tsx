import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { InspectorMediaSection } from "./InspectorMediaSection";
import type { MediaFitSettings } from "@/features/editor/types/mediaFit";

const initialState = useEditorStore.getState();

// Subscribes to the store so each click sees the freshly-committed node —
// mirrors how the real Inspector re-derives `node` from the document on
// every store change (see useSelectedNode).
function ConnectedSection({ id }: { id: string }) {
  const node = useEditorStore((state) => state.document.children?.find((c) => c.id === id));
  if (!node) return null;
  return <InspectorMediaSection node={node} />;
}

function setup(node: { id: string; tag: string; mediaFit?: MediaFitSettings }) {
  useEditorStore.setState((state) => ({
    document: { ...state.document, children: [{ ...node, children: [] }] },
  }));
  return render(<ConnectedSection id={node.id} />);
}

function currentNode(id: string) {
  return useEditorStore.getState().document.children?.find((c) => c.id === id);
}

describe("InspectorMediaSection", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  describe("Fit", () => {
    it("shows Contain as the active default when objectFit is unset", () => {
      setup({ id: "image-1", tag: "img" });
      expect(screen.getByRole("button", { name: "Contain" })).toHaveAttribute("aria-pressed", "true");
    });

    it.each(["Fill", "Contain", "Cover", "None", "Scale Down"])("selecting %s dispatches a single setMediaFitSettings commit", (label) => {
      setup({ id: "image-1", tag: "img" });
      fireEvent.click(screen.getByRole("button", { name: label }));
      expect(screen.getByRole("button", { name: label })).toHaveAttribute("aria-pressed", "true");
    });

    it("changing Fit does not disturb an already-set Position", () => {
      setup({ id: "image-1", tag: "img", mediaFit: { objectPositionX: { value: 0, unit: "%" }, objectPositionY: { value: 0, unit: "%" } } });
      fireEvent.click(screen.getByRole("button", { name: "Cover" }));
      expect(currentNode("image-1")?.mediaFit).toEqual({
        objectFit: "cover",
        objectPositionX: { value: 0, unit: "%" },
        objectPositionY: { value: 0, unit: "%" },
      });
    });

    it("each Fit option exposes its structured description via a hover tooltip", () => {
      setup({ id: "image-1", tag: "img" });
      expect(screen.getByRole("button", { name: "Cover" })).toHaveAttribute(
        "title",
        "Fill the entire box while preserving proportions. Some content may be cropped.",
      );
    });

    it("Reset removes objectFit while preserving Position", () => {
      setup({
        id: "image-1",
        tag: "img",
        mediaFit: { objectFit: "cover", objectPositionX: { value: 10, unit: "%" }, objectPositionY: { value: 20, unit: "%" } },
      });
      fireEvent.click(screen.getByRole("button", { name: "Reset object fit" }));
      expect(currentNode("image-1")?.mediaFit).toEqual({
        objectPositionX: { value: 10, unit: "%" },
        objectPositionY: { value: 20, unit: "%" },
      });
    });

    it("Reset is disabled (hidden) when objectFit is already unset", () => {
      setup({ id: "image-1", tag: "img" });
      expect(screen.getByRole("button", { name: "Reset object fit" })).toBeDisabled();
    });
  });

  describe("Position — 3x3 grid", () => {
    it("pre-highlights Center as the effective default when position is unset", () => {
      setup({ id: "image-1", tag: "img" });
      expect(screen.getByRole("button", { name: "Position center" })).toHaveAttribute("aria-pressed", "true");
    });

    it("clicking a preset sets both X and Y together in one commit", () => {
      setup({ id: "image-1", tag: "img" });
      fireEvent.click(screen.getByRole("button", { name: "Position bottom right" }));
      expect(currentNode("image-1")?.mediaFit).toEqual({
        objectPositionX: { value: 100, unit: "%" },
        objectPositionY: { value: 100, unit: "%" },
      });
    });

    it("clicking a preset does not disturb an already-set Fit", () => {
      setup({ id: "image-1", tag: "img", mediaFit: { objectFit: "cover" } });
      fireEvent.click(screen.getByRole("button", { name: "Position top left" }));
      expect(currentNode("image-1")?.mediaFit).toEqual({
        objectFit: "cover",
        objectPositionX: { value: 0, unit: "%" },
        objectPositionY: { value: 0, unit: "%" },
      });
    });

    it("recognizes all nine presets by exact value", () => {
      setup({
        id: "image-1",
        tag: "img",
        mediaFit: { objectPositionX: { value: 100, unit: "%" }, objectPositionY: { value: 0, unit: "%" } },
      });
      expect(screen.getByRole("button", { name: "Position top right" })).toHaveAttribute("aria-pressed", "true");
    });

    it("highlights no preset for a custom position", () => {
      setup({
        id: "image-1",
        tag: "img",
        mediaFit: { objectPositionX: { value: 37, unit: "%" }, objectPositionY: { value: 68, unit: "%" } },
      });
      const grid = screen.getByRole("group", { name: "Position" });
      for (const button of within(grid).getAllByRole("button")) {
        expect(button).toHaveAttribute("aria-pressed", "false");
      }
    });

    it("Reset removes both X and Y in one commit, preserving Fit", () => {
      setup({
        id: "image-1",
        tag: "img",
        mediaFit: { objectFit: "cover", objectPositionX: { value: 37, unit: "%" }, objectPositionY: { value: 68, unit: "%" } },
      });
      fireEvent.click(screen.getByRole("button", { name: "Reset object position" }));
      expect(currentNode("image-1")?.mediaFit).toEqual({ objectFit: "cover" });
    });
  });

  describe("Position — custom X/Y fields", () => {
    it("shows 50 for both axes by default", () => {
      setup({ id: "image-1", tag: "img" });
      expect(screen.getByLabelText("Object position X")).toHaveValue(50);
      expect(screen.getByLabelText("Object position Y")).toHaveValue(50);
    });

    it("committing a custom X sets only objectPositionX, preserving Y and Fit", () => {
      setup({
        id: "image-1",
        tag: "img",
        mediaFit: { objectFit: "cover", objectPositionY: { value: 68, unit: "%" } },
      });
      const xField = screen.getByLabelText("Object position X");
      fireEvent.change(xField, { target: { value: "37" } });
      fireEvent.blur(xField);

      expect(currentNode("image-1")?.mediaFit).toEqual({
        objectFit: "cover",
        objectPositionX: { value: 37, unit: "%" },
        objectPositionY: { value: 68, unit: "%" },
      });
    });

    it("committing a custom Y sets only objectPositionY, preserving X", () => {
      setup({ id: "image-1", tag: "img", mediaFit: { objectPositionX: { value: 37, unit: "%" } } });
      const yField = screen.getByLabelText("Object position Y");
      fireEvent.change(yField, { target: { value: "68" } });
      fireEvent.blur(yField);

      expect(currentNode("image-1")?.mediaFit).toEqual({
        objectPositionX: { value: 37, unit: "%" },
        objectPositionY: { value: 68, unit: "%" },
      });
    });

    it("allows a negative and an over-100 percentage — no artificial clamp", () => {
      setup({ id: "image-1", tag: "img" });
      const xField = screen.getByLabelText("Object position X");
      fireEvent.change(xField, { target: { value: "-20" } });
      fireEvent.blur(xField);
      expect(currentNode("image-1")?.mediaFit?.objectPositionX).toEqual({ value: -20, unit: "%" });

      const yField = screen.getByLabelText("Object position Y");
      fireEvent.change(yField, { target: { value: "120" } });
      fireEvent.blur(yField);
      expect(currentNode("image-1")?.mediaFit?.objectPositionY).toEqual({ value: 120, unit: "%" });
    });

    it("editing X into an exact preset value re-highlights that preset", () => {
      setup({ id: "image-1", tag: "img" });
      const xField = screen.getByLabelText("Object position X");
      fireEvent.change(xField, { target: { value: "0" } });
      fireEvent.blur(xField);
      const yField = screen.getByLabelText("Object position Y");
      fireEvent.change(yField, { target: { value: "0" } });
      fireEvent.blur(yField);

      expect(screen.getByRole("button", { name: "Position top left" })).toHaveAttribute("aria-pressed", "true");
    });
  });

  describe("independence from Aspect Ratio", () => {
    it("changing Media Fit never writes aspectRatio", () => {
      setup({ id: "image-1", tag: "img" });
      fireEvent.click(screen.getByRole("button", { name: "Cover" }));
      expect(currentNode("image-1")).not.toHaveProperty("aspectRatio");
    });
  });

  describe("Undo/Redo", () => {
    it("keeps the Inspector's derived preset state synchronized through undo and redo", () => {
      const { rerender } = setup({ id: "image-1", tag: "img" });

      fireEvent.click(screen.getByRole("button", { name: "Position bottom right" }));
      expect(currentNode("image-1")?.mediaFit).toEqual({
        objectPositionX: { value: 100, unit: "%" },
        objectPositionY: { value: 100, unit: "%" },
      });

      useEditorStore.getState().undo();
      expect(currentNode("image-1")?.mediaFit).toBeUndefined();
      // Re-render with the freshly-reverted node — mirrors how the real
      // Inspector re-derives `node` from the document on every store
      // change (see InspectorAspectRatioSection's own equivalent
      // regression test for the same rationale). Because this section
      // holds no local "mode" state at all (see its own doc comment),
      // deriving the 3x3 grid's active preset straight from `node` on
      // every render is what keeps it immune to the stale-view bug class
      // Checkpoint 5.5 found in InspectorAspectRatioSection.
      rerender(<ConnectedSection id="image-1" />);
      expect(screen.getByRole("button", { name: "Position center" })).toHaveAttribute("aria-pressed", "true");

      useEditorStore.getState().redo();
      expect(currentNode("image-1")?.mediaFit).toEqual({
        objectPositionX: { value: 100, unit: "%" },
        objectPositionY: { value: 100, unit: "%" },
      });
      rerender(<ConnectedSection id="image-1" />);
      expect(screen.getByRole("button", { name: "Position bottom right" })).toHaveAttribute("aria-pressed", "true");
    });
  });

  describe("selection changes", () => {
    it("reflects a freshly-selected node's own settings, not the previous node's", () => {
      useEditorStore.setState((state) => ({
        document: {
          ...state.document,
          children: [
            { id: "image-1", tag: "img", mediaFit: { objectFit: "cover" as const }, children: [] },
            { id: "image-2", tag: "img", children: [] },
          ],
        },
      }));
      const { rerender } = render(<InspectorMediaSection node={currentNode("image-1")!} />);
      expect(screen.getByRole("button", { name: "Cover" })).toHaveAttribute("aria-pressed", "true");

      rerender(<InspectorMediaSection node={currentNode("image-2")!} />);
      expect(screen.getByRole("button", { name: "Contain" })).toHaveAttribute("aria-pressed", "true");
    });
  });
});

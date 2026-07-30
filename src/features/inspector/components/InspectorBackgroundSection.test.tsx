import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { InspectorBackgroundSection } from "./InspectorBackgroundSection";

const initialState = useEditorStore.getState();

function setupNode(node: Parameters<typeof InspectorBackgroundSection>[0]["node"]) {
  useEditorStore.setState((state) => ({
    document: { ...state.document, children: [node] },
  }));
}

function committedNode() {
  return useEditorStore.getState().document.children?.find((c) => c.id === "container-1");
}

describe("InspectorBackgroundSection", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("shows Color as unset and Source as None for a node with no background", () => {
    render(<InspectorBackgroundSection node={{ id: "container-1", tag: "div" }} />);

    expect(screen.getByLabelText("Background color")).toHaveValue("");
    expect(screen.getByRole("button", { name: "None" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Image" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Gradient" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByLabelText("Background image URL")).not.toBeInTheDocument();
    expect(screen.queryByText("Stops (2)")).not.toBeInTheDocument();
  });

  it("commits a valid hex Background Color", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorBackgroundSection node={{ id: "container-1", tag: "div" }} />);

    const input = screen.getByLabelText("Background color");
    fireEvent.change(input, { target: { value: "#3366ff" } });
    fireEvent.blur(input);

    expect(committedNode()?.background?.color).toBe("#3366ff");
  });

  it("rejects a malformed Background Color with a clear validation message and does not commit", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorBackgroundSection node={{ id: "container-1", tag: "div" }} />);

    const input = screen.getByLabelText("Background color");
    fireEvent.change(input, { target: { value: "not-a-color" } });
    fireEvent.blur(input);

    expect(screen.getByRole("alert")).toHaveTextContent("Enter a hex color (#RRGGBB) or an rgb()/rgba() value.");
    expect(committedNode()?.background?.color).toBeUndefined();
  });

  it("resets Background Color, collapsing background back to undefined", () => {
    setupNode({ id: "container-1", tag: "div", background: { color: "#3366ff" } });
    render(<InspectorBackgroundSection node={{ id: "container-1", tag: "div", background: { color: "#3366ff" } }} />);

    fireEvent.click(screen.getByRole("button", { name: "Reset background color" }));

    expect(committedNode()?.background).toBeUndefined();
  });

  it("shows Image as the active source (and its controls) for a legacy document with a stored image but no explicit sourceType", () => {
    render(<InspectorBackgroundSection node={{ id: "container-1", tag: "div", background: { image: "hero.jpg" } }} />);

    expect(screen.getByRole("button", { name: "Image" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Background image URL")).toHaveValue("hero.jpg");
  });

  it("selecting Image stores an explicit sourceType", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorBackgroundSection node={{ id: "container-1", tag: "div" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Image" }));

    expect(committedNode()?.background?.sourceType).toBe("image");
  });

  it("shows the Image controls once Image is already the active source", () => {
    render(<InspectorBackgroundSection node={{ id: "container-1", tag: "div", background: { sourceType: "image" } }} />);

    expect(screen.getByLabelText("Background image URL")).toBeInTheDocument();
  });

  it("selecting Gradient activates a default two-stop linear gradient in one history entry", () => {
    setupNode({ id: "container-1", tag: "div" });
    const pastLengthBefore = useEditorStore.getState().past.length;
    render(<InspectorBackgroundSection node={{ id: "container-1", tag: "div" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Gradient" }));

    expect(committedNode()?.background?.sourceType).toBe("gradient");
    expect(committedNode()?.background?.gradient?.type).toBe("linear");
    expect(committedNode()?.background?.gradient?.stops).toHaveLength(2);
    expect(useEditorStore.getState().past).toHaveLength(pastLengthBefore + 1);
  });

  it("shows the Gradient controls once Gradient is already the active source", () => {
    const background = {
      sourceType: "gradient" as const,
      gradient: { type: "linear" as const, angle: 90, stops: [{ id: "a", color: "#000000", position: 0 }, { id: "b", color: "#ffffff", position: 100 }] },
    };
    setupNode({ id: "container-1", tag: "div", background });
    render(<InspectorBackgroundSection node={{ id: "container-1", tag: "div", background }} />);

    expect(screen.getByText("Stops (2)")).toBeInTheDocument();
  });

  it("hides the Gradient controls and shows the Image controls once switched back to Image", () => {
    const background = {
      sourceType: "gradient" as const,
      image: "hero.jpg",
      gradient: { type: "linear" as const, angle: 90, stops: [{ id: "a", color: "#000000", position: 0 }, { id: "b", color: "#ffffff", position: 100 }] },
    };
    setupNode({ id: "container-1", tag: "div", background });
    render(<InspectorBackgroundSection node={{ id: "container-1", tag: "div", background }} />);

    fireEvent.click(screen.getByRole("button", { name: "Image" }));

    expect(committedNode()?.background?.sourceType).toBe("image");
    expect(committedNode()?.background?.image).toBe("hero.jpg");
    // Preserved, not deleted, even though it's now inactive.
    expect(committedNode()?.background?.gradient).toBeDefined();
  });

  it("preserves a previously-configured gradient when reactivating Gradient after exploring Image", () => {
    const background = {
      sourceType: "image" as const,
      image: "hero.jpg",
      gradient: {
        type: "radial" as const,
        shape: "circle" as const,
        position: "top-left" as const,
        stops: [{ id: "a", color: "#ff0000", position: 0 }, { id: "b", color: "#00ff00", position: 100 }],
      },
    };
    setupNode({ id: "container-1", tag: "div", background });
    render(<InspectorBackgroundSection node={{ id: "container-1", tag: "div", background }} />);

    fireEvent.click(screen.getByRole("button", { name: "Gradient" }));

    expect(committedNode()?.background?.gradient?.type).toBe("radial");
    expect(committedNode()?.background?.gradient?.stops.map((s) => s.color)).toEqual(["#ff0000", "#00ff00"]);
  });

  it("selecting None deactivates both sources without deleting their stored data", () => {
    const background = {
      sourceType: "gradient" as const,
      image: "hero.jpg",
      gradient: { type: "linear" as const, angle: 90, stops: [{ id: "a", color: "#000000", position: 0 }, { id: "b", color: "#ffffff", position: 100 }] },
    };
    setupNode({ id: "container-1", tag: "div", background });
    render(<InspectorBackgroundSection node={{ id: "container-1", tag: "div", background }} />);

    fireEvent.click(screen.getByRole("button", { name: "None" }));

    expect(committedNode()?.background?.sourceType).toBeUndefined();
    expect(committedNode()?.background?.image).toBe("hero.jpg");
    expect(committedNode()?.background?.gradient).toBeDefined();
  });

  it("shows neither Image nor Gradient controls once the source is None", () => {
    render(<InspectorBackgroundSection node={{ id: "container-1", tag: "div", background: { color: "#3366ff" } }} />);

    expect(screen.getByRole("button", { name: "None" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByLabelText("Background image URL")).not.toBeInTheDocument();
    expect(screen.queryByText(/Stops \(/)).not.toBeInTheDocument();
  });

  it("is undoable and redoable through the normal history stack", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorBackgroundSection node={{ id: "container-1", tag: "div" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Gradient" }));
    expect(committedNode()?.background?.sourceType).toBe("gradient");

    useEditorStore.getState().undo();
    expect(committedNode()?.background).toBeUndefined();

    useEditorStore.getState().redo();
    expect(committedNode()?.background?.sourceType).toBe("gradient");
  });

  it("clears a stale validation error when the selected node changes", () => {
    const { rerender } = render(<InspectorBackgroundSection node={{ id: "container-1", tag: "div" }} />);

    const input = screen.getByLabelText("Background color");
    fireEvent.change(input, { target: { value: "not-a-color" } });
    fireEvent.blur(input);
    expect(screen.getByRole("alert")).toBeInTheDocument();

    rerender(<InspectorBackgroundSection node={{ id: "container-2", tag: "div" }} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

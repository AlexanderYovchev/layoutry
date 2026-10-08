import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { InspectorTransformSection } from "./InspectorTransformSection";

const initialState = useEditorStore.getState();

function setupNode(node: Parameters<typeof InspectorTransformSection>[0]["node"]) {
  useEditorStore.setState((state) => ({
    document: { ...state.document, children: [node] },
  }));
}

function committedNode() {
  return useEditorStore.getState().document.children?.find((c) => c.id === "container-1");
}

describe("InspectorTransformSection", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("shows identity placeholders (0/0/0/1) and a disabled Reset for a node with no authored Transform", () => {
    render(<InspectorTransformSection node={{ id: "container-1", tag: "div" }} />);

    expect(screen.getByLabelText("Translate X")).toHaveValue(0);
    expect(screen.getByLabelText("Translate Y")).toHaveValue(0);
    expect(screen.getByLabelText("Rotate")).toHaveValue(0);
    expect(screen.getByLabelText("Scale")).toHaveValue(1);
    expect(screen.getByRole("button", { name: "Reset transform" })).toBeDisabled();
  });

  it("commits Translate X/Y through their numeric fields", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorTransformSection node={{ id: "container-1", tag: "div" }} />);

    fireEvent.change(screen.getByLabelText("Translate X"), { target: { value: "20" } });
    fireEvent.blur(screen.getByLabelText("Translate X"));
    expect(committedNode()?.transform?.translateX).toBe(20);

    fireEvent.change(screen.getByLabelText("Translate Y"), { target: { value: "-10" } });
    fireEvent.blur(screen.getByLabelText("Translate Y"));
    expect(committedNode()?.transform?.translateY).toBe(-10);
  });

  it("commits Rotate, including 360 unchanged", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorTransformSection node={{ id: "container-1", tag: "div" }} />);

    fireEvent.change(screen.getByLabelText("Rotate"), { target: { value: "360" } });
    fireEvent.blur(screen.getByLabelText("Rotate"));
    expect(committedNode()?.transform?.rotateDeg).toBe(360);
  });

  it("commits Scale, including zero and negative values", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorTransformSection node={{ id: "container-1", tag: "div" }} />);

    fireEvent.change(screen.getByLabelText("Scale"), { target: { value: "0" } });
    fireEvent.blur(screen.getByLabelText("Scale"));
    expect(committedNode()?.transform?.scale).toBe(0);

    fireEvent.change(screen.getByLabelText("Scale"), { target: { value: "-1" } });
    fireEvent.blur(screen.getByLabelText("Scale"));
    expect(committedNode()?.transform?.scale).toBe(-1);
  });

  it("setting a field back to its identity value removes just that field", () => {
    const transform = { translateX: 20, rotateDeg: 15 };
    setupNode({ id: "container-1", tag: "div", transform });
    render(<InspectorTransformSection node={{ id: "container-1", tag: "div", transform }} />);

    fireEvent.change(screen.getByLabelText("Rotate"), { target: { value: "0" } });
    fireEvent.blur(screen.getByLabelText("Rotate"));
    expect(committedNode()?.transform).toEqual({ translateX: 20 });
  });

  it("Reset transform clears the whole Transform", () => {
    const transform = { translateX: 20, rotateDeg: 15 };
    setupNode({ id: "container-1", tag: "div", transform });
    render(<InspectorTransformSection node={{ id: "container-1", tag: "div", transform }} />);

    fireEvent.click(screen.getByRole("button", { name: "Reset transform" }));
    expect(committedNode()?.transform).toBeUndefined();
  });

  it("does not push a history entry when committing a field to its current value", () => {
    const transform = { rotateDeg: 15 };
    setupNode({ id: "container-1", tag: "div", transform });
    render(<InspectorTransformSection node={{ id: "container-1", tag: "div", transform }} />);
    const historyLengthBefore = useEditorStore.getState().past.length;

    fireEvent.change(screen.getByLabelText("Rotate"), { target: { value: "15" } });
    fireEvent.blur(screen.getByLabelText("Rotate"));

    expect(useEditorStore.getState().past.length).toBe(historyLengthBefore);
  });

  it("shows the ancestor-restriction hint only for a container with children and a non-identity rotate/scale", () => {
    const transform = { rotateDeg: 15 };
    const leaf = { id: "leaf", tag: "p" };

    const { rerender } = render(<InspectorTransformSection node={{ id: "container-1", tag: "div", transform, children: [leaf] }} />);
    expect(screen.getByText(/Reset this container's rotation or scale/)).toBeInTheDocument();

    // No children: no hint.
    rerender(<InspectorTransformSection node={{ id: "container-1", tag: "div", transform }} />);
    expect(screen.queryByText(/Reset this container's rotation or scale/)).not.toBeInTheDocument();

    // Translate-only: no hint, even with children.
    rerender(<InspectorTransformSection node={{ id: "container-1", tag: "div", transform: { translateX: 20 }, children: [leaf] }} />);
    expect(screen.queryByText(/Reset this container's rotation or scale/)).not.toBeInTheDocument();
  });

  it("always shows the general educational hint", () => {
    render(<InspectorTransformSection node={{ id: "container-1", tag: "div" }} />);
    expect(screen.getByText(/Transforms change how an element looks/)).toBeInTheDocument();
  });
});

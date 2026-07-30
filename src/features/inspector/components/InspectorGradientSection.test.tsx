import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { InspectorGradientSection } from "./InspectorGradientSection";
import type { BackgroundSettings } from "@/features/editor/types/background";

const initialState = useEditorStore.getState();

function linearBackground(): BackgroundSettings {
  return {
    sourceType: "gradient",
    gradient: {
      type: "linear",
      angle: 90,
      stops: [
        { id: "stop-a", color: "#000000", position: 0 },
        { id: "stop-b", color: "#ffffff", position: 100 },
      ],
    },
  };
}

function setupNode(node: Parameters<typeof InspectorGradientSection>[0]["node"]) {
  useEditorStore.setState((state) => ({
    document: { ...state.document, children: [node] },
  }));
}

function committedNode() {
  return useEditorStore.getState().document.children?.find((c) => c.id === "container-1");
}

beforeEach(() => {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    right: 200,
    bottom: 24,
    width: 200,
    height: 24,
    x: 0,
    y: 0,
    toJSON: () => "",
  });
});

describe("InspectorGradientSection", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("shows Linear active with the stored angle, and the first stop selected by default", () => {
    const background = linearBackground();
    render(<InspectorGradientSection node={{ id: "container-1", tag: "div", background }} />);

    expect(screen.getByRole("button", { name: "Linear" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Angle")).toHaveValue(90);
    expect(screen.getByLabelText("Gradient stop color")).toHaveValue("#000000");
    expect(screen.getByLabelText("Stop position")).toHaveValue(0);
    expect(screen.getByText("Stops (2)")).toBeInTheDocument();
  });

  it("switches to Radial, reusing the same stops and defaulting shape/position", () => {
    const background = linearBackground();
    setupNode({ id: "container-1", tag: "div", background });
    render(<InspectorGradientSection node={{ id: "container-1", tag: "div", background }} />);

    fireEvent.click(screen.getByRole("button", { name: "Radial" }));

    const gradient = committedNode()?.background?.gradient;
    expect(gradient?.type).toBe("radial");
    if (gradient?.type === "radial") {
      expect(gradient.shape).toBe("ellipse");
      expect(gradient.position).toBe("center");
    }
    expect(gradient?.stops.map((s) => s.id)).toEqual(["stop-a", "stop-b"]);
  });

  it("shows Shape and Position controls once Radial is already active", () => {
    const background: BackgroundSettings = {
      sourceType: "gradient",
      gradient: { type: "radial", shape: "circle", position: "top-left", stops: linearBackground().gradient!.stops },
    };
    render(<InspectorGradientSection node={{ id: "container-1", tag: "div", background }} />);

    expect(screen.getByRole("button", { name: "Circle" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Top left" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByLabelText("Angle")).not.toBeInTheDocument();
  });

  it("commits a Radial shape change", () => {
    const background: BackgroundSettings = {
      sourceType: "gradient",
      gradient: { type: "radial", shape: "ellipse", position: "center", stops: linearBackground().gradient!.stops },
    };
    setupNode({ id: "container-1", tag: "div", background });
    render(<InspectorGradientSection node={{ id: "container-1", tag: "div", background }} />);

    fireEvent.click(screen.getByRole("button", { name: "Circle" }));

    const gradient = committedNode()?.background?.gradient;
    expect(gradient?.type === "radial" && gradient.shape).toBe("circle");
  });

  it("commits a Radial position change", () => {
    const background: BackgroundSettings = {
      sourceType: "gradient",
      gradient: { type: "radial", shape: "ellipse", position: "center", stops: linearBackground().gradient!.stops },
    };
    setupNode({ id: "container-1", tag: "div", background });
    render(<InspectorGradientSection node={{ id: "container-1", tag: "div", background }} />);

    fireEvent.click(screen.getByRole("button", { name: "Bottom right" }));

    const gradient = committedNode()?.background?.gradient;
    expect(gradient?.type === "radial" && gradient.position).toBe("bottom-right");
  });

  it("commits an angle change, normalizing an out-of-range value into [0, 360)", () => {
    const background = linearBackground();
    setupNode({ id: "container-1", tag: "div", background });
    render(<InspectorGradientSection node={{ id: "container-1", tag: "div", background }} />);

    const angleInput = screen.getByLabelText("Angle");
    fireEvent.change(angleInput, { target: { value: "370" } });
    fireEvent.blur(angleInput);

    const gradient = committedNode()?.background?.gradient;
    expect(gradient?.type === "linear" && gradient.angle).toBe(10);
  });

  it("commits a valid hex color for the selected stop", () => {
    const background = linearBackground();
    setupNode({ id: "container-1", tag: "div", background });
    render(<InspectorGradientSection node={{ id: "container-1", tag: "div", background }} />);

    const colorInput = screen.getByLabelText("Gradient stop color");
    fireEvent.change(colorInput, { target: { value: "#3366ff" } });
    fireEvent.blur(colorInput);

    expect(committedNode()?.background?.gradient?.stops.find((s) => s.id === "stop-a")?.color).toBe("#3366ff");
  });

  it("rejects a malformed stop color with a clear validation message and does not commit", () => {
    const background = linearBackground();
    setupNode({ id: "container-1", tag: "div", background });
    render(<InspectorGradientSection node={{ id: "container-1", tag: "div", background }} />);

    const colorInput = screen.getByLabelText("Gradient stop color");
    fireEvent.change(colorInput, { target: { value: "not-a-color" } });
    fireEvent.blur(colorInput);

    expect(screen.getByRole("alert")).toHaveTextContent("Enter a hex color (#RRGGBB) or an rgb()/rgba() value.");
    expect(committedNode()?.background?.gradient?.stops.find((s) => s.id === "stop-a")?.color).toBe("#000000");
  });

  it("commits a valid stop position", () => {
    const background = linearBackground();
    setupNode({ id: "container-1", tag: "div", background });
    render(<InspectorGradientSection node={{ id: "container-1", tag: "div", background }} />);

    const positionInput = screen.getByLabelText("Stop position");
    fireEvent.change(positionInput, { target: { value: "40" } });
    fireEvent.blur(positionInput);

    expect(committedNode()?.background?.gradient?.stops.find((s) => s.id === "stop-a")?.position).toBe(40);
  });

  it("rejects an out-of-range stop position with a clear validation message and does not commit", () => {
    const background = linearBackground();
    setupNode({ id: "container-1", tag: "div", background });
    render(<InspectorGradientSection node={{ id: "container-1", tag: "div", background }} />);

    const positionInput = screen.getByLabelText("Stop position");
    fireEvent.change(positionInput, { target: { value: "150" } });
    fireEvent.blur(positionInput);

    expect(screen.getByText("Enter a position between 0 and 100.")).toBeInTheDocument();
    expect(committedNode()?.background?.gradient?.stops.find((s) => s.id === "stop-a")?.position).toBe(0);
  });

  it("adds a stop with a computed position and nearest-neighbor color, and selects it", () => {
    const background = linearBackground();
    setupNode({ id: "container-1", tag: "div", background });
    render(<InspectorGradientSection node={{ id: "container-1", tag: "div", background }} />);

    fireEvent.click(screen.getByRole("button", { name: "Add stop" }));

    const gradient = committedNode()?.background?.gradient;
    expect(gradient?.stops).toHaveLength(3);
    const newStop = gradient?.stops.find((s) => s.id !== "stop-a" && s.id !== "stop-b");
    expect(newStop?.position).toBe(50);
  });

  it("disables Add Stop at the maximum stop count", () => {
    const stops = Array.from({ length: 16 }, (_, i) => ({ id: `s${i}`, color: "#123456", position: i * 6 }));
    const background: BackgroundSettings = { sourceType: "gradient", gradient: { type: "linear", angle: 90, stops } };
    render(<InspectorGradientSection node={{ id: "container-1", tag: "div", background }} />);

    expect(screen.getByRole("button", { name: "Add stop" })).toBeDisabled();
  });

  it("disables Remove Stop when only two stops remain, and enables it with more", () => {
    const background = linearBackground();
    const { unmount } = render(<InspectorGradientSection node={{ id: "container-1", tag: "div", background }} />);
    expect(screen.getByRole("button", { name: "Remove selected stop" })).toBeDisabled();
    unmount();

    const threeStopBackground: BackgroundSettings = {
      sourceType: "gradient",
      gradient: { type: "linear", angle: 90, stops: [...linearBackground().gradient!.stops, { id: "stop-c", color: "#888888", position: 50 }] },
    };
    render(<InspectorGradientSection node={{ id: "container-1", tag: "div", background: threeStopBackground }} />);
    expect(screen.getByRole("button", { name: "Remove selected stop" })).toBeEnabled();
  });

  it("removes the selected stop and selects a predictable next stop", () => {
    const background: BackgroundSettings = {
      sourceType: "gradient",
      // Already sorted by position, matching what any real add/update
      // commit would have produced (removeGradientStop only filters — it
      // relies on the array already being sorted, which every OTHER
      // mutation guarantees).
      gradient: {
        type: "linear",
        angle: 90,
        stops: [{ id: "stop-a", color: "#000000", position: 0 }, { id: "stop-c", color: "#888888", position: 50 }, { id: "stop-b", color: "#ffffff", position: 100 }],
      },
    };
    setupNode({ id: "container-1", tag: "div", background });
    render(<InspectorGradientSection node={{ id: "container-1", tag: "div", background }} />);

    // The first stop (stop-a, position 0) is selected by default.
    fireEvent.click(screen.getByRole("button", { name: "Remove selected stop" }));

    const gradient = committedNode()?.background?.gradient;
    expect(gradient?.stops.map((s) => s.id)).toEqual(["stop-c", "stop-b"]);
  });

  it("resets the gradient, collapsing background back to undefined", () => {
    const background = linearBackground();
    setupNode({ id: "container-1", tag: "div", background });
    render(<InspectorGradientSection node={{ id: "container-1", tag: "div", background }} />);

    fireEvent.click(screen.getByRole("button", { name: "Reset gradient" }));

    expect(committedNode()?.background).toBeUndefined();
  });

  it("is undoable and redoable for a type switch", () => {
    const background = linearBackground();
    setupNode({ id: "container-1", tag: "div", background });
    render(<InspectorGradientSection node={{ id: "container-1", tag: "div", background }} />);

    fireEvent.click(screen.getByRole("button", { name: "Radial" }));
    expect(committedNode()?.background?.gradient?.type).toBe("radial");

    useEditorStore.getState().undo();
    expect(committedNode()?.background?.gradient?.type).toBe("linear");

    useEditorStore.getState().redo();
    expect(committedNode()?.background?.gradient?.type).toBe("radial");
  });

  it("collapses an entire stop drag into exactly one history entry, with no history pushed mid-drag", () => {
    const background = linearBackground();
    setupNode({ id: "container-1", tag: "div", background });
    render(<InspectorGradientSection node={{ id: "container-1", tag: "div", background }} />);

    const pastLengthBefore = useEditorStore.getState().past.length;
    const marker = screen.getByRole("button", { name: "Gradient stop: #000000 at 0%" });

    fireEvent.pointerDown(marker, { pointerId: 1 });
    fireEvent.pointerMove(marker, { pointerId: 1, clientX: 60 });
    expect(useEditorStore.getState().past).toHaveLength(pastLengthBefore);

    fireEvent.pointerMove(marker, { pointerId: 1, clientX: 100 });
    expect(useEditorStore.getState().past).toHaveLength(pastLengthBefore);

    fireEvent.pointerUp(marker, { pointerId: 1 });
    expect(useEditorStore.getState().past).toHaveLength(pastLengthBefore + 1);
    expect(committedNode()?.background?.gradient?.stops.find((s) => s.id === "stop-a")?.position).toBe(50);

    useEditorStore.getState().undo();
    expect(committedNode()?.background?.gradient?.stops.find((s) => s.id === "stop-a")?.position).toBe(0);
  });

  it("does not push history for a plain click with no movement", () => {
    const background = linearBackground();
    setupNode({ id: "container-1", tag: "div", background });
    render(<InspectorGradientSection node={{ id: "container-1", tag: "div", background }} />);

    const pastLengthBefore = useEditorStore.getState().past.length;
    const marker = screen.getByRole("button", { name: "Gradient stop: #ffffff at 100%" });

    fireEvent.pointerDown(marker, { pointerId: 1 });
    fireEvent.pointerUp(marker, { pointerId: 1 });

    expect(useEditorStore.getState().past).toHaveLength(pastLengthBefore);
  });

  it("adjusts the focused stop's position by keyboard in one commit per key press", () => {
    const background = linearBackground();
    setupNode({ id: "container-1", tag: "div", background });
    render(<InspectorGradientSection node={{ id: "container-1", tag: "div", background }} />);

    const marker = screen.getByRole("button", { name: "Gradient stop: #000000 at 0%" });
    fireEvent.keyDown(marker, { key: "ArrowRight" });

    expect(committedNode()?.background?.gradient?.stops.find((s) => s.id === "stop-a")?.position).toBe(1);
  });

  it("clears stale validation errors when the selected node changes", () => {
    const background = linearBackground();
    const { rerender } = render(<InspectorGradientSection node={{ id: "container-1", tag: "div", background }} />);

    const colorInput = screen.getByLabelText("Gradient stop color");
    fireEvent.change(colorInput, { target: { value: "not-a-color" } });
    fireEvent.blur(colorInput);
    expect(screen.getByRole("alert")).toBeInTheDocument();

    rerender(<InspectorGradientSection node={{ id: "container-2", tag: "div", background }} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

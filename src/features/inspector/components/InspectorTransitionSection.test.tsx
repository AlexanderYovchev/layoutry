import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { InspectorTransitionSection } from "./InspectorTransitionSection";

const initialState = useEditorStore.getState();

function setupNode(node: Parameters<typeof InspectorTransitionSection>[0]["node"]) {
  useEditorStore.setState((state) => ({
    document: { ...state.document, children: [node] },
  }));
}

function committedNode() {
  return useEditorStore.getState().document.children?.find((c) => c.id === "container-1");
}

describe("InspectorTransitionSection", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("shows Property as None, and no Duration/Timing/Delay, for a node with no authored transition", () => {
    render(<InspectorTransitionSection node={{ id: "container-1", tag: "div" }} />);

    expect(screen.getByRole("button", { name: "None", pressed: true })).toBeInTheDocument();
    expect(screen.queryByLabelText("Duration")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset transition" })).toBeDisabled();
  });

  it("choosing a real Property creates a complete transition with the documented defaults", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorTransitionSection node={{ id: "container-1", tag: "div" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Opacity" }));

    expect(committedNode()?.transition).toEqual({ property: "opacity", durationMs: 200, timingFunction: "ease", delayMs: 0 });
  });

  it("commits Duration/Delay through the numeric fields once a transition exists", () => {
    setupNode({ id: "container-1", tag: "div", transition: { property: "opacity", durationMs: 200, timingFunction: "ease", delayMs: 0 } });
    render(<InspectorTransitionSection node={{ id: "container-1", tag: "div", transition: { property: "opacity", durationMs: 200, timingFunction: "ease", delayMs: 0 } }} />);

    fireEvent.change(screen.getByLabelText("Duration"), { target: { value: "1000" } });
    fireEvent.blur(screen.getByLabelText("Duration"));
    expect(committedNode()?.transition?.durationMs).toBe(1000);

    fireEvent.change(screen.getByLabelText("Delay"), { target: { value: "150" } });
    fireEvent.blur(screen.getByLabelText("Delay"));
    expect(committedNode()?.transition?.delayMs).toBe(150);
  });

  it("commits Timing through the select once a transition exists", () => {
    const transition = { property: "opacity" as const, durationMs: 200, timingFunction: "ease" as const, delayMs: 0 };
    setupNode({ id: "container-1", tag: "div", transition });
    render(<InspectorTransitionSection node={{ id: "container-1", tag: "div", transition }} />);

    fireEvent.change(screen.getByLabelText("Timing"), { target: { value: "ease-out" } });
    expect(committedNode()?.transition?.timingFunction).toBe("ease-out");
  });

  it("choosing None clears the transition entirely", () => {
    const transition = { property: "opacity" as const, durationMs: 200, timingFunction: "ease" as const, delayMs: 0 };
    setupNode({ id: "container-1", tag: "div", transition });
    render(<InspectorTransitionSection node={{ id: "container-1", tag: "div", transition }} />);

    fireEvent.click(screen.getByRole("button", { name: "None" }));
    expect(committedNode()?.transition).toBeUndefined();
  });

  it("Reset transition clears the transition entirely", () => {
    const transition = { property: "opacity" as const, durationMs: 200, timingFunction: "ease" as const, delayMs: 0 };
    setupNode({ id: "container-1", tag: "div", transition });
    render(<InspectorTransitionSection node={{ id: "container-1", tag: "div", transition }} />);

    fireEvent.click(screen.getByRole("button", { name: "Reset transition" }));
    expect(committedNode()?.transition).toBeUndefined();
  });

  it("does not push a history entry when committing a field to its current value", () => {
    const transition = { property: "opacity" as const, durationMs: 200, timingFunction: "ease" as const, delayMs: 0 };
    setupNode({ id: "container-1", tag: "div", transition });
    render(<InspectorTransitionSection node={{ id: "container-1", tag: "div", transition }} />);
    const historyLengthBefore = useEditorStore.getState().past.length;

    fireEvent.change(screen.getByLabelText("Duration"), { target: { value: "200" } });
    fireEvent.blur(screen.getByLabelText("Duration"));

    expect(useEditorStore.getState().past.length).toBe(historyLengthBefore);
  });
});

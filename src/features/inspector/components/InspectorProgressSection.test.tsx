import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InspectorProgressSection } from "./InspectorProgressSection";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";

const initialState = useEditorStore.getState();

const determinateNode: EditorElementNode = { id: "progress-1", tag: "progress", progressValue: 50, progressMax: 100 };
const indeterminateNode: EditorElementNode = { id: "progress-1", tag: "progress", progressValue: undefined, progressMax: 100 };

function commit(label: string, value: number) {
  const input = screen.getByLabelText(label);
  fireEvent.change(input, { target: { value: String(value) } });
  fireEvent.blur(input);
}

describe("InspectorProgressSection (Checkpoint 1.15.6.12.4)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useEditorStore.setState(initialState, true);
  });

  it("shows Indeterminate off and both Value/Max fields for a determinate node", () => {
    render(<InspectorProgressSection node={determinateNode} />);
    expect(screen.getByRole("switch", { name: "Indeterminate" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByLabelText("Value")).toHaveValue(50);
    expect(screen.getByLabelText("Max")).toHaveValue(100);
  });

  it("shows Indeterminate on and hides the Value field for an indeterminate node", () => {
    render(<InspectorProgressSection node={indeterminateNode} />);
    expect(screen.getByRole("switch", { name: "Indeterminate" })).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByLabelText("Value")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Max")).toBeInTheDocument();
  });

  it("committing a new Value calls setElementProgressValue with the node's id", () => {
    const spy = vi.spyOn(useEditorStore.getState(), "setElementProgressValue");
    render(<InspectorProgressSection node={determinateNode} />);

    commit("Value", 75);

    expect(spy).toHaveBeenCalledWith("progress-1", 75);
  });

  it("committing a new Max calls setElementProgressMax with the node's id", () => {
    const spy = vi.spyOn(useEditorStore.getState(), "setElementProgressMax");
    render(<InspectorProgressSection node={determinateNode} />);

    commit("Max", 50);

    expect(spy).toHaveBeenCalledWith("progress-1", 50);
  });

  it("clicking the Indeterminate toggle calls setElementProgressIndeterminate with the opposite of its current state", () => {
    const spy = vi.spyOn(useEditorStore.getState(), "setElementProgressIndeterminate");
    render(<InspectorProgressSection node={determinateNode} />);

    fireEvent.click(screen.getByRole("switch", { name: "Indeterminate" }));

    expect(spy).toHaveBeenCalledWith("progress-1", true);
  });

  it("clicking Indeterminate OFF on an already-indeterminate node calls the command with false", () => {
    const spy = vi.spyOn(useEditorStore.getState(), "setElementProgressIndeterminate");
    render(<InspectorProgressSection node={indeterminateNode} />);

    fireEvent.click(screen.getByRole("switch", { name: "Indeterminate" }));

    expect(spy).toHaveBeenCalledWith("progress-1", false);
  });
});

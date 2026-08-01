import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { InspectorDisplaySection } from "./InspectorDisplaySection";

const initialState = useEditorStore.getState();

function setupNode(node: Parameters<typeof InspectorDisplaySection>[0]["node"]) {
  useEditorStore.setState((state) => ({
    document: { ...state.document, children: [node] },
  }));
}

function committedNode() {
  return useEditorStore.getState().document.children?.find((c) => c.id === "container-1");
}

/** Several groups share an option label (e.g. "None" appears in Display, Pointer Events, and User Select) — scope every lookup to its own group so getByRole never matches more than one button. */
function optionButton(groupLabel: string, optionLabel: string) {
  return within(screen.getByRole("group", { name: groupLabel })).getByRole("button", { name: optionLabel });
}

describe("InspectorDisplaySection", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("shows every field as unset for a node with no display settings", () => {
    render(<InspectorDisplaySection node={{ id: "container-1", tag: "div" }} />);

    for (const label of ["Display", "Visibility", "Pointer Events", "Cursor", "Overflow X", "Overflow Y", "User Select"]) {
      expect(screen.getByRole("group", { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Reset display settings" })).toBeDisabled();
  });

  it("commits display", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorDisplaySection node={{ id: "container-1", tag: "div" }} />);

    fireEvent.click(optionButton("Display", "None"));

    expect(committedNode()?.display?.display).toBe("none");
  });

  it("commits visibility independently of display", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorDisplaySection node={{ id: "container-1", tag: "div" }} />);

    fireEvent.click(optionButton("Visibility", "Hidden"));

    expect(committedNode()?.display?.visibility).toBe("hidden");
    expect(committedNode()?.display?.display).toBeUndefined();
  });

  it("commits pointer events", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorDisplaySection node={{ id: "container-1", tag: "div" }} />);

    fireEvent.click(optionButton("Pointer Events", "None"));

    expect(committedNode()?.display?.pointerEvents).toBe("none");
  });

  it("commits cursor", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorDisplaySection node={{ id: "container-1", tag: "div" }} />);

    fireEvent.click(optionButton("Cursor", "Grab"));

    expect(committedNode()?.display?.cursor).toBe("grab");
  });

  it("commits overflow X", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorDisplaySection node={{ id: "container-1", tag: "div" }} />);

    fireEvent.click(optionButton("Overflow X", "Hidden"));

    expect(committedNode()?.display?.overflowX).toBe("hidden");
  });

  it("commits overflow Y independently of overflow X", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorDisplaySection node={{ id: "container-1", tag: "div" }} />);

    fireEvent.click(optionButton("Overflow Y", "Auto"));

    expect(committedNode()?.display?.overflowY).toBe("auto");
    expect(committedNode()?.display?.overflowX).toBeUndefined();
  });

  it("commits user select", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorDisplaySection node={{ id: "container-1", tag: "div" }} />);

    fireEvent.click(optionButton("User Select", "All"));

    expect(committedNode()?.display?.userSelect).toBe("all");
  });

  it("resets a single property without affecting the others", () => {
    const display = { display: "none" as const, cursor: "pointer" as const };
    setupNode({ id: "container-1", tag: "div", display });
    render(<InspectorDisplaySection node={{ id: "container-1", tag: "div", display }} />);

    fireEvent.click(screen.getByRole("button", { name: "Reset display" }));

    expect(committedNode()?.display?.display).toBeUndefined();
    expect(committedNode()?.display?.cursor).toBe("pointer");
  });

  it("Reset display settings clears every field at once", () => {
    const display = { display: "none" as const, cursor: "pointer" as const, visibility: "hidden" as const };
    setupNode({ id: "container-1", tag: "div", display });
    render(<InspectorDisplaySection node={{ id: "container-1", tag: "div", display }} />);

    fireEvent.click(screen.getByRole("button", { name: "Reset display settings" }));

    expect(committedNode()?.display).toBeUndefined();
  });

  it("is undoable and redoable through the normal history stack", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorDisplaySection node={{ id: "container-1", tag: "div" }} />);

    fireEvent.click(optionButton("Display", "None"));
    expect(committedNode()?.display?.display).toBe("none");

    useEditorStore.getState().undo();
    expect(committedNode()?.display).toBeUndefined();

    useEditorStore.getState().redo();
    expect(committedNode()?.display?.display).toBe("none");
  });

  it("every enum field is accessibly grouped and labelled", () => {
    render(<InspectorDisplaySection node={{ id: "container-1", tag: "div" }} />);

    for (const label of ["Display", "Visibility", "Pointer Events", "Cursor", "Overflow X", "Overflow Y", "User Select"]) {
      expect(screen.getByRole("group", { name: label })).toBeInTheDocument();
    }
  });
});

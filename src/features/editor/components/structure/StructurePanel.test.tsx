import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { StructurePanel } from "./StructurePanel";

const initialState = useEditorStore.getState();

describe("StructurePanel", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("shows the supporting text and the tree when the document has elements", () => {
    render(<StructurePanel />);

    expect(
      screen.getByText("View and select elements on the canvas."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tree", { name: "Page structure" }),
    ).toBeInTheDocument();
  });

  it("shows the empty state when the document has no elements", () => {
    useEditorStore.setState({
      document: { id: "root", tag: "page", children: [] },
    });

    render(<StructurePanel />);

    expect(screen.getByText("No elements yet")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Add a component from the library and it will appear here.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("tree")).not.toBeInTheDocument();
  });
});

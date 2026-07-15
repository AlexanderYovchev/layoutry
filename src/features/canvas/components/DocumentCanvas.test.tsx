import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { DocumentCanvas } from "./DocumentCanvas";

const initialState = useEditorStore.getState();

describe("DocumentCanvas", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("renders the editor store's document model instead of static placeholder content", () => {
    useEditorStore.setState({
      document: {
        id: "page-root",
        tag: "page",
        children: [
          {
            id: "body-1",
            tag: "body",
            children: [
              { id: "heading-1", tag: "h1", text: "Canvas heading" },
              { id: "button-1", tag: "button", text: "Primary action" },
            ],
          },
        ],
      },
    });

    render(<DocumentCanvas />);

    expect(
      screen.getByRole("heading", { name: "Canvas heading" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Primary action" }),
    ).toBeInTheDocument();
  });

  it("reflects a document update from the store without remounting", () => {
    useEditorStore.setState({
      document: { id: "page-root", tag: "page", children: [] },
    });

    render(<DocumentCanvas />);
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();

    act(() => {
      useEditorStore.setState({
        document: {
          id: "page-root",
          tag: "page",
          children: [{ id: "heading-1", tag: "h1", text: "Added later" }],
        },
      });
    });

    expect(
      screen.getByRole("heading", { name: "Added later" }),
    ).toBeInTheDocument();
  });
});

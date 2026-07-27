import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { InspectorFreeGeometryFields } from "./InspectorFreeGeometryFields";

const initialState = useEditorStore.getState();

describe("InspectorFreeGeometryFields", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("renders nothing when the node has no freeLayout yet", () => {
    const { container } = render(<InspectorFreeGeometryFields node={{ id: "n1", tag: "img" }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the current X/Y/Width/Height values", () => {
    render(
      <InspectorFreeGeometryFields
        node={{ id: "n1", tag: "img", freeLayout: { x: 16, y: 32, width: 100, height: 80 } }}
      />,
    );

    expect(screen.getByLabelText("X")).toHaveValue(16);
    expect(screen.getByLabelText("Y")).toHaveValue(32);
    expect(screen.getByLabelText("Width")).toHaveValue(100);
    expect(screen.getByLabelText("Height")).toHaveValue(80);
  });

  it("commits an edited field through the same setFreeChildGeometry action drag/resize use", () => {
    useEditorStore.setState((state) => ({
      document: {
        ...state.document,
        children: [
          {
            id: "container-1",
            tag: "div",
            layoutMode: "free",
            children: [{ id: "n1", tag: "img", freeLayout: { x: 16, y: 32, width: 100, height: 80 } }],
          },
        ],
      },
    }));

    render(
      <InspectorFreeGeometryFields
        node={{ id: "n1", tag: "img", freeLayout: { x: 16, y: 32, width: 100, height: 80 } }}
      />,
    );

    const xInput = screen.getByLabelText("X");
    fireEvent.change(xInput, { target: { value: "50" } });
    fireEvent.blur(xInput);

    const image = useEditorStore
      .getState()
      .document.children?.find((c) => c.id === "container-1")
      ?.children?.find((c) => c.id === "n1");
    expect(image?.freeLayout).toEqual({ x: 50, y: 32, width: 100, height: 80 });
  });
});

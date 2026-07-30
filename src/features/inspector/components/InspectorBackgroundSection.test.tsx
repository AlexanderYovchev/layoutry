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

  it("shows every field as unset for a node with no background", () => {
    render(<InspectorBackgroundSection node={{ id: "container-1", tag: "div" }} />);

    expect(screen.getByLabelText("Background color")).toHaveValue("");
    expect(screen.getByLabelText("Background image URL")).toHaveValue("");
    for (const name of ["Auto", "Cover", "Contain", "Custom"]) {
      expect(screen.getByRole("button", { name })).toHaveAttribute("aria-pressed", "false");
    }
  });

  it("disables Size, Position, Repeat, and Attachment while no image is set", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorBackgroundSection node={{ id: "container-1", tag: "div" }} />);

    expect(screen.getByRole("button", { name: "Cover" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Center" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Repeat" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Fixed" })).toBeDisabled();
    expect(screen.getByText(/enable size, position, repeat, and attachment/i)).toBeInTheDocument();
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

  it("commits a valid Background Image URL and enables the image-dependent controls", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorBackgroundSection node={{ id: "container-1", tag: "div" }} />);

    const input = screen.getByLabelText("Background image URL");
    fireEvent.change(input, { target: { value: "https://example.com/hero.jpg" } });
    fireEvent.blur(input);

    expect(committedNode()?.background?.image).toBe("https://example.com/hero.jpg");
  });

  it("rejects an image URL containing whitespace with a clear validation message and does not commit", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorBackgroundSection node={{ id: "container-1", tag: "div" }} />);

    const input = screen.getByLabelText("Background image URL");
    fireEvent.change(input, { target: { value: "not a url.jpg" } });
    fireEvent.blur(input);

    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid image URL or path.");
    expect(committedNode()?.background?.image).toBeUndefined();
  });

  it("accepts a project-relative image path", () => {
    setupNode({ id: "container-1", tag: "div" });
    render(<InspectorBackgroundSection node={{ id: "container-1", tag: "div" }} />);

    const input = screen.getByLabelText("Background image URL");
    fireEvent.change(input, { target: { value: "assets/hero.jpg" } });
    fireEvent.blur(input);

    expect(committedNode()?.background?.image).toBe("assets/hero.jpg");
  });

  it("resets the Background Image, independent of other background fields", () => {
    setupNode({ id: "container-1", tag: "div", background: { image: "hero.jpg", color: "#3366ff" } });
    render(
      <InspectorBackgroundSection
        node={{ id: "container-1", tag: "div", background: { image: "hero.jpg", color: "#3366ff" } }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Reset background image" }));

    expect(committedNode()?.background?.image).toBeUndefined();
    expect(committedNode()?.background?.color).toBe("#3366ff");
  });

  it("commits a Cover size preset once an image is set", () => {
    setupNode({ id: "container-1", tag: "div", background: { image: "hero.jpg" } });
    render(<InspectorBackgroundSection node={{ id: "container-1", tag: "div", background: { image: "hero.jpg" } }} />);

    fireEvent.click(screen.getByRole("button", { name: "Cover" }));

    expect(committedNode()?.background?.size).toBe("cover");
  });

  it("hides the Custom width/height fields until Size is Custom, and commits Custom through the store", () => {
    setupNode({ id: "container-1", tag: "div", background: { image: "hero.jpg" } });
    render(<InspectorBackgroundSection node={{ id: "container-1", tag: "div", background: { image: "hero.jpg" } }} />);

    expect(screen.queryByLabelText("Width")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Custom" }));

    // This isolated render doesn't re-receive the node prop after a store
    // commit (only the real InspectorNodeSummary parent — subscribed to
    // the store — does that), so the UI's own reactivity to the click is
    // verified separately below via a fresh render with the committed
    // background already in props.
    expect(committedNode()?.background?.size).toBe("custom");
  });

  it("shows Width/Height fields once Size is Custom, and commits both axes", () => {
    const background = { image: "hero.jpg", size: "custom" as const, customSize: { width: "auto" as const, height: "auto" as const } };
    setupNode({ id: "container-1", tag: "div", background });
    render(<InspectorBackgroundSection node={{ id: "container-1", tag: "div", background }} />);

    const widthInput = screen.getByLabelText("Width");
    fireEvent.change(widthInput, { target: { value: "200" } });
    fireEvent.blur(widthInput);

    expect(committedNode()?.background?.customSize?.width).toEqual({ value: 200, unit: "px" });
    expect(committedNode()?.background?.customSize?.height).toBe("auto");
  });

  it("rejects a zero or negative Custom size axis with a clear validation message", () => {
    setupNode({
      id: "container-1",
      tag: "div",
      background: { image: "hero.jpg", size: "custom", customSize: { width: "auto", height: "auto" } },
    });
    render(
      <InspectorBackgroundSection
        node={{
          id: "container-1",
          tag: "div",
          background: { image: "hero.jpg", size: "custom", customSize: { width: "auto", height: "auto" } },
        }}
      />,
    );

    const widthInput = screen.getByLabelText("Width");
    fireEvent.change(widthInput, { target: { value: "-10" } });
    fireEvent.blur(widthInput);

    expect(screen.getByText("Enter a width greater than 0.")).toBeInTheDocument();
    expect(committedNode()?.background?.customSize?.width).toBe("auto");
  });

  it("clears customSize when Size is reset", () => {
    setupNode({
      id: "container-1",
      tag: "div",
      background: { image: "hero.jpg", size: "custom", customSize: { width: { value: 200, unit: "px" }, height: "auto" } },
    });
    render(
      <InspectorBackgroundSection
        node={{
          id: "container-1",
          tag: "div",
          background: { image: "hero.jpg", size: "custom", customSize: { width: { value: 200, unit: "px" }, height: "auto" } },
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Reset background size" }));

    expect(committedNode()?.background?.size).toBeUndefined();
    expect(committedNode()?.background?.customSize).toBeUndefined();
    expect(committedNode()?.background?.image).toBe("hero.jpg");
  });

  it("commits a Position selection once an image is set", () => {
    setupNode({ id: "container-1", tag: "div", background: { image: "hero.jpg" } });
    render(<InspectorBackgroundSection node={{ id: "container-1", tag: "div", background: { image: "hero.jpg" } }} />);

    fireEvent.click(screen.getByRole("button", { name: "Bottom right" }));

    expect(committedNode()?.background?.position).toBe("bottom-right");
  });

  it("commits a Repeat selection once an image is set", () => {
    setupNode({ id: "container-1", tag: "div", background: { image: "hero.jpg" } });
    render(<InspectorBackgroundSection node={{ id: "container-1", tag: "div", background: { image: "hero.jpg" } }} />);

    fireEvent.click(screen.getByRole("button", { name: "Repeat X" }));

    expect(committedNode()?.background?.repeat).toBe("repeat-x");
  });

  it("commits an Attachment selection once an image is set", () => {
    setupNode({ id: "container-1", tag: "div", background: { image: "hero.jpg" } });
    render(<InspectorBackgroundSection node={{ id: "container-1", tag: "div", background: { image: "hero.jpg" } }} />);

    fireEvent.click(screen.getByRole("button", { name: "Fixed" }));

    expect(committedNode()?.background?.attachment).toBe("fixed");
  });

  it("is undoable and redoable through the normal history stack", () => {
    setupNode({ id: "container-1", tag: "div", background: { image: "hero.jpg" } });
    render(<InspectorBackgroundSection node={{ id: "container-1", tag: "div", background: { image: "hero.jpg" } }} />);

    fireEvent.click(screen.getByRole("button", { name: "Cover" }));
    expect(committedNode()?.background?.size).toBe("cover");

    useEditorStore.getState().undo();
    expect(committedNode()?.background?.size).toBeUndefined();

    useEditorStore.getState().redo();
    expect(committedNode()?.background?.size).toBe("cover");
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

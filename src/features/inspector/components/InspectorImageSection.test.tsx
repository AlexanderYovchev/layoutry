import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InspectorImageSection } from "./InspectorImageSection";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";

const initialState = useEditorStore.getState();

const baseNode: EditorElementNode = { id: "image-1", tag: "img" };

describe("InspectorImageSection (Checkpoint 1.15.6.10.1)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useEditorStore.setState(initialState, true);
  });

  it("shows the current Source URL", () => {
    render(<InspectorImageSection node={{ ...baseNode, src: "https://example.com/image.jpg" }} />);
    expect(screen.getByLabelText("Source URL")).toHaveValue("https://example.com/image.jpg");
  });

  it("shows an empty field for a node with no src yet", () => {
    render(<InspectorImageSection node={baseNode} />);
    expect(screen.getByLabelText("Source URL")).toHaveValue("");
  });

  it("committing a valid Source URL on blur calls setElementSrc", () => {
    const spy = vi.spyOn(useEditorStore.getState(), "setElementSrc");
    render(<InspectorImageSection node={baseNode} />);

    const input = screen.getByLabelText("Source URL");
    fireEvent.change(input, { target: { value: "https://example.com/image.jpg" } });
    fireEvent.blur(input);

    expect(spy).toHaveBeenCalledWith("image-1", "https://example.com/image.jpg");
  });

  it("committing a valid Source URL on Enter calls setElementSrc", () => {
    const spy = vi.spyOn(useEditorStore.getState(), "setElementSrc");
    render(<InspectorImageSection node={baseNode} />);

    const input = screen.getByLabelText("Source URL");
    fireEvent.change(input, { target: { value: "https://example.com/image.jpg" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(spy).toHaveBeenCalledWith("image-1", "https://example.com/image.jpg");
  });

  it("Escape reverts the draft to the authored value without committing", () => {
    const spy = vi.spyOn(useEditorStore.getState(), "setElementSrc");
    render(<InspectorImageSection node={{ ...baseNode, src: "https://example.com/original.jpg" }} />);

    const input = screen.getByLabelText("Source URL");
    fireEvent.change(input, { target: { value: "https://example.com/temporary.jpg" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(spy).not.toHaveBeenCalled();
    expect(input).toHaveValue("https://example.com/original.jpg");
  });

  it("rejects a javascript: Source URL and shows an error instead of committing", () => {
    const spy = vi.spyOn(useEditorStore.getState(), "setElementSrc");
    render(<InspectorImageSection node={baseNode} />);

    const input = screen.getByLabelText("Source URL");
    fireEvent.change(input, { target: { value: "javascript:alert(1)" } });
    fireEvent.blur(input);

    expect(spy).not.toHaveBeenCalled();
    expect(screen.getByText("Enter a valid image URL.")).toBeInTheDocument();
  });

  it("Reset calls setElementSrc with undefined, clearing the source", () => {
    const spy = vi.spyOn(useEditorStore.getState(), "setElementSrc");
    render(<InspectorImageSection node={{ ...baseNode, src: "https://example.com/image.jpg" }} />);

    fireEvent.click(screen.getByLabelText("Reset source url"));

    expect(spy).toHaveBeenCalledWith("image-1", undefined);
  });

  it("Reset is disabled when no source is authored yet", () => {
    render(<InspectorImageSection node={baseNode} />);
    expect(screen.getByLabelText("Reset source url")).toBeDisabled();
  });

  it("switching selection to a different Image node clears a stale error and shows the new node's own value", () => {
    const spy = vi.spyOn(useEditorStore.getState(), "setElementSrc");
    const { rerender } = render(<InspectorImageSection node={{ ...baseNode, src: "https://example.com/a.jpg" }} />);

    const input = screen.getByLabelText("Source URL");
    fireEvent.change(input, { target: { value: "javascript:alert(1)" } });
    fireEvent.blur(input);
    expect(screen.getByText("Enter a valid image URL.")).toBeInTheDocument();

    rerender(<InspectorImageSection node={{ id: "image-2", tag: "img", src: "https://example.com/b.jpg" }} />);

    expect(screen.queryByText("Enter a valid image URL.")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Source URL")).toHaveValue("https://example.com/b.jpg");
    expect(spy).not.toHaveBeenCalled();
  });
});

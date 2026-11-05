import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InspectorIframeSection } from "./InspectorIframeSection";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";

const initialState = useEditorStore.getState();

const baseNode: EditorElementNode = { id: "iframe-1", tag: "iframe", title: "Embedded content" };

describe("InspectorIframeSection (Checkpoint 1.15)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useEditorStore.setState(initialState, true);
  });

  it("shows the current Source URL and Title", () => {
    render(<InspectorIframeSection node={{ ...baseNode, src: "https://example.com/embed" }} />);
    expect(screen.getByLabelText("Source URL")).toHaveValue("https://example.com/embed");
    expect(screen.getByLabelText("Title")).toHaveValue("Embedded content");
  });

  it("committing a valid Source URL calls setElementSrc", () => {
    const spy = vi.spyOn(useEditorStore.getState(), "setElementSrc");
    render(<InspectorIframeSection node={baseNode} />);

    const input = screen.getByLabelText("Source URL");
    fireEvent.change(input, { target: { value: "https://example.com/embed" } });
    fireEvent.blur(input);

    expect(spy).toHaveBeenCalledWith("iframe-1", "https://example.com/embed");
  });

  it("rejects a javascript: Source URL and shows an error instead of committing", () => {
    const spy = vi.spyOn(useEditorStore.getState(), "setElementSrc");
    render(<InspectorIframeSection node={baseNode} />);

    const input = screen.getByLabelText("Source URL");
    fireEvent.change(input, { target: { value: "javascript:alert(1)" } });
    fireEvent.blur(input);

    expect(spy).not.toHaveBeenCalled();
    expect(screen.getByText("Enter an http or https embed URL.")).toBeInTheDocument();
  });

  it("committing a new Title calls setElementTitle (no URL validation applied)", () => {
    const spy = vi.spyOn(useEditorStore.getState(), "setElementTitle");
    render(<InspectorIframeSection node={baseNode} />);

    const input = screen.getByLabelText("Title");
    fireEvent.change(input, { target: { value: "Product tour" } });
    fireEvent.blur(input);

    expect(spy).toHaveBeenCalledWith("iframe-1", "Product tour");
  });

  it("Reset on Title calls setElementTitle with undefined", () => {
    const spy = vi.spyOn(useEditorStore.getState(), "setElementTitle");
    render(<InspectorIframeSection node={baseNode} />);

    fireEvent.click(screen.getByLabelText("Reset title"));

    expect(spy).toHaveBeenCalledWith("iframe-1", undefined);
  });

  it("BC-02.3 — rejects a data:, blob:, file: or about: Source URL, which the Canvas would not frame", () => {
    for (const value of ["data:text/html,<script>alert(1)</script>", "blob:http://localhost:3000/1", "file:///C:/x", "about:blank"]) {
      const spy = vi.spyOn(useEditorStore.getState(), "setElementSrc");
      const { unmount } = render(<InspectorIframeSection node={baseNode} />);
      const input = screen.getByLabelText("Source URL");
      fireEvent.change(input, { target: { value } });
      fireEvent.blur(input);
      expect(spy, value).not.toHaveBeenCalled();
      expect(screen.getByText("Enter an http or https embed URL.")).toBeInTheDocument();
      spy.mockRestore();
      unmount();
    }
  });

  it("BC-02.3 — still accepts a relative Source URL (framed, sandboxed, without same-origin access)", () => {
    const spy = vi.spyOn(useEditorStore.getState(), "setElementSrc");
    render(<InspectorIframeSection node={baseNode} />);
    const input = screen.getByLabelText("Source URL");
    fireEvent.change(input, { target: { value: "/widgets/map.html" } });
    fireEvent.blur(input);
    expect(spy).toHaveBeenCalledWith("iframe-1", "/widgets/map.html");
  });
});

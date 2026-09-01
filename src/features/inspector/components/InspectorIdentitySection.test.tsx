import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InspectorIdentitySection } from "./InspectorIdentitySection";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";

const initialState = useEditorStore.getState();

const baseNode: EditorElementNode = { id: "div-1", tag: "div" };

describe("InspectorIdentitySection (Checkpoint 1.15.1)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useEditorStore.setState(initialState, true);
  });

  it("shows the current ID and Classes", () => {
    render(<InspectorIdentitySection node={{ ...baseNode, htmlId: "hero", className: "hero-section featured" }} />);
    expect(screen.getByLabelText("ID")).toHaveValue("hero");
    expect(screen.getByLabelText("Classes")).toHaveValue("hero-section featured");
  });

  it("committing a new ID on blur calls setElementHtmlId, trimmed", () => {
    const spy = vi.spyOn(useEditorStore.getState(), "setElementHtmlId");
    render(<InspectorIdentitySection node={baseNode} />);

    const input = screen.getByLabelText("ID");
    fireEvent.change(input, { target: { value: "  hero  " } });
    fireEvent.blur(input);

    expect(spy).toHaveBeenCalledWith("div-1", "hero");
  });

  it("committing a new Classes value on Enter calls setElementClassName", () => {
    const spy = vi.spyOn(useEditorStore.getState(), "setElementClassName");
    render(<InspectorIdentitySection node={baseNode} />);

    const input = screen.getByLabelText("Classes");
    fireEvent.change(input, { target: { value: "hero-section featured" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(spy).toHaveBeenCalledWith("div-1", "hero-section featured");
    expect(spy).toHaveBeenCalledTimes(1); // no Enter+blur double-commit
  });

  it("blurring an untouched field never commits", () => {
    const spy = vi.spyOn(useEditorStore.getState(), "setElementHtmlId");
    render(<InspectorIdentitySection node={{ ...baseNode, htmlId: "hero" }} />);

    const input = screen.getByLabelText("ID");
    fireEvent.focus(input);
    fireEvent.blur(input);

    expect(spy).not.toHaveBeenCalled();
  });

  it("emptying the ID field and blurring CLEARS it (unlike Media/Link fields, which revert)", () => {
    const spy = vi.spyOn(useEditorStore.getState(), "setElementHtmlId");
    render(<InspectorIdentitySection node={{ ...baseNode, htmlId: "hero" }} />);

    const input = screen.getByLabelText("ID");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);

    expect(spy).toHaveBeenCalledWith("div-1", undefined);
  });

  it("Escape reverts the draft without committing", () => {
    const spy = vi.spyOn(useEditorStore.getState(), "setElementHtmlId");
    render(<InspectorIdentitySection node={{ ...baseNode, htmlId: "hero" }} />);

    const input = screen.getByLabelText("ID");
    fireEvent.change(input, { target: { value: "changed" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(spy).not.toHaveBeenCalled();
    expect(input).toHaveValue("hero");
  });

  it("committing the exact same (trimmed) value pushes no commit", () => {
    const spy = vi.spyOn(useEditorStore.getState(), "setElementHtmlId");
    render(<InspectorIdentitySection node={{ ...baseNode, htmlId: "hero" }} />);

    const input = screen.getByLabelText("ID");
    fireEvent.change(input, { target: { value: "hero" } });
    fireEvent.blur(input);

    expect(spy).not.toHaveBeenCalled();
  });

  it("Reset on ID calls setElementHtmlId with undefined", () => {
    const spy = vi.spyOn(useEditorStore.getState(), "setElementHtmlId");
    render(<InspectorIdentitySection node={{ ...baseNode, htmlId: "hero" }} />);

    fireEvent.click(screen.getByLabelText("Reset id"));

    expect(spy).toHaveBeenCalledWith("div-1", undefined);
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { FigcaptionElement } from "./FigcaptionElement";

const initialState = useEditorStore.getState();

describe("FigcaptionElement (Checkpoint 1.15.6.12.2)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useEditorStore.setState(initialState, true);
  });

  it("renders a genuine <figcaption> with its authored identity", () => {
    const { container } = render(
      <FigcaptionElement node={{ id: "figcaption-1", tag: "figcaption", text: "A mountain at dawn", htmlId: "photo-caption", className: "my-caption" }} parentId="figure-1" parentLayoutMode="flow" parentFlowDisplay="block" />,
    );
    const figcaption = container.querySelector("figcaption")!;
    expect(figcaption).not.toBeNull();
    expect(figcaption).toHaveAttribute("data-node-id", "figcaption-1");
    expect(figcaption).toHaveAttribute("data-node-type", "figcaption");
    expect(figcaption).toHaveAttribute("id", "photo-caption");
    expect(figcaption).toHaveClass("my-caption");
    expect(figcaption.textContent).toBe("A mountain at dawn");
  });

  it("is not editable until double-clicked, reusing the exact generic useEditableText hook", () => {
    render(<FigcaptionElement node={{ id: "figcaption-1", tag: "figcaption", text: "Caption" }} parentId="figure-1" parentLayoutMode="flow" parentFlowDisplay="block" />);
    expect(screen.getByText("Caption")).toHaveAttribute("contenteditable", "false");
  });

  it("double-click enters editing mode while remaining a real <figcaption>", () => {
    render(<FigcaptionElement node={{ id: "figcaption-1", tag: "figcaption", text: "Caption" }} parentId="figure-1" parentLayoutMode="flow" parentFlowDisplay="block" />);
    const figcaption = screen.getByText("Caption");
    fireEvent.doubleClick(figcaption);
    expect(figcaption.tagName).toBe("FIGCAPTION");
    expect(figcaption).toHaveAttribute("contenteditable", "true");
  });

  it("commits edited text through the store's generic setElementText and exits editing on blur", () => {
    render(<FigcaptionElement node={{ id: "figcaption-1", tag: "figcaption", text: "Caption" }} parentId="figure-1" parentLayoutMode="flow" parentFlowDisplay="block" />);
    const spy = vi.spyOn(useEditorStore.getState(), "setElementText");

    const figcaption = screen.getByText("Caption");
    fireEvent.doubleClick(figcaption);
    figcaption.textContent = "Sunset over the bay";
    fireEvent.blur(figcaption);

    expect(spy).toHaveBeenCalledWith("figcaption-1", "Sunset over the bay");
    expect(figcaption).toHaveAttribute("contenteditable", "false");
  });

  it("has no children slot — text-bearing leaf, never a container", () => {
    const { container } = render(
      <FigcaptionElement node={{ id: "figcaption-1", tag: "figcaption", text: "Caption" }} parentId="figure-1" parentLayoutMode="flow" parentFlowDisplay="block" />,
    );
    expect(container.querySelector("figcaption")!.children).toHaveLength(0);
  });
});

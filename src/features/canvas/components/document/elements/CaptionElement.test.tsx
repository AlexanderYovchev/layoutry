import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { CaptionElement } from "./CaptionElement";

const initialState = useEditorStore.getState();

function renderCaption(text = "Quarterly results") {
  return render(
    <table>
      <CaptionElement node={{ id: "caption-1", tag: "caption", text }} parentId="table-1" parentLayoutMode="flow" parentFlowDisplay="block" />
    </table>,
  );
}

describe("CaptionElement (Checkpoint 1.15.6.12.2)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useEditorStore.setState(initialState, true);
  });

  it("renders a genuine <caption>, never wrapped in a div", () => {
    const { container } = renderCaption();
    const caption = container.querySelector("caption")!;
    expect(caption).not.toBeNull();
    expect(caption.tagName).toBe("CAPTION");
    expect(caption).toHaveAttribute("data-node-id", "caption-1");
    expect(caption).toHaveAttribute("data-node-type", "caption");
    expect(caption.textContent).toBe("Quarterly results");
  });

  it("is not editable until double-clicked", () => {
    renderCaption();
    expect(screen.getByText("Quarterly results")).toHaveAttribute("contenteditable", "false");
  });

  it("double-click enters editing mode while remaining a real <caption>", () => {
    renderCaption();
    const caption = screen.getByText("Quarterly results");
    fireEvent.doubleClick(caption);
    expect(caption.tagName).toBe("CAPTION");
    expect(caption).toHaveAttribute("contenteditable", "true");
  });

  it("commits edited text through the store's generic setElementText — reuses useEditableText unchanged, no Caption-specific editor hook", () => {
    renderCaption();
    const spy = vi.spyOn(useEditorStore.getState(), "setElementText");

    const caption = screen.getByText("Quarterly results");
    fireEvent.doubleClick(caption);
    caption.textContent = "Annual summary";
    fireEvent.blur(caption);

    expect(spy).toHaveBeenCalledWith("caption-1", "Annual summary");
    expect(caption).toHaveAttribute("contenteditable", "false");
  });

  it("has no children slot — text-bearing leaf, never a container", () => {
    const { container } = renderCaption();
    expect(container.querySelector("caption")!.children).toHaveLength(0);
  });
});

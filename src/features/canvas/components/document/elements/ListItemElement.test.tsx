import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { ListItemElement } from "./ListItemElement";

const initialState = useEditorStore.getState();

describe("ListItemElement", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useEditorStore.setState(initialState, true);
  });

  it("renders a genuine <li> (Checkpoint 1.6)", () => {
    render(<ListItemElement node={{ id: "li-1", tag: "li", text: "Alpha" }} parentId="list-1" parentLayoutMode="flow" parentFlowDisplay="block" />);

    const item = screen.getByText("Alpha");
    expect(item.tagName).toBe("LI");
  });

  it("is not editable until double-clicked", () => {
    render(<ListItemElement node={{ id: "li-1", tag: "li", text: "Alpha" }} parentId="list-1" parentLayoutMode="flow" parentFlowDisplay="block" />);

    expect(screen.getByText("Alpha")).toHaveAttribute("contenteditable", "false");
  });

  it("double-click enters editing mode while remaining a real <li> (Checkpoint 1.6 — reuses useEditableText, same as Heading/Paragraph/Link/Button)", () => {
    render(<ListItemElement node={{ id: "li-1", tag: "li", text: "Alpha" }} parentId="list-1" parentLayoutMode="flow" parentFlowDisplay="block" />);

    const item = screen.getByText("Alpha");
    fireEvent.doubleClick(item);

    expect(item.tagName).toBe("LI");
    expect(item).toHaveAttribute("contenteditable", "true");
  });

  it("commits the edited text through setElementText on blur and exits editing", () => {
    render(<ListItemElement node={{ id: "li-1", tag: "li", text: "Alpha" }} parentId="list-1" parentLayoutMode="flow" parentFlowDisplay="block" />);
    const spy = vi.spyOn(useEditorStore.getState(), "setElementText");

    const item = screen.getByText("Alpha");
    fireEvent.doubleClick(item);
    item.textContent = "Alpha revised";
    fireEvent.blur(item);

    expect(spy).toHaveBeenCalledWith("li-1", "Alpha revised");
    expect(item).toHaveAttribute("contenteditable", "false");
  });

  it("Escape reverts without committing", () => {
    render(<ListItemElement node={{ id: "li-1", tag: "li", text: "Alpha" }} parentId="list-1" parentLayoutMode="flow" parentFlowDisplay="block" />);
    const spy = vi.spyOn(useEditorStore.getState(), "setElementText");

    const item = screen.getByText("Alpha");
    fireEvent.doubleClick(item);
    item.textContent = "Discarded";
    fireEvent.keyDown(item, { key: "Escape" });

    expect(item.textContent).toBe("Alpha");
    expect(spy).not.toHaveBeenCalled();
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";
import { ParagraphElement } from "./ParagraphElement";
import { generatedStyleOf, installDocumentStyles } from "../../../../../../test/documentStyles";

const initialState = useEditorStore.getState();

describe("ParagraphElement", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useEditorStore.setState(initialState, true);
  });

  it("is not editable until double-clicked (Checkpoint 1.3)", () => {
    render(<ParagraphElement node={{ id: "p-1", tag: "p", text: "Body copy." }} parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block" />);

    expect(screen.getByText("Body copy.")).toHaveAttribute("contenteditable", "false");
  });

  it("double-click enters editing mode while remaining a real <p> (Checkpoint 1.3 — semantic tag preserved)", () => {
    render(<ParagraphElement node={{ id: "p-1", tag: "p", text: "Body copy." }} parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block" />);

    const paragraph = screen.getByText("Body copy.");
    fireEvent.doubleClick(paragraph);

    expect(paragraph.tagName).toBe("P");
    expect(paragraph).toHaveAttribute("contenteditable", "true");
  });

  it("commits edited text through the store and exits editing on blur, using the same shared editing architecture as Heading", () => {
    render(<ParagraphElement node={{ id: "p-1", tag: "p", text: "Body copy." }} parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block" />);
    const spy = vi.spyOn(useEditorStore.getState(), "setElementText");

    const paragraph = screen.getByText("Body copy.");
    fireEvent.doubleClick(paragraph);
    paragraph.textContent = "New paragraph text";
    fireEvent.blur(paragraph);

    expect(spy).toHaveBeenCalledWith("p-1", "New paragraph text");
    expect(paragraph).toHaveAttribute("contenteditable", "false");
  });

  it("uses the prose reading-measure default when not resized", () => {
    const node = { id: "p-1", tag: "p", text: "Body copy." };
    render(<ParagraphElement node={node} parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block" />);
    installDocumentStyles(node);

    const paragraph = screen.getByText("Body copy.");
    expect(getComputedStyle(paragraph).maxWidth).toBe("65ch");
    expect(generatedStyleOf(paragraph).width).toBe("");
  });

  it("drops the prose max-width and applies the explicit size once resized — parent-dependent width still wins via maxWidth: 100%", () => {
    const node: EditorElementNode = {
      id: "p-1",
      tag: "p",
      text: "Body copy.",
      dimensions: { preferredWidth: 800, preferredHeight: 120, offsetX: 0, offsetY: 0 },
    };
    render(<ParagraphElement node={node} parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block" />);
    installDocumentStyles(node);

    const paragraph = screen.getByText("Body copy.");
    expect(getComputedStyle(paragraph).width).toBe("800px");
    expect(getComputedStyle(paragraph).maxWidth).toBe("100%");
    expect(getComputedStyle(paragraph).overflow).toBe("hidden");
  });

  it("defers to an explicit overflow value instead of the legacy resize-clip default (Checkpoint 5.4)", () => {
    const node: EditorElementNode = {
      id: "p-1",
      tag: "p",
      text: "Body copy.",
      dimensions: { preferredWidth: 800, preferredHeight: 120, offsetX: 0, offsetY: 0 },
      display: { overflowY: "auto" },
    };
    render(<ParagraphElement node={node} parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block" />);
    installDocumentStyles(node);

    const paragraph = screen.getByText("Body copy.");
    expect(generatedStyleOf(paragraph).overflow).toBe("");
    expect(getComputedStyle(paragraph).overflowY).toBe("auto");
  });
});

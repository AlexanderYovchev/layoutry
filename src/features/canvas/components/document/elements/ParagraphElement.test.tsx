import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { ParagraphElement } from "./ParagraphElement";

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
    render(<ParagraphElement node={{ id: "p-1", tag: "p", text: "Body copy." }} parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block" />);

    const paragraph = screen.getByText("Body copy.");
    expect(paragraph.className).toContain("max-w-prose");
    expect(paragraph.style.width).toBe("");
  });

  it("drops the prose max-width and applies the explicit size once resized — parent-dependent width still wins via maxWidth: 100%", () => {
    render(
      <ParagraphElement
        node={{
          id: "p-1",
          tag: "p",
          text: "Body copy.",
          dimensions: { preferredWidth: 800, preferredHeight: 120, offsetX: 0, offsetY: 0 },
        }}
        parentId="section-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );

    const paragraph = screen.getByText("Body copy.");
    expect(paragraph.className).not.toContain("max-w-prose");
    expect(paragraph.style.width).toBe("800px");
    expect(paragraph.style.maxWidth).toBe("100%");
    expect(paragraph.style.overflow).toBe("hidden");
  });

  it("defers to an explicit overflow value instead of the legacy resize-clip default (Checkpoint 5.4)", () => {
    render(
      <ParagraphElement
        node={{
          id: "p-1",
          tag: "p",
          text: "Body copy.",
          dimensions: { preferredWidth: 800, preferredHeight: 120, offsetX: 0, offsetY: 0 },
          display: { overflowY: "auto" },
        }}
        parentId="section-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );

    const paragraph = screen.getByText("Body copy.");
    expect(paragraph.style.overflow).toBe("");
    expect(paragraph.style.overflowY).toBe("auto");
  });
});

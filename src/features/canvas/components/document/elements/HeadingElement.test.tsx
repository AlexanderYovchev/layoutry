import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { HeadingElement } from "./HeadingElement";

const initialState = useEditorStore.getState();

describe("HeadingElement", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useEditorStore.setState(initialState, true);
  });

  it("is not editable until double-clicked (Checkpoint 1.3)", () => {
    render(<HeadingElement node={{ id: "heading-1", tag: "h1", text: "Title" }} parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block" />);

    expect(screen.getByRole("heading", { name: "Title" })).toHaveAttribute("contenteditable", "false");
  });

  it("double-click enters editing mode while remaining a real <h1> (Checkpoint 1.3 — semantic tag preserved)", () => {
    render(<HeadingElement node={{ id: "heading-1", tag: "h1", text: "Title" }} parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block" />);

    const heading = screen.getByRole("heading", { name: "Title" });
    fireEvent.doubleClick(heading);

    expect(heading.tagName).toBe("H1");
    expect(heading).toHaveAttribute("contenteditable", "true");
  });

  it("preserves an h1-h6 level while editing, not just the h2 fallback", () => {
    render(<HeadingElement node={{ id: "heading-1", tag: "h3", text: "Subtitle" }} parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block" />);

    const heading = screen.getByRole("heading", { level: 3, name: "Subtitle" });
    fireEvent.doubleClick(heading);

    expect(heading.tagName).toBe("H3");
  });

  it("commits edited text through the store and exits editing on blur", () => {
    render(<HeadingElement node={{ id: "heading-1", tag: "h1", text: "Title" }} parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block" />);
    const spy = vi.spyOn(useEditorStore.getState(), "setElementText");

    const heading = screen.getByRole("heading", { name: "Title" });
    fireEvent.doubleClick(heading);
    heading.textContent = "New heading text";
    fireEvent.blur(heading);

    expect(spy).toHaveBeenCalledWith("heading-1", "New heading text");
    expect(heading).toHaveAttribute("contenteditable", "false");
  });

  it("renders its text content with no inline size when not resized", () => {
    render(<HeadingElement node={{ id: "heading-1", tag: "h1", text: "Title" }} parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block" />);

    const heading = screen.getByText("Title");
    expect(heading.style.width).toBe("");
    expect(heading.style.overflow).toBe("");
  });

  it("applies the preferred width/height and clips overflow once resized — universal resize, Checkpoint 3.4.3", () => {
    render(
      <HeadingElement
        node={{
          id: "heading-1",
          tag: "h1",
          text: "Title",
          dimensions: { preferredWidth: 400, preferredHeight: 60, offsetX: 0, offsetY: 0 },
        }}
        parentId="section-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );

    const heading = screen.getByText("Title");
    expect(heading.style.width).toBe("400px");
    expect(heading.style.height).toBe("60px");
    expect(heading.style.maxWidth).toBe("100%");
    expect(heading.style.maxHeight).toBe("100%");
    expect(heading.style.overflow).toBe("hidden");
  });

  it("an explicit CSS min-width survives being a Flex child (Checkpoint 5.7 fix — resolveFlexOrGridChildStyle's own containment default of min-width:0 must not silently override a real user constraint)", () => {
    render(
      <HeadingElement
        node={{ id: "heading-1", tag: "h1", text: "Title", sizeConstraints: { minWidth: 250 } }}
        parentId="section-1"
        parentLayoutMode="flow"
        parentFlowDisplay="flex"
      />,
    );

    const heading = screen.getByText("Title");
    expect(heading.style.minWidth).toBe("250px");
  });

  it("still defaults to min-width: 0 as a Flex child when no explicit constraint is set (the pre-existing shrink-past-content-size containment guarantee)", () => {
    render(
      <HeadingElement
        node={{ id: "heading-1", tag: "h1", text: "Title" }}
        parentId="section-1"
        parentLayoutMode="flow"
        parentFlowDisplay="flex"
      />,
    );

    const heading = screen.getByText("Title");
    expect(heading.style.minWidth).toBe("0px");
  });

  it("defers to an explicit overflow value instead of the legacy resize-clip default (Checkpoint 5.4)", () => {
    render(
      <HeadingElement
        node={{
          id: "heading-1",
          tag: "h1",
          text: "Title",
          dimensions: { preferredWidth: 400, preferredHeight: 60, offsetX: 0, offsetY: 0 },
          display: { overflow: "visible" },
        }}
        parentId="section-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );

    const heading = screen.getByText("Title");
    expect(heading.style.overflow).toBe("visible");
  });
});

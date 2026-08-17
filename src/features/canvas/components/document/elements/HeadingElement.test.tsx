import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HeadingElement } from "./HeadingElement";

describe("HeadingElement", () => {
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

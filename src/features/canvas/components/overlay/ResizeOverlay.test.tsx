import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ResizeOverlay } from "./ResizeOverlay";

const rect = { top: 0, left: 0, width: 200, height: 100 };
const canvasRootRef = { current: document.createElement("div") };

describe("ResizeOverlay", () => {
  it("renders resize handles for a resizable node (container)", () => {
    render(
      <ResizeOverlay node={{ id: "section-1", tag: "section" }} rect={rect} canvasRootRef={canvasRootRef} />,
    );

    expect(document.querySelector('[data-resize-handle="e"]')).toBeInTheDocument();
  });

  it("renders resize handles for a resizable node (image)", () => {
    render(
      <ResizeOverlay node={{ id: "image-1", tag: "img" }} rect={rect} canvasRootRef={canvasRootRef} />,
    );

    expect(document.querySelector('[data-resize-handle="e"]')).toBeInTheDocument();
  });

  it("renders nothing for an unsupported element type", () => {
    const { container } = render(
      <ResizeOverlay node={{ id: "heading-1", tag: "h1" }} rect={rect} canvasRootRef={canvasRootRef} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for the document root", () => {
    const { container } = render(
      <ResizeOverlay node={{ id: "page-root", tag: "page" }} rect={rect} canvasRootRef={canvasRootRef} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("passes the node's current offsetX/offsetY through to the handles' start snapshot", () => {
    // Indirectly verified via a real drag in ResizeHandles.test.tsx; here
    // we just confirm a node with existing dimensions still renders handles.
    render(
      <ResizeOverlay
        node={{ id: "section-1", tag: "section", dimensions: { width: 300, height: 150, offsetX: -40, offsetY: 0 } }}
        rect={rect}
        canvasRootRef={canvasRootRef}
      />,
    );

    expect(document.querySelectorAll("[data-resize-handle]")).toHaveLength(8);
  });
});

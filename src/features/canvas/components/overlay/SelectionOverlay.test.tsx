import { render } from "@testing-library/react";
import { useRef, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { SelectionOverlay } from "./SelectionOverlay";
import type { EditorElementNode } from "@/features/editor/types/document";

function Harness({ node, children }: { node: EditorElementNode; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref}>
      {children}
      <SelectionOverlay canvasRootRef={ref} node={node} />
    </div>
  );
}

describe("SelectionOverlay", () => {
  it("shows resize handles for a selected resizable node", () => {
    render(
      <Harness node={{ id: "section-1", tag: "section" }}>
        <div data-node-id="section-1" />
      </Harness>,
    );

    expect(document.querySelector('[data-resize-handle="e"]')).toBeInTheDocument();
  });

  it("shows resize handles for a selected text element (heading) — universal resize, Checkpoint 3.4.3", () => {
    render(
      <Harness node={{ id: "heading-1", tag: "h1" }}>
        <div data-node-id="heading-1" />
      </Harness>,
    );

    expect(document.querySelector('[data-resize-handle="e"]')).toBeInTheDocument();
  });

  it("does not show resize handles for a selected non-resizable node (the document root)", () => {
    render(
      <Harness node={{ id: "page-root", tag: "page" }}>
        <div data-node-id="page-root" />
      </Harness>,
    );

    expect(document.querySelector('[data-resize-handle="e"]')).not.toBeInTheDocument();
  });

  it("passes parentLayoutMode through to ResizeOverlay (Checkpoint 3.4.4)", () => {
    const ref = { current: document.createElement("div") };
    render(
      <div ref={ref}>
        <div data-node-id="image-1" />
        <SelectionOverlay
          canvasRootRef={ref}
          node={{ id: "image-1", tag: "img", freeLayout: { x: 16, y: 16, width: 100, height: 80 } }}
          parentLayoutMode="free"
        />
      </div>,
    );

    expect(document.querySelectorAll("[data-resize-handle]")).toHaveLength(8);
  });

  it("Checkpoint 1.15.2: hides resize handles when showHandles is false (multi-selection)", () => {
    render(
      <div ref={{ current: document.createElement("div") }}>
        <div data-node-id="section-1" />
      </div>,
    );
    const ref = { current: document.createElement("div") };
    render(
      <div ref={ref}>
        <div data-node-id="section-1" />
        <SelectionOverlay canvasRootRef={ref} node={{ id: "section-1", tag: "section" }} showHandles={false} />
      </div>,
    );
    expect(document.querySelector('[data-resize-handle="e"]')).not.toBeInTheDocument();
  });

  it("Checkpoint 1.15.2: still shows resize handles by default (showHandles defaults true — single-selection unaffected)", () => {
    const ref = { current: document.createElement("div") };
    render(
      <div ref={ref}>
        <div data-node-id="section-1" />
        <SelectionOverlay canvasRootRef={ref} node={{ id: "section-1", tag: "section" }} />
      </div>,
    );
    expect(document.querySelector('[data-resize-handle="e"]')).toBeInTheDocument();
  });

  it("Checkpoint 1.15.2: omits the floating label for a non-primary selected node", () => {
    const ref = { current: document.createElement("div") };
    const { container } = render(
      <div ref={ref}>
        <div data-node-id="section-1" />
        <SelectionOverlay canvasRootRef={ref} node={{ id: "section-1", tag: "section" }} isPrimary={false} showHandles={false} />
      </div>,
    );
    expect(container.querySelector('[data-canvas-overlay="selection"] span')).not.toBeInTheDocument();
  });

  it("Checkpoint 1.15.2: shows the label by default (isPrimary defaults true — single-selection unaffected)", () => {
    const ref = { current: document.createElement("div") };
    const { container } = render(
      <div ref={ref}>
        <div data-node-id="section-1" />
        <SelectionOverlay canvasRootRef={ref} node={{ id: "section-1", tag: "section" }} />
      </div>,
    );
    expect(container.querySelector('[data-canvas-overlay="selection"] span')).toBeInTheDocument();
  });
});

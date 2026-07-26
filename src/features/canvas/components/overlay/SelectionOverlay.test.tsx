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
});

import { render } from "@testing-library/react";
import { useRef, type ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { CanvasOverlay } from "./CanvasOverlay";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";

const initialState = useEditorStore.getState();

function Harness({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref}>
      {children}
      <CanvasOverlay canvasRootRef={ref} hoveredNodeId={null} />
    </div>
  );
}

describe("CanvasOverlay — resize handles under Parent Style Protection (Checkpoint 1.15.3, section 28)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("shows resize handles for an ordinary single selection (unaffected baseline)", () => {
    useEditorStore.setState((state) => ({ document: { ...state.document, children: [{ id: "p1", tag: "p" }] } }));
    useEditorStore.getState().selectOnly("p1");

    render(
      <Harness>
        <div data-node-id="p1" />
      </Harness>,
    );

    expect(document.querySelector('[data-resize-handle="e"]')).toBeInTheDocument();
  });

  it("hides resize handles entirely for a single selection that is style-protected", () => {
    useEditorStore.setState((state) => ({
      document: { ...state.document, children: [{ id: "hero", tag: "div", lockChildStyles: true, children: [{ id: "p1", tag: "p" }] }] },
    }));
    useEditorStore.getState().selectOnly("p1");

    render(
      <Harness>
        <div data-node-id="hero">
          <div data-node-id="p1" />
        </div>
      </Harness>,
    );

    expect(document.querySelector('[data-resize-handle="e"]')).not.toBeInTheDocument();
  });

  it("the lock owner's OWN selection still shows resize handles (section 8)", () => {
    useEditorStore.setState((state) => ({
      document: { ...state.document, children: [{ id: "hero", tag: "div", lockChildStyles: true }] },
    }));
    useEditorStore.getState().selectOnly("hero");

    render(
      <Harness>
        <div data-node-id="hero" />
      </Harness>,
    );

    expect(document.querySelector('[data-resize-handle="e"]')).toBeInTheDocument();
  });
});

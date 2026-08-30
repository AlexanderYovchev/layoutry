import { render } from "@testing-library/react";
import { useRef, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { FormGuideOverlay } from "./FormGuideOverlay";
import type { EditorElementNode } from "@/features/editor/types/document";

const initialState = useEditorStore.getState();

function setDocument(children: EditorElementNode[]) {
  useEditorStore.setState((state) => ({
    document: { ...state.document, children },
  }));
}

function Harness({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref}>
      {children}
      <FormGuideOverlay canvasRootRef={ref} />
    </div>
  );
}

describe("FormGuideOverlay", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useEditorStore.setState(initialState, true);
  });

  it("renders a Form badge for a form node on the canvas", () => {
    setDocument([{ id: "form-1", tag: "form", children: [] }]);

    render(
      <Harness>
        <div data-node-id="form-1" />
      </Harness>,
    );

    const guide = document.querySelector('[data-canvas-overlay="form-guide"]');
    expect(guide).toBeInTheDocument();
    expect(guide).toHaveTextContent("Form");
  });

  it("does not render a guide for a non-form container", () => {
    setDocument([{ id: "div-1", tag: "div", children: [] }]);

    render(
      <Harness>
        <div data-node-id="div-1" />
      </Harness>,
    );

    expect(document.querySelector('[data-canvas-overlay="form-guide"]')).not.toBeInTheDocument();
  });

  it("shows the empty-state hint for an empty Form large enough to fit it", () => {
    setDocument([{ id: "form-1", tag: "form", children: [] }]);

    // Stubbed globally, before mount, so the hook's very first on-mount
    // measurement (inside a useEffect) already sees a large enough box —
    // stubbing a specific element only takes effect after it exists,
    // which is already too late for that first measurement.
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      right: 200,
      bottom: 150,
      width: 200,
      height: 150,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    render(
      <Harness>
        <div data-node-id="form-1" />
      </Harness>,
    );

    expect(document.body.textContent).toContain("Drop form controls here");
  });

  it("does not show the empty-state hint for a Form with children", () => {
    setDocument([
      {
        id: "form-1",
        tag: "form",
        children: [{ id: "input-1", tag: "input", inputType: "text" }],
      },
    ]);

    render(
      <Harness>
        <div data-node-id="form-1">
          <div data-node-id="input-1" />
        </div>
      </Harness>,
    );

    expect(document.body.textContent).not.toContain("Drop form controls here");
  });

  it("renders one guide per Form, including nested Forms", () => {
    setDocument([
      { id: "form-1", tag: "form", children: [] },
      { id: "section-1", tag: "section", children: [{ id: "form-2", tag: "form", children: [] }] },
    ]);

    render(
      <Harness>
        <div data-node-id="form-1" />
        <div data-node-id="section-1">
          <div data-node-id="form-2" />
        </div>
      </Harness>,
    );

    expect(document.querySelectorAll('[data-canvas-overlay="form-guide"]')).toHaveLength(2);
  });

  it("renders nothing for a document with no Forms", () => {
    setDocument([{ id: "div-1", tag: "div", children: [] }]);

    render(
      <Harness>
        <div data-node-id="div-1" />
      </Harness>,
    );

    expect(document.querySelector('[data-canvas-overlay="form-guide"]')).not.toBeInTheDocument();
  });
});

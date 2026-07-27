import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { InspectorLayoutSection } from "./InspectorLayoutSection";

const initialState = useEditorStore.getState();

describe("InspectorLayoutSection", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
    document.body.innerHTML = "";
  });

  it("shows Flow as the active layout mode by default", () => {
    render(<InspectorLayoutSection node={{ id: "section-1", tag: "section" }} />);

    expect(screen.getByRole("button", { name: "Flow" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Free" })).toHaveAttribute("aria-pressed", "false");
  });

  it("does not show the Resize contents row in Flow mode", () => {
    render(<InspectorLayoutSection node={{ id: "section-1", tag: "section" }} />);
    expect(screen.queryByText("Resize contents")).not.toBeInTheDocument();
  });

  it("converts to Free layout when Free is clicked, measuring the real DOM and dispatching one atomic write", () => {
    useEditorStore.setState((state) => ({
      document: {
        ...state.document,
        children: [
          {
            id: "section-1",
            tag: "section",
            children: [{ id: "heading-1", tag: "h1", text: "Title" }],
          },
        ],
      },
    }));

    const sectionEl = document.createElement("div");
    sectionEl.setAttribute("data-node-id", "section-1");
    const headingEl = document.createElement("h1");
    headingEl.setAttribute("data-node-id", "heading-1");
    sectionEl.appendChild(headingEl);
    document.body.appendChild(sectionEl);
    sectionEl.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 400, bottom: 300, width: 400, height: 300, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    headingEl.getBoundingClientRect = () =>
      ({ left: 16, top: 16, right: 256, bottom: 64, width: 240, height: 48, x: 16, y: 16, toJSON: () => ({}) }) as DOMRect;

    render(<InspectorLayoutSection node={{ id: "section-1", tag: "section" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Free" }));

    const section = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(section?.layoutMode).toBe("free");
    expect(section?.children?.find((c) => c.id === "heading-1")?.freeLayout).toBeDefined();
  });

  it("shows and switches the Resize contents policy once in Free mode", () => {
    useEditorStore.setState((state) => ({
      document: {
        ...state.document,
        children: [{ id: "section-1", tag: "section", layoutMode: "free", children: [] }],
      },
    }));

    render(<InspectorLayoutSection node={{ id: "section-1", tag: "section", layoutMode: "free" }} />);
    expect(screen.getByRole("button", { name: "Scale" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Clamp" }));

    const section = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(section?.childResizePolicy).toBe("clamp");
  });

  it("converts back to Flow layout when Flow is clicked while Free", () => {
    useEditorStore.setState((state) => ({
      document: {
        ...state.document,
        children: [
          {
            id: "section-1",
            tag: "section",
            layoutMode: "free",
            children: [{ id: "heading-1", tag: "h1", freeLayout: { x: 16, y: 16, width: 240, height: 48 } }],
          },
        ],
      },
    }));

    render(<InspectorLayoutSection node={{ id: "section-1", tag: "section", layoutMode: "free" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Flow" }));

    const section = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(section?.layoutMode).toBe("flow");
  });
});

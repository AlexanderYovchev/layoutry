import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { InspectorMultiNodeSummary } from "./InspectorMultiNodeSummary";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";

const initialState = useEditorStore.getState();

function setupDocument(children: EditorElementNode[]) {
  useEditorStore.setState((state) => ({ document: { ...state.document, children } }));
}

describe("InspectorMultiNodeSummary — Parent Style Protection (Checkpoint 1.15.3)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("shows no protection notice when nothing in the selection is protected", () => {
    const nodes: EditorElementNode[] = [{ id: "p-1", tag: "p" }, { id: "p-2", tag: "p" }];
    setupDocument(nodes);
    render(<InspectorMultiNodeSummary nodes={nodes} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows a shared-parent notice and disables (but keeps visible) the CSS sections when one target is protected", () => {
    setupDocument([
      { id: "hero", tag: "div", htmlId: "hero", lockChildStyles: true, children: [{ id: "p-1", tag: "p" }, { id: "p-2", tag: "p" }] },
    ]);
    const nodes: EditorElementNode[] = [{ id: "p-1", tag: "p" }, { id: "p-2", tag: "p" }];
    render(<InspectorMultiNodeSummary nodes={nodes} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      'Styles are locked by "hero". Disable "Lock child styles" on the parent to edit this selection.',
    );
    // Typography section stays visible (not hidden).
    expect(screen.getByText("Typography")).toBeInTheDocument();
  });

  it("shows the generic multi-parent notice when protected targets share no single ancestor", () => {
    setupDocument([
      { id: "a", tag: "div", htmlId: "a", lockChildStyles: true, children: [{ id: "child-a", tag: "p" }] },
      { id: "b", tag: "div", htmlId: "b", lockChildStyles: true, children: [{ id: "child-b", tag: "p" }] },
    ]);
    const nodes: EditorElementNode[] = [{ id: "child-a", tag: "p" }, { id: "child-b", tag: "p" }];
    render(<InspectorMultiNodeSummary nodes={nodes} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Some selected elements have locked styles. Unlock their parent containers before applying this change.",
    );
  });

  it("blocks the actual bulk mutation even when a disabled field is force-interacted with (store-level enforcement, not just pointer-events-none)", () => {
    setupDocument([
      { id: "hero", tag: "div", lockChildStyles: true, children: [{ id: "p-1", tag: "p" }, { id: "p-2", tag: "p" }] },
    ]);
    const nodes: EditorElementNode[] = [{ id: "p-1", tag: "p" }, { id: "p-2", tag: "p" }];
    render(<InspectorMultiNodeSummary nodes={nodes} />);

    const weightButton = screen.getAllByRole("button", { name: "Bold" })[0];
    fireEvent.click(weightButton);

    const p1 = useEditorStore.getState().document.children![0].children!.find((c) => c.id === "p-1");
    expect(p1?.typography?.fontWeight).toBeUndefined();
  });
});

import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { InspectorGridChildSection } from "./InspectorGridChildSection";
import type { GridChildSettings } from "@/features/editor/types/flowLayout";

const initialState = useEditorStore.getState();

// Subscribes to the store so each click sees the freshly-committed node —
// mirrors how the real Inspector re-derives `node` from the document on
// every store change (see useSelectedNode).
// Renders nothing once the store resets past the test (afterEach fires
// before this component unmounts) instead of crashing on a stale id.
function ConnectedSection({ id }: { id: string }) {
  const node = useEditorStore((state) => state.document.children?.find((c) => c.id === id));
  if (!node) return null;
  return <InspectorGridChildSection node={node} />;
}

function setup(node: { id: string; tag: string; gridChild?: GridChildSettings }) {
  useEditorStore.setState((state) => ({
    document: { ...state.document, children: [{ ...node, children: [] }] },
  }));
  return render(<ConnectedSection id={node.id} />);
}

describe("InspectorGridChildSection", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("shows the default auto placement and span-1 values when gridChild is unset", () => {
    setup({ id: "heading-1", tag: "h1" });

    const columnStartRow = screen.getByText("Column start").closest("div")!;
    expect(within(columnStartRow).getByRole("button", { name: "Auto" })).toHaveAttribute("aria-pressed", "true");
    const rowStartRow = screen.getByText("Row start").closest("div")!;
    expect(within(rowStartRow).getByRole("button", { name: "Auto" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Column span")).toHaveValue(1);
    expect(screen.getByLabelText("Row span")).toHaveValue(1);
    expect(screen.queryByLabelText("Column start value")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Row start value")).not.toBeInTheDocument();
  });

  it("switching Column start to Fixed reveals a track field defaulting to 1 and commits it", () => {
    // The (unconfigured) parent resolves to the 2-column Grid default, so
    // setGridChildSettings clamps columnStart into [1, 2] — see
    // useEditorStore's "clamps against the resolved default grid" behavior.
    setup({ id: "heading-1", tag: "h1" });

    const columnStartRow = screen.getByText("Column start").closest("div")!;
    fireEvent.click(within(columnStartRow).getByRole("button", { name: "Fixed" }));
    expect(screen.getByLabelText("Column start value")).toHaveValue(1);

    const input = screen.getByLabelText("Column start value");
    fireEvent.change(input, { target: { value: "2" } });
    fireEvent.blur(input);

    const node = useEditorStore.getState().document.children?.find((c) => c.id === "heading-1");
    expect(node?.gridChild?.columnStart).toBe(2);
  });

  it("switching Row start to Fixed reveals a track field defaulting to 1 and commits it", () => {
    setup({ id: "heading-1", tag: "h1" });

    const rowStartRow = screen.getByText("Row start").closest("div")!;
    fireEvent.click(within(rowStartRow).getByRole("button", { name: "Fixed" }));

    const input = screen.getByLabelText("Row start value");
    fireEvent.change(input, { target: { value: "2" } });
    fireEvent.blur(input);

    const node = useEditorStore.getState().document.children?.find((c) => c.id === "heading-1");
    expect(node?.gridChild?.rowStart).toBe(2);
  });

  it("switching Column start back to Auto clears the fixed value and hides the field", () => {
    setup({ id: "heading-1", tag: "h1", gridChild: { columnStart: 3, columnSpan: 1, rowStart: "auto", rowSpan: 1 } });

    const columnStartRow = screen.getByText("Column start").closest("div")!;
    fireEvent.click(within(columnStartRow).getByRole("button", { name: "Auto" }));

    const node = useEditorStore.getState().document.children?.find((c) => c.id === "heading-1");
    expect(node?.gridChild?.columnStart).toBe("auto");
    expect(screen.queryByLabelText("Column start value")).not.toBeInTheDocument();
  });

  it("commits Column span and Row span independently", () => {
    setup({ id: "heading-1", tag: "h1" });

    const columnSpan = screen.getByLabelText("Column span");
    fireEvent.change(columnSpan, { target: { value: "2" } });
    fireEvent.blur(columnSpan);

    const rowSpan = screen.getByLabelText("Row span");
    fireEvent.change(rowSpan, { target: { value: "3" } });
    fireEvent.blur(rowSpan);

    const node = useEditorStore.getState().document.children?.find((c) => c.id === "heading-1");
    expect(node?.gridChild?.columnSpan).toBe(2);
    expect(node?.gridChild?.rowSpan).toBe(3);
  });

  it("re-derives the Fixed/Auto toggles when the selected node changes to a different sibling (regression: selection-change staleness, Checkpoint 3.5.1)", () => {
    // Same component instance, same tree position — a plain useState
    // initializer would leave the toggles stuck showing node A's shape
    // even after node B (with real Fixed placement) becomes selected.
    const { rerender } = render(<InspectorGridChildSection node={{ id: "a", tag: "h1" }} />);

    let columnStartRow = screen.getByText("Column start").closest("div")!;
    expect(within(columnStartRow).getByRole("button", { name: "Auto" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByLabelText("Column start value")).not.toBeInTheDocument();

    rerender(
      <InspectorGridChildSection
        node={{
          id: "b",
          tag: "h1",
          gridChild: { columnStart: 3, columnSpan: 1, rowStart: 2, rowSpan: 1 },
        }}
      />,
    );

    columnStartRow = screen.getByText("Column start").closest("div")!;
    expect(within(columnStartRow).getByRole("button", { name: "Fixed" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Column start value")).toHaveValue(3);
    const rowStartRow = screen.getByText("Row start").closest("div")!;
    expect(within(rowStartRow).getByRole("button", { name: "Fixed" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Row start value")).toHaveValue(2);
  });
});

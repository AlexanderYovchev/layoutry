import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { InspectorFlexChildSection } from "./InspectorFlexChildSection";
import type { FlexChildSettings } from "@/features/editor/types/flowLayout";

const initialState = useEditorStore.getState();

// Subscribes to the store so each click sees the freshly-committed node —
// mirrors how the real Inspector re-derives `node` from the document on
// every store change (see useSelectedNode).
// Renders nothing once the store resets past the test (afterEach fires
// before this component unmounts) instead of crashing on a stale id.
function ConnectedSection({ id }: { id: string }) {
  const node = useEditorStore((state) => state.document.children?.find((c) => c.id === id));
  if (!node) return null;
  return <InspectorFlexChildSection node={node} />;
}

function setup(node: { id: string; tag: string; flexChild?: FlexChildSettings }) {
  useEditorStore.setState((state) => ({
    document: { ...state.document, children: [{ ...node, children: [] }] },
  }));
  return render(<ConnectedSection id={node.id} />);
}

describe("InspectorFlexChildSection", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("shows the default grow/shrink/basis/align-self values when flexChild is unset", () => {
    setup({ id: "heading-1", tag: "h1" });

    expect(screen.getByLabelText("Grow")).toHaveValue(0);
    expect(screen.getByLabelText("Shrink")).toHaveValue(1);
    const basisRow = screen.getByText("Basis").closest("div")!;
    expect(within(basisRow).getByRole("button", { name: "Auto" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByLabelText("Basis (px)")).not.toBeInTheDocument();
  });

  it("commits Grow and Shrink edits via setFlexChildSettings", () => {
    setup({ id: "heading-1", tag: "h1" });

    const grow = screen.getByLabelText("Grow");
    fireEvent.change(grow, { target: { value: "2" } });
    fireEvent.blur(grow);

    const shrink = screen.getByLabelText("Shrink");
    fireEvent.change(shrink, { target: { value: "0" } });
    fireEvent.blur(shrink);

    const node = useEditorStore.getState().document.children?.find((c) => c.id === "heading-1");
    expect(node?.flexChild?.grow).toBe(2);
    expect(node?.flexChild?.shrink).toBe(0);
  });

  it("switching Basis to Fixed reveals a pixel field defaulting to 0 and commits it", () => {
    setup({ id: "heading-1", tag: "h1" });

    fireEvent.click(screen.getByRole("button", { name: "Fixed" }));
    expect(screen.getByLabelText("Basis (px)")).toHaveValue(0);

    const basisInput = screen.getByLabelText("Basis (px)");
    fireEvent.change(basisInput, { target: { value: "120" } });
    fireEvent.blur(basisInput);

    const node = useEditorStore.getState().document.children?.find((c) => c.id === "heading-1");
    expect(node?.flexChild?.basis).toBe(120);
  });

  it("switching Basis back to Auto clears the fixed value and hides the pixel field", () => {
    setup({ id: "heading-1", tag: "h1", flexChild: { grow: 0, shrink: 1, basis: 120, alignSelf: "auto" } });

    const basisRow = screen.getByText("Basis").closest("div")!;
    fireEvent.click(within(basisRow).getByRole("button", { name: "Auto" }));

    const node = useEditorStore.getState().document.children?.find((c) => c.id === "heading-1");
    expect(node?.flexChild?.basis).toBe("auto");
    expect(screen.queryByLabelText("Basis (px)")).not.toBeInTheDocument();
  });

  it("commits Align self via setFlexChildSettings", () => {
    setup({ id: "heading-1", tag: "h1" });

    fireEvent.click(screen.getByRole("button", { name: "Stretch" }));

    const node = useEditorStore.getState().document.children?.find((c) => c.id === "heading-1");
    expect(node?.flexChild?.alignSelf).toBe("stretch");
  });

  it("re-derives the Basis Fixed/Auto toggle when the selected node changes to a different sibling (regression: selection-change staleness, Checkpoint 3.5.1)", () => {
    const { rerender } = render(<InspectorFlexChildSection node={{ id: "a", tag: "h1" }} />);

    let basisRow = screen.getByText("Basis").closest("div")!;
    expect(within(basisRow).getByRole("button", { name: "Auto" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByLabelText("Basis (px)")).not.toBeInTheDocument();

    rerender(
      <InspectorFlexChildSection
        node={{ id: "b", tag: "h1", flexChild: { grow: 0, shrink: 1, basis: 150, alignSelf: "auto" } }}
      />,
    );

    basisRow = screen.getByText("Basis").closest("div")!;
    expect(within(basisRow).getByRole("button", { name: "Fixed" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Basis (px)")).toHaveValue(150);
  });
});

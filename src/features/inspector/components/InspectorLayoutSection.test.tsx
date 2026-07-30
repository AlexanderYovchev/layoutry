import { fireEvent, render, screen, within } from "@testing-library/react";
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

describe("InspectorLayoutSection — Flow display: Block/Flex/Grid (Checkpoint 3.5)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  // Subscribes to the store so each click sees the freshly-committed node,
  // mirroring how the real Inspector re-derives `node` from the document on
  // every store change (see useSelectedNode) — a static node prop would make
  // sequential clicks each compute their patch from the same stale snapshot.
  // Renders nothing once the store resets past the test (afterEach fires
  // before this component unmounts) instead of crashing on a stale id.
  function ConnectedSection({ id }: { id: string }) {
    const node = useEditorStore((state) => state.document.children?.find((c) => c.id === id));
    if (!node) return null;
    return <InspectorLayoutSection node={node} />;
  }

  function setup(node: Parameters<typeof InspectorLayoutSection>[0]["node"]) {
    useEditorStore.setState((state) => ({
      document: { ...state.document, children: [{ ...node, children: node.children ?? [] }] },
    }));
    return render(<ConnectedSection id={node.id} />);
  }

  it("shows Block as the active display by default and no Flex/Grid controls", () => {
    setup({ id: "section-1", tag: "section" });
    expect(screen.getByRole("button", { name: "Block" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("Direction")).not.toBeInTheDocument();
    expect(screen.queryByText("Columns")).not.toBeInTheDocument();
  });

  it("switching Display to Flex reveals Flex controls and dispatches setFlowDisplayMode", () => {
    setup({ id: "section-1", tag: "section" });
    fireEvent.click(screen.getByRole("button", { name: "Flex" }));

    const section = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(section?.flowLayout?.display).toBe("flex");
    expect(screen.getByText("Direction")).toBeInTheDocument();
  });

  it("changing Direction/Wrap/Justify/Align dispatches setFlexContainerSettings", () => {
    setup({ id: "section-1", tag: "section", flowLayout: { display: "flex" } });

    fireEvent.click(screen.getByRole("button", { name: "Column" }));
    fireEvent.click(screen.getByRole("button", { name: "Wrap" }));
    fireEvent.click(screen.getByRole("button", { name: "Space between" }));
    const alignGroup = screen.getByRole("group", { name: "Align items" });
    fireEvent.click(within(alignGroup).getByRole("button", { name: "Center" }));

    const section = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(section?.flowLayout?.flex).toEqual({
      direction: "column",
      wrap: "wrap",
      justifyContent: "space-between",
      alignItems: "center",
      rowGap: 0,
      columnGap: 0,
    });
  });

  it("Flex gap starts linked and writes both row/column gap from one field", () => {
    setup({ id: "section-1", tag: "section", flowLayout: { display: "flex" } });

    const gapInput = screen.getByLabelText("Gap (all)");
    fireEvent.change(gapInput, { target: { value: "24" } });
    fireEvent.blur(gapInput);

    const section = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(section?.flowLayout?.flex?.rowGap).toBe(24);
    expect(section?.flowLayout?.flex?.columnGap).toBe(24);
  });

  it("switching Display to Grid reveals Grid controls and dispatches setFlowDisplayMode", () => {
    setup({ id: "section-1", tag: "section" });
    fireEvent.click(screen.getByRole("button", { name: "Grid" }));

    const section = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(section?.flowLayout?.display).toBe("grid");
    expect(screen.getByText("Columns")).toBeInTheDocument();
  });

  it("changing the Columns preset dispatches setGridContainerSettings", () => {
    setup({ id: "section-1", tag: "section", flowLayout: { display: "grid" } });
    const columnsRow = screen.getByText("Columns").closest("div")!;
    fireEvent.click(within(columnsRow).getByRole("button", { name: "3" }));

    const section = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(section?.flowLayout?.grid?.columns).toBe(3);
  });

  it("changing Rows to a numeric preset (not Auto) dispatches setGridContainerSettings", () => {
    setup({ id: "section-1", tag: "section", flowLayout: { display: "grid" } });
    const rowsRow = screen.getByText("Rows").closest("div")!;
    fireEvent.click(within(rowsRow).getByRole("button", { name: "2" }));

    const section = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(section?.flowLayout?.grid?.rows).toBe(2);
  });

  it("Grid row/column gap fields commit independently", () => {
    setup({ id: "section-1", tag: "section", flowLayout: { display: "grid" } });

    const rowGapInput = screen.getByLabelText("Row gap");
    fireEvent.change(rowGapInput, { target: { value: "32" } });
    fireEvent.blur(rowGapInput);

    const section = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(section?.flowLayout?.grid?.rowGap).toBe(32);
    expect(section?.flowLayout?.grid?.columnGap).toBe(16); // untouched default
  });

  it("re-derives the Flex Gap linked/unlinked toggle when the selected node changes to a different sibling (regression: selection-change staleness, Checkpoint 3.5.1)", () => {
    const { rerender } = render(
      <InspectorLayoutSection node={{ id: "a", tag: "section", flowLayout: { display: "flex" } }} />,
    );

    expect(screen.getByLabelText("Gap (all)")).toBeInTheDocument();

    rerender(
      <InspectorLayoutSection
        node={{
          id: "b",
          tag: "section",
          flowLayout: {
            display: "flex",
            flex: {
              direction: "row",
              wrap: "nowrap",
              justifyContent: "start",
              alignItems: "stretch",
              rowGap: 8,
              columnGap: 24,
            },
          },
        }}
      />,
    );

    // Node b's row/column gaps differ (unlinked) — the linked "Gap (all)"
    // field must not still be shown from node a's linked shape.
    expect(screen.queryByLabelText("Gap (all)")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Row gap")).toHaveValue(8);
    expect(screen.getByLabelText("Column gap")).toHaveValue(24);
  });
});

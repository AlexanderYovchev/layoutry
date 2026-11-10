import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";
import { InspectorBackgroundSection } from "./InspectorBackgroundSection";
import { InspectorFlexChildSection } from "./InspectorFlexChildSection";
import { InspectorGridChildSection } from "./InspectorGridChildSection";
import { InspectorLayoutSection } from "./InspectorLayoutSection";
import { InspectorSizeSection } from "./InspectorSizeSection";
import { InspectorTransformSection } from "./InspectorTransformSection";

/*
 * BC-05.2 — reset behavior through the real sections, store and history:
 * per-field Transform reset, the new Layout / Flex item / Grid item resets,
 * size-constraint isolation, and the edit-session policy (pressing the
 * reset of the property being typed in discards the draft, so the reset
 * is one Undo step).
 */

const initialState = useEditorStore.getState();

function setup(children: EditorElementNode[]) {
  useEditorStore.setState((state) => ({
    document: { ...state.document, children },
    past: [],
    future: [],
  }));
}

function findNode(
  id: string,
  nodes = useEditorStore.getState().document.children ?? [],
): EditorElementNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNode(id, node.children ?? []);
    if (found) return found;
  }
  return undefined;
}

const nodeOf = (id: string) => {
  const node = findNode(id);
  if (!node) throw new Error(`no node ${id}`);
  return node;
};

/** Re-renders with the live node, as InspectorNodeSummary does. */
function Live({
  id,
  render: renderSection,
}: {
  id: string;
  render: (node: EditorElementNode) => ReactElement;
}) {
  const node = useEditorStore((state) =>
    findNode(id, state.document.children ?? []),
  );
  return node ? renderSection(node) : null;
}

const historyLength = () => useEditorStore.getState().past.length;
const undo = () => act(() => useEditorStore.getState().undo());
const redo = () => act(() => useEditorStore.getState().redo());

/** A pointer press on a reset button, as a mouse produces it: pointerdown first (ends edit sessions), then the click. */
function pressReset(name: string) {
  const button = screen.getByRole("button", { name });
  fireEvent.pointerDown(button);
  fireEvent.click(button, { detail: 1 });
}

afterEach(() => {
  useEditorStore.setState(initialState, true);
});

describe("Transform: per-field reset (BC-05.2)", () => {
  const renderTransform = () =>
    render(
      <Live
        id="box"
        render={(node) => <InspectorTransformSection node={node} />}
      />,
    );

  it("resetting Rotate keeps Scale and the translates; Undo restores it, Redo reapplies", () => {
    setup([
      {
        id: "box",
        tag: "div",
        transform: { rotateDeg: 20, scale: 1.2, translateX: 5 },
      },
    ]);
    renderTransform();
    expect(
      screen.getByRole("button", { name: "Reset translate Y" }),
    ).toBeDisabled();

    pressReset("Reset rotate");
    expect(nodeOf("box").transform).toEqual({ scale: 1.2, translateX: 5 });
    expect(historyLength()).toBe(1);
    expect(screen.getByRole("button", { name: "Reset rotate" })).toBeDisabled();

    undo();
    expect(nodeOf("box").transform).toEqual({
      rotateDeg: 20,
      scale: 1.2,
      translateX: 5,
    });
    redo();
    expect(nodeOf("box").transform).toEqual({ scale: 1.2, translateX: 5 });
  });

  it("resetting the last field removes the transform; the whole-transform reset still works", () => {
    setup([{ id: "box", tag: "div", transform: { scale: 2 } }]);
    renderTransform();
    pressReset("Reset scale");
    expect(nodeOf("box").transform).toBeUndefined();

    act(() =>
      useEditorStore
        .getState()
        .setElementTransform("box", { rotateDeg: 10, translateY: 3 }),
    );
    pressReset("Reset transform");
    expect(nodeOf("box").transform).toBeUndefined();
  });
});

describe("Reset while typing in the same property (BC-05.2 edit-session policy)", () => {
  it("numeric: the typed draft is discarded, the reset is one Undo step, Undo returns to the value before the edit", () => {
    setup([
      { id: "box", tag: "div", transform: { rotateDeg: 20, scale: 1.5 } },
    ]);
    render(
      <Live
        id="box"
        render={(node) => <InspectorTransformSection node={node} />}
      />,
    );

    fireEvent.change(screen.getByLabelText("Rotate"), {
      target: { value: "55" },
    });
    expect(nodeOf("box").transform?.rotateDeg).toBe(55); // live preview

    pressReset("Reset rotate");
    expect(nodeOf("box").transform).toEqual({ scale: 1.5 });
    expect(historyLength()).toBe(1);
    // The field shows the reset value, not the stale draft, and a later blur commits nothing.
    expect(screen.getByLabelText("Rotate")).toHaveValue(0);
    fireEvent.blur(screen.getByLabelText("Rotate"));
    expect(nodeOf("box").transform).toEqual({ scale: 1.5 });
    expect(historyLength()).toBe(1);

    undo();
    expect(nodeOf("box").transform).toEqual({ rotateDeg: 20, scale: 1.5 });
    redo();
    expect(nodeOf("box").transform).toEqual({ scale: 1.5 });
  });

  it("numeric: the section-level reset covers its fields the same way", () => {
    setup([{ id: "box", tag: "div", transform: { rotateDeg: 20 } }]);
    render(
      <Live
        id="box"
        render={(node) => <InspectorTransformSection node={node} />}
      />,
    );
    fireEvent.change(screen.getByLabelText("Scale"), {
      target: { value: "3" },
    });
    pressReset("Reset transform");
    expect(nodeOf("box").transform).toBeUndefined();
    expect(historyLength()).toBe(1);
    undo();
    expect(nodeOf("box").transform).toEqual({ rotateDeg: 20 });
  });

  it("a reset of a different property still commits the draft first (moving on keeps the edit)", () => {
    setup([
      { id: "box", tag: "div", transform: { rotateDeg: 20, scale: 1.5 } },
    ]);
    render(
      <Live
        id="box"
        render={(node) => <InspectorTransformSection node={node} />}
      />,
    );
    fireEvent.change(screen.getByLabelText("Rotate"), {
      target: { value: "55" },
    });
    pressReset("Reset scale");
    expect(nodeOf("box").transform).toEqual({ rotateDeg: 55 });
    expect(historyLength()).toBe(2);
  });

  it("an unset property typed into and reset ends unset with no history at all", () => {
    setup([{ id: "box", tag: "div" }]);
    render(
      <Live
        id="box"
        render={(node) => <InspectorTransformSection node={node} />}
      />,
    );
    fireEvent.change(screen.getByLabelText("Rotate"), {
      target: { value: "45" },
    });
    expect(screen.getByRole("button", { name: "Reset rotate" })).toBeEnabled();
    pressReset("Reset rotate");
    expect(nodeOf("box").transform).toBeUndefined();
    expect(historyLength()).toBe(0);
  });

  it("Escape before the reset still restores, then the reset removes: one Undo step", () => {
    setup([{ id: "box", tag: "div", transform: { rotateDeg: 20 } }]);
    render(
      <Live
        id="box"
        render={(node) => <InspectorTransformSection node={node} />}
      />,
    );
    const field = screen.getByLabelText("Rotate");
    field.focus();
    fireEvent.change(field, { target: { value: "70" } });
    fireEvent.keyDown(field, { key: "Escape" });
    expect(nodeOf("box").transform).toEqual({ rotateDeg: 20 });
    pressReset("Reset rotate");
    expect(nodeOf("box").transform).toBeUndefined();
    expect(historyLength()).toBe(1);
  });

  it("color text field: a typed color is discarded and the color reset is one step", () => {
    setup([{ id: "box", tag: "div", background: { color: "#112233" } }]);
    render(
      <Live
        id="box"
        render={(node) => <InspectorBackgroundSection node={node} />}
      />,
    );
    fireEvent.change(
      screen.getByRole("textbox", { name: "Background color" }),
      { target: { value: "#ff0000" } },
    );
    expect(nodeOf("box").background?.color).toBe("#ff0000");
    pressReset("Reset background color");
    expect(nodeOf("box").background).toBeUndefined();
    expect(historyLength()).toBe(1);
    undo();
    expect(nodeOf("box").background?.color).toBe("#112233");
  });

  it("slider exact-value box (Flex gap): the typed gap is discarded and the gap reset is one step", () => {
    setup([
      {
        id: "row",
        tag: "div",
        flowLayout: {
          display: "flex",
          flex: {
            direction: "row",
            wrap: "nowrap",
            justifyContent: "start",
            alignItems: "stretch",
            rowGap: 12,
            columnGap: 12,
          },
        },
      },
    ]);
    render(
      <Live
        id="row"
        render={(node) => <InspectorLayoutSection node={node} />}
      />,
    );
    fireEvent.change(screen.getByLabelText("Gap (all) (exact value)"), {
      target: { value: "40" },
    });
    expect(nodeOf("row").flowLayout?.flex?.rowGap).toBe(40);
    pressReset("Reset gap");
    expect(nodeOf("row").flowLayout?.flex).toMatchObject({
      rowGap: 0,
      columnGap: 0,
      direction: "row",
    });
    expect(historyLength()).toBe(1);
    undo();
    expect(nodeOf("row").flowLayout?.flex).toMatchObject({
      rowGap: 12,
      columnGap: 12,
    });
  });
});

describe("Layout container resets (BC-05.2)", () => {
  const flex = {
    direction: "column",
    wrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    rowGap: 8,
    columnGap: 16,
  } as const;

  it("each Flex setting resets to the model default on its own, leaving the others", () => {
    setup([{ id: "row", tag: "div", flowLayout: { display: "flex", flex } }]);
    render(
      <Live
        id="row"
        render={(node) => <InspectorLayoutSection node={node} />}
      />,
    );

    pressReset("Reset direction");
    expect(nodeOf("row").flowLayout?.flex).toEqual({
      ...flex,
      direction: "row",
    });
    pressReset("Reset wrap");
    pressReset("Reset justify content");
    pressReset("Reset align items");
    expect(nodeOf("row").flowLayout?.flex).toEqual({
      ...flex,
      direction: "row",
      wrap: "nowrap",
      justifyContent: "start",
      alignItems: "stretch",
    });
    expect(nodeOf("row").flowLayout?.display).toBe("flex");
    expect(historyLength()).toBe(4);
    for (const name of [
      "Reset direction",
      "Reset wrap",
      "Reset justify content",
      "Reset align items",
    ])
      expect(screen.getByRole("button", { name })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reset gap" })).toBeEnabled();
  });

  it("unlinked Row gap / Column gap reset independently; Gap resets both", () => {
    setup([{ id: "row", tag: "div", flowLayout: { display: "flex", flex } }]);
    render(
      <Live
        id="row"
        render={(node) => <InspectorLayoutSection node={node} />}
      />,
    );
    pressReset("Reset row gap");
    expect(nodeOf("row").flowLayout?.flex).toMatchObject({
      rowGap: 0,
      columnGap: 16,
    });
    pressReset("Reset gap");
    expect(nodeOf("row").flowLayout?.flex).toMatchObject({
      rowGap: 0,
      columnGap: 0,
    });
  });

  it("Grid columns, rows and gaps reset independently to the model defaults", () => {
    setup([
      {
        id: "grid",
        tag: "div",
        flowLayout: {
          display: "grid",
          grid: { columns: 4, rows: 3, rowGap: 4, columnGap: 30 },
        },
      },
    ]);
    render(
      <Live
        id="grid"
        render={(node) => <InspectorLayoutSection node={node} />}
      />,
    );
    pressReset("Reset columns");
    expect(nodeOf("grid").flowLayout?.grid).toEqual({
      columns: 2,
      rows: 3,
      rowGap: 4,
      columnGap: 30,
    });
    pressReset("Reset rows");
    pressReset("Reset column gap");
    expect(nodeOf("grid").flowLayout?.grid).toEqual({
      columns: 2,
      rows: "auto",
      rowGap: 4,
      columnGap: 16,
    });
    expect(screen.getByRole("button", { name: "Reset row gap" })).toBeEnabled();
  });

  it("structural settings (Layout mode, Display) have no reset", () => {
    setup([{ id: "row", tag: "div", flowLayout: { display: "flex", flex } }]);
    render(
      <Live
        id="row"
        render={(node) => <InspectorLayoutSection node={node} />}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /^Reset (display|layout mode)$/i }),
    ).not.toBeInTheDocument();
  });
});

describe("Flex item and Grid item resets (BC-05.2)", () => {
  function renderFlexChild(child: EditorElementNode) {
    setup([
      {
        id: "parent",
        tag: "div",
        flowLayout: { display: "flex" },
        children: [child],
      },
    ]);
    return render(
      <Live
        id={child.id}
        render={(node) => <InspectorFlexChildSection node={node} />}
      />,
    );
  }

  it("each Flex item field resets on its own; the record is removed once nothing differs from the defaults", () => {
    renderFlexChild({
      id: "item",
      tag: "div",
      flexChild: { grow: 1, shrink: 0, basis: 120, alignSelf: "center" },
    });
    pressReset("Reset grow");
    expect(nodeOf("item").flexChild).toEqual({
      grow: 0,
      shrink: 0,
      basis: 120,
      alignSelf: "center",
    });
    pressReset("Reset basis");
    expect(nodeOf("item").flexChild?.basis).toBe("auto");
    expect(screen.queryByLabelText("Basis (px)")).not.toBeInTheDocument();
    pressReset("Reset align self");
    pressReset("Reset shrink");
    expect(nodeOf("item")).not.toHaveProperty("flexChild");
    expect(
      screen.getByRole("button", { name: "Reset flex item" }),
    ).toBeDisabled();
  });

  it("Reset flex item removes the whole record in one Undo step", () => {
    renderFlexChild({
      id: "item",
      tag: "div",
      flexChild: { grow: 2, shrink: 1, basis: "auto", alignSelf: "auto" },
    });
    pressReset("Reset flex item");
    expect(nodeOf("item")).not.toHaveProperty("flexChild");
    expect(historyLength()).toBe(1);
    undo();
    expect(nodeOf("item").flexChild).toEqual({
      grow: 2,
      shrink: 1,
      basis: "auto",
      alignSelf: "auto",
    });
  });

  it("a record holding only default values has nothing to reset per field, but can be removed", () => {
    renderFlexChild({
      id: "item",
      tag: "div",
      flexChild: { grow: 0, shrink: 1, basis: "auto", alignSelf: "auto" },
    });
    for (const name of [
      "Reset grow",
      "Reset shrink",
      "Reset basis",
      "Reset align self",
    ])
      expect(screen.getByRole("button", { name })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Reset flex item" }),
    ).toBeEnabled();
  });

  it("Grid item fields reset independently; Reset grid item removes the record", () => {
    setup([
      {
        id: "grid",
        tag: "div",
        flowLayout: {
          display: "grid",
          grid: { columns: 4, rows: 4, rowGap: 0, columnGap: 0 },
        },
        children: [
          {
            id: "cell",
            tag: "div",
            gridChild: {
              columnStart: 2,
              columnSpan: 2,
              rowStart: 3,
              rowSpan: 2,
            },
          },
        ],
      },
    ]);
    render(
      <Live
        id="cell"
        render={(node) => <InspectorGridChildSection node={node} />}
      />,
    );
    pressReset("Reset column start");
    expect(nodeOf("cell").gridChild).toEqual({
      columnStart: "auto",
      columnSpan: 2,
      rowStart: 3,
      rowSpan: 2,
    });
    expect(
      screen.queryByLabelText("Column start value"),
    ).not.toBeInTheDocument();
    pressReset("Reset row span");
    expect(nodeOf("cell").gridChild).toEqual({
      columnStart: "auto",
      columnSpan: 2,
      rowStart: 3,
      rowSpan: 1,
    });
    pressReset("Reset grid item");
    expect(nodeOf("cell")).not.toHaveProperty("gridChild");
    expect(screen.queryByLabelText("Row start value")).not.toBeInTheDocument();
  });
});

describe("Size constraints stay isolated (BC-05.2)", () => {
  it("resetting one min/max constraint keeps the other three", () => {
    setup([
      {
        id: "box",
        tag: "div",
        sizeConstraints: {
          minWidth: 10,
          maxWidth: 400,
          minHeight: 20,
          maxHeight: 300,
        },
      },
    ]);
    render(
      <Live
        id="box"
        render={(node) => (
          <InspectorSizeSection node={node} isFreeChild={false} />
        )}
      />,
    );
    pressReset("Reset min width");
    expect(nodeOf("box").sizeConstraints).toEqual({
      maxWidth: 400,
      minHeight: 20,
      maxHeight: 300,
    });
    pressReset("Reset max height");
    expect(nodeOf("box").sizeConstraints).toEqual({
      maxWidth: 400,
      minHeight: 20,
    });
    undo();
    expect(nodeOf("box").sizeConstraints).toEqual({
      maxWidth: 400,
      minHeight: 20,
      maxHeight: 300,
    });
  });

  it("width and height share one record, and their reset says so", () => {
    setup([
      {
        id: "box",
        tag: "div",
        dimensions: {
          preferredWidth: 300,
          preferredHeight: 120,
          offsetX: 0,
          offsetY: 0,
        },
        sizeConstraints: { maxWidth: 500 },
      },
    ]);
    render(
      <Live
        id="box"
        render={(node) => (
          <InspectorSizeSection node={node} isFreeChild={false} />
        )}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Reset size" }), {
      detail: 1,
    });
    expect(nodeOf("box")).not.toHaveProperty("dimensions.preferredWidth");
    // Constraints are a separate record and survive.
    expect(nodeOf("box").sizeConstraints).toEqual({ maxWidth: 500 });
  });
});

describe("Size: one combined reset (BC-05.4)", () => {
  const resized = (): EditorElementNode[] => [
    {
      id: "box",
      tag: "div",
      dimensions: {
        preferredWidth: 300,
        preferredHeight: 120,
        offsetX: 0,
        offsetY: 0,
      },
    },
  ];
  const renderSize = () =>
    render(
      <Live
        id="box"
        render={(node) => (
          <InspectorSizeSection node={node} isFreeChild={false} />
        )}
      />,
    );

  it("pressing Reset size while typing in Height discards the draft: one Undo step back to the committed size", () => {
    setup(resized());
    renderSize();
    fireEvent.change(screen.getByLabelText("Height"), {
      target: { value: "333" },
    });
    expect(nodeOf("box").dimensions?.preferredHeight).toBe(333);
    pressReset("Reset size");
    expect(nodeOf("box").dimensions).toBeUndefined();
    expect(historyLength()).toBe(1);
    undo();
    expect(nodeOf("box").dimensions).toEqual({
      preferredWidth: 300,
      preferredHeight: 120,
      offsetX: 0,
      offsetY: 0,
    });
  });

  it("a keyboard Reset size moves focus to the Width field", async () => {
    setup(resized());
    renderSize();
    const button = screen.getByRole("button", { name: "Reset size" });
    button.focus();
    fireEvent.click(button, { detail: 0 });
    await waitFor(() => expect(screen.getByLabelText("Width")).toHaveFocus());
  });
});

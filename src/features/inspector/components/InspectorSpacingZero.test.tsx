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
import { InspectorSpacingSection } from "./InspectorSpacingSection";

/*
 * BC-05.3 — spacing zero-value semantics through the real Spacing section,
 * store and history: an authored 0 is a value, an unset side is not, and
 * Reset removes the authored value (one side, or the whole box).
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

const spacingOf = (id: string) => findNode(id)?.spacing;
const historyLength = () => useEditorStore.getState().past.length;
const undo = () => act(() => useEditorStore.getState().undo());
const redo = () => act(() => useEditorStore.getState().redo());

/**
 * Re-renders with the live node, as InspectorNodeSummary does, next to a
 * stand-in Canvas element for the node, so useRenderedPadding can measure
 * the padding its default presentation gives it (here: inline, the way a
 * button's own 8px / 16px reaches the Canvas through a class).
 */
function Live({
  id,
  renderedPadding,
}: {
  id: string;
  renderedPadding?: [number, number, number, number];
}): ReactElement {
  const node = useEditorStore((state) =>
    findNode(id, state.document.children ?? []),
  );
  const [top, right, bottom, left] = renderedPadding ?? [0, 0, 0, 0];
  const padding = node?.spacing?.padding;
  return (
    <>
      <div data-document-surface="">
        <div
          data-node-id={id}
          style={{
            paddingTop: padding?.top ?? top,
            paddingRight: padding?.right ?? right,
            paddingBottom: padding?.bottom ?? bottom,
            paddingLeft: padding?.left ?? left,
          }}
        />
      </div>
      {node ? <InspectorSpacingSection node={node} /> : null}
    </>
  );
}

/** Types into a field the way a keyboard does: select all, type, Enter. */
function typeAndEnter(field: HTMLElement, value: string) {
  if ((field as HTMLInputElement).value === value)
    fireEvent.input(field, { target: { value } });
  else fireEvent.change(field, { target: { value } });
  fireEvent.keyDown(field, { key: "Enter" });
}

function pressReset(name: string) {
  const button = screen.getByRole("button", { name });
  fireEvent.pointerDown(button);
  fireEvent.click(button, { detail: 1 });
}

/** The side fields of one group (Margin's come first in the section). */
const sideField = (
  side: "Top" | "Right" | "Bottom" | "Left",
  group: "margin" | "padding",
) => {
  const fields = screen.getAllByLabelText(side);
  return fields[group === "margin" ? 0 : fields.length - 1];
};

afterEach(() => {
  useEditorStore.setState(initialState, true);
});

describe("Case A — unset to 0 creates an authored zero", () => {
  it("typing 0 over an unset margin's displayed 0 authors margin 0, and Reset becomes available", () => {
    setup([{ id: "h", tag: "h1", text: "Title" }]);
    render(<Live id="h" />);
    const field = screen.getByLabelText("Margin (all sides)");
    expect(field).toHaveValue(0);
    expect(screen.getByRole("button", { name: "Reset margin" })).toBeDisabled();

    typeAndEnter(field, "0");

    expect(spacingOf("h")).toEqual({
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    expect(screen.getByRole("button", { name: "Reset margin" })).toBeEnabled();
    expect(historyLength()).toBe(1);
  });

  it("an unset button padding shows what it renders (8 / 16), opens unlinked, and authoring Left 0 writes only that side", () => {
    setup([{ id: "b", tag: "button", text: "Go" }]);
    render(<Live id="b" renderedPadding={[8, 16, 8, 16]} />);

    expect(screen.queryByLabelText("Padding (all sides)")).toBeNull();
    expect(sideField("Top", "padding")).toHaveValue(8);
    expect(sideField("Left", "padding")).toHaveValue(16);
    expect(
      screen.getByRole("button", { name: "Reset padding" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Reset padding left" }),
    ).toBeDisabled();

    typeAndEnter(sideField("Left", "padding"), "0");

    expect(spacingOf("b")).toEqual({ padding: { left: 0 } });
    expect(sideField("Left", "padding")).toHaveValue(0);
    expect(sideField("Top", "padding")).toHaveValue(8);
    expect(
      screen.getByRole("button", { name: "Reset padding left" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Reset padding top" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reset padding" })).toBeEnabled();
  });
});

describe("Cases B–E — nonzero to 0, reset, undo, redo", () => {
  it("nonzero → 0 keeps an authored value; reset removes it; Undo brings the 0 back; Redo removes it again", () => {
    setup([
      {
        id: "c",
        tag: "div",
        spacing: { padding: { top: 12, right: 12, bottom: 12, left: 12 } },
        children: [],
      },
    ]);
    render(<Live id="c" />);

    typeAndEnter(screen.getByLabelText("Padding (all sides)"), "0");
    expect(spacingOf("c")).toEqual({
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    expect(screen.getByRole("button", { name: "Reset padding" })).toBeEnabled();

    pressReset("Reset padding");
    // The record stays (it keeps the legacy container padding off); the box is gone.
    expect(spacingOf("c")).toEqual({});
    expect(
      screen.getByRole("button", { name: "Reset padding" }),
    ).toBeDisabled();
    expect(historyLength()).toBe(2);

    undo();
    expect(spacingOf("c")).toEqual({
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    expect(screen.getByRole("button", { name: "Reset padding" })).toBeEnabled();
    redo();
    expect(spacingOf("c")).toEqual({});
    undo();
    undo();
    expect(spacingOf("c")).toEqual({
      padding: { top: 12, right: 12, bottom: 12, left: 12 },
    });
  });

  it("every transition is one history entry: unset → 0 → 8 → 0 → unset → 8 → unset", () => {
    setup([{ id: "p", tag: "p", text: "Body" }]);
    render(<Live id="p" />);
    const margin = () => screen.getByLabelText("Margin (all sides)");

    typeAndEnter(margin(), "0");
    typeAndEnter(margin(), "8");
    typeAndEnter(margin(), "0");
    pressReset("Reset margin");
    typeAndEnter(margin(), "8");
    pressReset("Reset margin");
    expect(historyLength()).toBe(6);
    expect(spacingOf("p")).toEqual({});

    const expected = [
      { margin: { top: 8, right: 8, bottom: 8, left: 8 } },
      {},
      { margin: { top: 0, right: 0, bottom: 0, left: 0 } },
      { margin: { top: 8, right: 8, bottom: 8, left: 8 } },
      { margin: { top: 0, right: 0, bottom: 0, left: 0 } },
      undefined,
    ];
    for (const spacing of expected) {
      undo();
      expect(spacingOf("p")).toEqual(spacing);
    }
  });
});

describe("Case F — one-side reset", () => {
  it("resetting padding left keeps top, right and bottom, including an authored 0", () => {
    setup([
      {
        id: "c",
        tag: "div",
        spacing: { padding: { top: 0, right: 4, bottom: 6, left: 0 } },
        children: [],
      },
    ]);
    render(<Live id="c" />);

    pressReset("Reset padding left");
    expect(spacingOf("c")).toEqual({
      padding: { top: 0, right: 4, bottom: 6 },
    });
    expect(historyLength()).toBe(1);
    undo();
    expect(spacingOf("c")).toEqual({
      padding: { top: 0, right: 4, bottom: 6, left: 0 },
    });
  });

  it("resetting the last authored side removes the box", () => {
    setup([
      {
        id: "c",
        tag: "div",
        spacing: {
          margin: { bottom: 0 },
          padding: { top: 3, right: 3, bottom: 3, left: 4 },
        },
        children: [],
      },
    ]);
    render(<Live id="c" />);
    // Margin bottom 0 with the other sides unset (0) reads as linked 0; unlink to reach the side.
    fireEvent.click(screen.getAllByRole("button", { name: "Linked" })[0]);
    pressReset("Reset margin bottom");
    expect(spacingOf("c")).toEqual({
      padding: { top: 3, right: 3, bottom: 3, left: 4 },
    });
  });
});

describe("live editing", () => {
  it("00 authors 0", () => {
    setup([{ id: "h", tag: "h2", text: "T" }]);
    render(<Live id="h" />);
    typeAndEnter(screen.getByLabelText("Margin (all sides)"), "00");
    expect(spacingOf("h")).toEqual({
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
  });

  it("clearing a field writes nothing and shows the previous value again", () => {
    setup([{ id: "h", tag: "h2", text: "T" }]);
    render(<Live id="h" />);
    const field = screen.getByLabelText("Margin (all sides)");
    typeAndEnter(field, "");
    expect(spacingOf("h")).toBeUndefined();
    expect(historyLength()).toBe(0);
    expect(field).toHaveValue(0);
  });

  it("Escape after typing restores the unset state, with no history entry", () => {
    setup([{ id: "b", tag: "button", text: "Go" }]);
    render(<Live id="b" renderedPadding={[8, 16, 8, 16]} />);
    const left = sideField("Left", "padding");
    fireEvent.change(left, { target: { value: "0" } });
    expect(spacingOf("b")).toEqual({ padding: { left: 0 } }); // live preview
    fireEvent.keyDown(left, { key: "Escape" });
    expect(spacingOf("b")).toBeUndefined();
    expect(historyLength()).toBe(0);
  });

  it("blur commits a typed 0 as one entry", () => {
    setup([{ id: "h", tag: "h3", text: "T" }]);
    render(<Live id="h" />);
    const field = screen.getByLabelText("Margin (all sides)");
    fireEvent.change(field, { target: { value: "5" } });
    fireEvent.change(field, { target: { value: "0" } });
    fireEvent.blur(field);
    expect(spacingOf("h")).toEqual({
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    expect(historyLength()).toBe(1);
  });

  it("a negative margin is clamped to an authored 0 (negative spacing is not supported)", () => {
    setup([{ id: "h", tag: "h3", text: "T" }]);
    render(<Live id="h" />);
    typeAndEnter(screen.getByLabelText("Margin (all sides)"), "-12");
    expect(spacingOf("h")).toEqual({
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
  });

  it("a decimal is kept as typed", () => {
    setup([{ id: "h", tag: "h3", text: "T" }]);
    render(<Live id="h" />);
    typeAndEnter(screen.getByLabelText("Margin (all sides)"), "2.5");
    expect(spacingOf("h")?.margin).toEqual({
      top: 2.5,
      right: 2.5,
      bottom: 2.5,
      left: 2.5,
    });
  });

  it("resetting the side being typed in discards the draft: one Undo step back to the pre-edit value (BC-05.2 policy)", () => {
    setup([
      {
        id: "c",
        tag: "div",
        spacing: { padding: { top: 1, right: 2, bottom: 3, left: 0 } },
        children: [],
      },
    ]);
    render(<Live id="c" />);
    fireEvent.change(sideField("Left", "padding"), { target: { value: "7" } });
    expect(spacingOf("c")?.padding?.left).toBe(7);

    pressReset("Reset padding left");
    expect(spacingOf("c")).toEqual({
      padding: { top: 1, right: 2, bottom: 3 },
    });
    expect(historyLength()).toBe(1);
    fireEvent.blur(sideField("Left", "padding"));
    expect(historyLength()).toBe(1);
    undo();
    expect(spacingOf("c")).toEqual({
      padding: { top: 1, right: 2, bottom: 3, left: 0 },
    });
  });

  it("resetting a different side keeps the typed edit", () => {
    setup([
      {
        id: "c",
        tag: "div",
        spacing: { padding: { top: 1, right: 2, bottom: 3, left: 0 } },
        children: [],
      },
    ]);
    render(<Live id="c" />);
    fireEvent.change(sideField("Left", "padding"), { target: { value: "7" } });
    pressReset("Reset padding top");
    expect(spacingOf("c")).toEqual({
      padding: { right: 2, bottom: 3, left: 7 },
    });
  });
});

describe("keyboard", () => {
  it("a keyboard reset of one side moves focus to that side's own field", async () => {
    setup([
      {
        id: "c",
        tag: "div",
        spacing: { padding: { top: 1, right: 2, bottom: 3, left: 0 } },
        children: [],
      },
    ]);
    render(<Live id="c" />);
    const button = screen.getByRole("button", { name: "Reset padding left" });
    button.focus();
    fireEvent.click(button, { detail: 0 });
    await waitFor(() => expect(sideField("Left", "padding")).toHaveFocus());
    expect(spacingOf("c")).toEqual({
      padding: { top: 1, right: 2, bottom: 3 },
    });
  });
});

describe("selection change", () => {
  it("shows each element's own authored and unset sides", () => {
    setup([
      {
        id: "a",
        tag: "div",
        spacing: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
        children: [],
      },
      { id: "b", tag: "button", text: "Go" },
    ]);
    const { rerender } = render(<Live id="a" />);
    expect(screen.getByRole("button", { name: "Reset padding" })).toBeEnabled();
    rerender(<Live id="b" renderedPadding={[8, 16, 8, 16]} />);
    expect(
      screen.getByRole("button", { name: "Reset padding" }),
    ).toBeDisabled();
    expect(sideField("Right", "padding")).toHaveValue(16);
  });
});

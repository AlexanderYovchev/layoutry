import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";
import { InspectorBulkSpacingSection } from "./InspectorBulkSpacingSection";

/*
 * BC-05.4 — multi-selection Spacing shows each element's EFFECTIVE spacing
 * (authored, else what the Canvas renders), "Mixed" when they differ, and
 * keeps authored-vs-unset in the row state; measured values are never
 * written. (BC-05.3 compared authored values only.)
 */

const initialState = useEditorStore.getState();
const store = () => useEditorStore.getState();

type Sides = [number, number, number, number];

function nodeById(id: string): EditorElementNode | undefined {
  return store().document.children?.find((node) => node.id === id);
}

/**
 * The section for the live nodes, next to stand-in Canvas elements whose
 * padding is what each node's default presentation renders (`rendered`),
 * overridden by its authored sides — as the real Canvas does.
 */
function Harness({
  ids,
  rendered,
}: {
  ids: string[];
  rendered: Record<string, Sides>;
}) {
  const children = useEditorStore((state) => state.document.children);
  const nodes = (children ?? []).filter((node) => ids.includes(node.id));
  return (
    <>
      <div data-document-surface="">
        {nodes.map((node) => {
          const [top, right, bottom, left] = rendered[node.id] ?? [0, 0, 0, 0];
          const padding = node.spacing?.padding;
          return (
            <div
              key={node.id}
              data-node-id={node.id}
              style={{
                paddingTop: padding?.top ?? top,
                paddingRight: padding?.right ?? right,
                paddingBottom: padding?.bottom ?? bottom,
                paddingLeft: padding?.left ?? left,
              }}
            />
          );
        })}
      </div>
      <InspectorBulkSpacingSection nodes={nodes} />
    </>
  );
}

function setup(
  children: EditorElementNode[],
  rendered: Record<string, Sides> = {},
) {
  useEditorStore.setState((state) => ({
    document: { ...state.document, children },
    past: [],
    future: [],
  }));
  return render(
    <Harness ids={children.map((node) => node.id)} rendered={rendered} />,
  );
}

const BUTTON: Sides = [8, 16, 8, 16];
const padding = () => screen.getByLabelText("Padding");
const margin = () => screen.getByLabelText("Margin");
const explicitlySet = () => screen.queryAllByText("Explicitly set");

afterEach(() => {
  useEditorStore.setState(initialState, true);
});

describe("multi-selection effective spacing (BC-05.4)", () => {
  it("different computed padding reads Mixed (16 vs 8 on the left)", () => {
    setup(
      [
        { id: "a", tag: "div", children: [] },
        { id: "b", tag: "div", children: [] },
      ],
      { a: [16, 16, 16, 16], b: [8, 8, 8, 8] },
    );
    expect(padding()).toHaveValue(null);
    expect(padding()).toHaveAttribute("placeholder", "Mixed");
  });

  it("equal computed padding reads the shared value, even when only one node authors it", () => {
    setup(
      [
        {
          id: "a",
          tag: "div",
          spacing: { padding: { top: 16, right: 16, bottom: 16, left: 16 } },
          children: [],
        },
        { id: "b", tag: "div", children: [] },
      ],
      { b: [16, 16, 16, 16] },
    );
    expect(padding()).toHaveValue(16);
    // Authored state is kept apart from the shown number: one node authors it.
    expect(explicitlySet()).toHaveLength(1);
  });

  it("two buttons with their own unset 8 / 16 padding read Mixed, not 0", () => {
    setup(
      [
        { id: "a", tag: "button", text: "A" },
        { id: "b", tag: "button", text: "B" },
      ],
      { a: BUTTON, b: BUTTON },
    );
    expect(padding()).toHaveAttribute("placeholder", "Mixed");
  });

  it("an authored 0 next to an unset side that also renders 0 reads 0, and the row still shows something is set", () => {
    setup(
      [
        {
          id: "a",
          tag: "div",
          spacing: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
          children: [],
        },
        { id: "b", tag: "div", spacing: {}, children: [] },
      ],
      { b: [0, 0, 0, 0] },
    );
    expect(padding()).toHaveValue(0);
    expect(explicitlySet()).toHaveLength(1);
  });

  it("an authored 0 next to a button's unset padding reads Mixed", () => {
    setup(
      [
        {
          id: "a",
          tag: "button",
          text: "A",
          spacing: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
        },
        { id: "b", tag: "button", text: "B" },
      ],
      { a: BUTTON, b: BUTTON },
    );
    expect(padding()).toHaveAttribute("placeholder", "Mixed");
  });

  it("nothing authored and everything rendering 0: reads 0 with no set state", () => {
    setup([
      { id: "a", tag: "h2", text: "A" },
      { id: "b", tag: "p", text: "B" },
    ]);
    expect(margin()).toHaveValue(0);
    expect(padding()).toHaveValue(0);
    expect(explicitlySet()).toHaveLength(0);
  });

  it("typing into a Mixed field writes exactly the typed value, one history entry, and never the measured values", () => {
    setup(
      [
        { id: "a", tag: "button", text: "A" },
        { id: "b", tag: "div", children: [] },
      ],
      { a: BUTTON },
    );
    fireEvent.change(padding(), { target: { value: "4" } });
    fireEvent.keyDown(padding(), { key: "Enter" });
    expect(nodeById("a")?.spacing).toEqual({
      padding: { top: 4, right: 4, bottom: 4, left: 4 },
    });
    expect(nodeById("b")?.spacing).toEqual({
      padding: { top: 4, right: 4, bottom: 4, left: 4 },
    });
    expect(store().past).toHaveLength(1);
    expect(padding()).toHaveValue(4);
  });

  it("re-reads when a selected node's spacing changes (no stale value)", () => {
    setup(
      [
        { id: "a", tag: "div", children: [] },
        { id: "b", tag: "div", children: [] },
      ],
      { a: [8, 8, 8, 8], b: [8, 8, 8, 8] },
    );
    expect(padding()).toHaveValue(8);
    act(() => store().setElementPadding("a", { left: 2 }));
    expect(padding()).toHaveAttribute("placeholder", "Mixed");
    act(() => store().undo());
    expect(padding()).toHaveValue(8);
  });
});

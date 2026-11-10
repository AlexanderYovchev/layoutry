import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";
import { InspectorGridChildSection } from "./InspectorGridChildSection";
import { InspectorTransformSection } from "./InspectorTransformSection";
import { InspectorTypographySection } from "./InspectorTypographySection";

/*
 * BC-05.4 reset coverage audit — for every reset of the Typography,
 * Transform and Grid item sections: with EVERY field of the section
 * authored, pressing one reset removes exactly that field (or, for the
 * full-record Grid item, returns it to its default), leaves every other
 * field as it was, is one history entry, and Undo restores the field.
 * (Layout, Flex item, Spacing, Size and the appearance sections are
 * covered by InspectorResetBehavior, InspectorSpacingZero and their own
 * section tests.)
 */

const initialState = useEditorStore.getState();

afterEach(() => {
  useEditorStore.setState(initialState, true);
});

function find(
  nodes: readonly EditorElementNode[] | undefined,
): EditorElementNode | undefined {
  for (const node of nodes ?? []) {
    if (node.id === "n") return node;
    const nested = find(node.children);
    if (nested) return nested;
  }
  return undefined;
}

function Live({
  section,
}: {
  section: (node: EditorElementNode) => ReactElement;
}) {
  const node = useEditorStore((state) => find(state.document.children));
  return node ? section(node) : null;
}

/** `parent` wraps the node, e.g. in the grid its item settings belong to. */
function setup(
  node: EditorElementNode,
  section: (node: EditorElementNode) => ReactElement,
  parent?: EditorElementNode,
) {
  const children = parent ? [{ ...parent, children: [node] }] : [node];
  useEditorStore.setState((state) => ({
    document: { ...state.document, children },
    past: [],
    future: [],
  }));
  render(<Live section={section} />);
}

const current = () => {
  const node = find(useEditorStore.getState().document.children);
  if (!node) throw new Error("no node");
  return node;
};

function press(label: string) {
  const button = screen.getByRole("button", { name: label });
  expect(button, `${label} is available while authored`).toBeEnabled();
  fireEvent.pointerDown(button);
  fireEvent.click(button, { detail: 1 });
}

const TYPOGRAPHY = {
  fontFamily: "Georgia, serif",
  fontSize: { value: 40, unit: "px" },
  fontWeight: 700,
  fontStyle: "italic",
  textDecorationLine: "underline",
  color: "#ff0000",
  textAlign: "center",
  lineHeight: { value: 1.8, unit: "px" },
  letterSpacing: { value: 2, unit: "px" },
} as const satisfies NonNullable<EditorElementNode["typography"]>;

const TYPOGRAPHY_RESETS: [string, keyof typeof TYPOGRAPHY][] = [
  ["Reset font family", "fontFamily"],
  ["Reset font size", "fontSize"],
  ["Reset font weight", "fontWeight"],
  ["Reset font style", "fontStyle"],
  ["Reset text decoration", "textDecorationLine"],
  ["Reset text color", "color"],
  ["Reset text alignment", "textAlign"],
  ["Reset line height", "lineHeight"],
  ["Reset letter spacing", "letterSpacing"],
];

describe("Typography resets (BC-05.4 audit)", () => {
  it.each(TYPOGRAPHY_RESETS)(
    "%s removes only %s, one entry, undoable",
    (label, field) => {
      setup(
        { id: "n", tag: "h1", text: "T", typography: { ...TYPOGRAPHY } },
        (node) => <InspectorTypographySection node={node} />,
      );
      press(label);
      const others: Partial<typeof TYPOGRAPHY> = { ...TYPOGRAPHY };
      delete others[field];
      expect(current().typography).toEqual(others);
      expect(screen.getByRole("button", { name: label })).toBeDisabled();
      expect(useEditorStore.getState().past).toHaveLength(1);
      act(() => useEditorStore.getState().undo());
      expect(current().typography).toEqual(TYPOGRAPHY);
    },
  );
});

const TRANSFORM = { translateX: 12, translateY: -8, rotateDeg: 20, scale: 1.5 };
const TRANSFORM_RESETS: [string, keyof typeof TRANSFORM][] = [
  ["Reset translate X", "translateX"],
  ["Reset translate Y", "translateY"],
  ["Reset rotate", "rotateDeg"],
  ["Reset scale", "scale"],
];

describe("Transform resets (BC-05.4 audit)", () => {
  it.each(TRANSFORM_RESETS)(
    "%s removes only %s, one entry, undoable",
    (label, field) => {
      setup(
        { id: "n", tag: "div", children: [], transform: { ...TRANSFORM } },
        (node) => <InspectorTransformSection node={node} />,
      );
      press(label);
      const others: Partial<typeof TRANSFORM> = { ...TRANSFORM };
      delete others[field];
      expect(current().transform).toEqual(others);
      expect(useEditorStore.getState().past).toHaveLength(1);
      act(() => useEditorStore.getState().undo());
      expect(current().transform).toEqual(TRANSFORM);
    },
  );
});

// Four columns, so the item (columns 2–4) fits and nothing is clamped.
const GRID_PARENT: EditorElementNode = {
  id: "grid",
  tag: "div",
  flowLayout: {
    display: "grid",
    grid: { columns: 4, rows: "auto", rowGap: 0, columnGap: 0 },
  },
};
const GRID_ITEM = {
  columnStart: 2,
  columnSpan: 3,
  rowStart: 4,
  rowSpan: 2,
} as const;
const GRID_DEFAULTS = {
  columnStart: "auto",
  columnSpan: 1,
  rowStart: "auto",
  rowSpan: 1,
} as const;
const GRID_RESETS: [string, keyof typeof GRID_ITEM][] = [
  ["Reset column start", "columnStart"],
  ["Reset column span", "columnSpan"],
  ["Reset row start", "rowStart"],
  ["Reset row span", "rowSpan"],
];

describe("Grid item resets (BC-05.4 audit)", () => {
  it.each(GRID_RESETS)(
    "%s returns only %s to its default, one entry, undoable",
    (label, field) => {
      setup(
        { id: "n", tag: "p", text: "Cell", gridChild: { ...GRID_ITEM } },
        (node) => <InspectorGridChildSection node={node} />,
        GRID_PARENT,
      );
      press(label);
      expect(current().gridChild).toEqual({
        ...GRID_ITEM,
        [field]: GRID_DEFAULTS[field],
      });
      expect(useEditorStore.getState().past).toHaveLength(1);
      act(() => useEditorStore.getState().undo());
      expect(current().gridChild).toEqual(GRID_ITEM);
    },
  );
});

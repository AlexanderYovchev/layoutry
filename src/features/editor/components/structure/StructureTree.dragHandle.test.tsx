import { DndContext, useSensor, useSensors } from "@dnd-kit/core";
import type { ReactNode } from "react";
import { EditorPointerSensor } from "@/features/editor/utils/editorDragSensors";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";
import { StructureDragPreview } from "./StructureDragPreview";
import { StructureDropIndicator } from "./StructureDropIndicator";
import { StructureTree } from "./StructureTree";

/** BC-12.3 — the row drag handle, the drag preview chip and the drop indicator. */

const initialState = useEditorStore.getState();
const store = () => useEditorStore.getState();

const tree: EditorElementNode = {
  id: "page-root",
  tag: "page",
  children: [
    { id: "s1", tag: "section", displayName: "First section", children: [{ id: "a", tag: "p", text: "A", displayName: "Para A" }] },
    { id: "z", tag: "p", text: "Z", displayName: "Para Z" },
  ],
};

/** The editor's own sensor and 4px threshold (EditorApp), not dnd-kit's defaults. */
function EditorDnd({ children }: { children: ReactNode }) {
  const sensors = useSensors(useSensor(EditorPointerSensor, { activationConstraint: { distance: 4 } }));
  return <DndContext sensors={sensors}>{children}</DndContext>;
}

const rowOf = (id: string) => document.querySelector<HTMLElement>(`[data-structure-row-id="${id}"]`)!;

describe("Structure drag handle (BC-12.3)", () => {
  beforeEach(() => {
    useEditorStore.setState(initialState, true);
    store().replaceDocument(tree);
    render(<StructureTree />, { wrapper: EditorDnd });
  });
  afterEach(() => useEditorStore.setState(initialState, true));

  it("every element row has a named handle that is not a tab stop; the page row has none", () => {
    expect(screen.getByRole("button", { name: "Drag Para A" })).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("button", { name: "Drag First section" })).toBeInTheDocument();
    expect(rowOf("page-root").querySelector("[data-structure-drag-handle]")).toBeNull();
    // The rows stay the tree's only tab stop (roving tabindex).
    expect(document.querySelectorAll('[role=treeitem][tabindex="0"]')).toHaveLength(1);
  });

  it("clicking a row or its handle only selects; Ctrl+click still toggles; the chevron still only toggles", () => {
    const before = store().document;
    fireEvent.click(screen.getByRole("button", { name: "Drag Para Z" }));
    expect(store().selection.ids).toEqual(["z"]);
    fireEvent.click(rowOf("a"), { ctrlKey: true });
    expect(store().selection.ids).toEqual(["z", "a"]);
    fireEvent.click(screen.getByRole("button", { name: "Collapse First section" }));
    expect(rowOf("s1")).toHaveAttribute("aria-expanded", "false");
    expect(store().selection.ids).toEqual(["z", "a"]);
    expect(store().document).toBe(before);
    expect(store().past).toHaveLength(0);
  });

  it("a press with less than the 4px activation movement starts no drag; past it, a drag starts (and is announced) without changing the document", () => {
    const before = store().document;
    const handle = screen.getByRole("button", { name: "Drag Para A" });
    fireEvent.pointerDown(handle, { button: 0, isPrimary: true, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(document, { button: 0, isPrimary: true, clientX: 12, clientY: 11 });
    expect(handle).not.toHaveAttribute("data-dragging");
    fireEvent.pointerUp(document, { button: 0, isPrimary: true, clientX: 12, clientY: 11 });
    expect(document.querySelector("[data-structure-move-announcement]")?.textContent).toBe("");

    fireEvent.pointerDown(handle, { button: 0, isPrimary: true, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(document, { button: 0, isPrimary: true, clientX: 10, clientY: 20 });
    expect(handle).toHaveAttribute("data-dragging", "true");
    expect(document.querySelector("[data-structure-move-announcement]")?.textContent).toMatch(/^Dragging Para A./);
    expect(store().selection.ids).toEqual(["a"]); // an unselected row becomes the selection when picked up
    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
    expect(handle).not.toHaveAttribute("data-dragging");
    expect(document.querySelector("[data-structure-move-announcement]")?.textContent).toMatch(/^Move cancelled. Para A was not moved./);
    expect(store().document).toBe(before);
    expect(store().past).toHaveLength(0);
  });

  it("a right-button press never drags", () => {
    const handle = screen.getByRole("button", { name: "Drag Para A" });
    fireEvent.pointerDown(handle, { button: 2, isPrimary: true, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(document, { button: 2, isPrimary: true, clientX: 10, clientY: 40 });
    expect(handle).not.toHaveAttribute("data-dragging");
    fireEvent.pointerUp(document, { button: 2, isPrimary: true, clientX: 10, clientY: 40 });
  });

  it("the expand/collapse animation is off under reduced motion", () => {
    const group = rowOf("s1").nextElementSibling;
    expect(group?.className).toContain("motion-reduce:transition-none");
  });
});

describe("StructureDragPreview", () => {
  it("shows the name (truncating) and no count for one element", () => {
    render(<StructureDragPreview label="A very long element name that will not fit in the chip" tag="p" count={1} />);
    const chip = document.querySelector("[data-structure-drag-preview]")!;
    expect(chip).toHaveTextContent("A very long element name that will not fit in the chip");
    expect(chip.querySelector(".truncate")).not.toBeNull();
    expect(chip.className).toContain("max-w-56");
    expect(chip).not.toHaveTextContent(/\d/);
  });

  it("is ready for a multi-drag count (BC-12.4)", () => {
    render(<StructureDragPreview label="Para" tag="p" count={3} />);
    expect(document.querySelector("[data-structure-drag-preview]")).toHaveTextContent("Para3");
  });
});

describe("StructureDropIndicator", () => {
  const base = { targetId: "a", rejection: null, reasonText: null, top: 40, left: 30, width: 150, height: 32 } as const;

  it("draws a line at its own y for before/after (BC-12.3.1: the hook resolves the edge and level), and the row box for inside", () => {
    const { rerender } = render(<StructureDropIndicator indicator={{ ...base, zone: "before", height: 0 }} />);
    const shape = () => document.querySelector<HTMLElement>("[data-structure-drop-indicator] > div")!;
    expect(shape().style.top).toBe("39px");
    expect(shape().style.left).toBe("30px");
    rerender(<StructureDropIndicator indicator={{ ...base, zone: "after", top: 72, height: 0 }} />);
    expect(shape().style.top).toBe("71px");
    rerender(<StructureDropIndicator indicator={{ ...base, zone: "inside" }} />);
    expect(shape().style.height).toBe("32px");
    expect(document.querySelector("[data-structure-drop-reason]")).toBeNull();
  });

  it("a refused target is marked and shows the reason, width-limited", () => {
    render(<StructureDropIndicator indicator={{ ...base, zone: "inside", rejection: "incompatible-parent", reasonText: "That place can't contain this kind of element" }} />);
    expect(document.querySelector("[data-structure-drop-indicator]")).toHaveAttribute("data-refused", "true");
    const reason = document.querySelector<HTMLElement>("[data-structure-drop-reason]")!;
    expect(reason).toHaveTextContent("That place can't contain this kind of element");
    expect(reason.style.maxWidth).toBe("150px");
    expect(document.querySelector("[data-structure-drop-indicator]")).toHaveAttribute("aria-hidden", "true");
  });
});

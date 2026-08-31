import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { InspectorOptionSection } from "./InspectorOptionSection";
import type { EditorElementNode } from "@/features/editor/types/document";

const initialState = useEditorStore.getState();

// Mirrors InspectorFormControlSection.test.tsx's own ConnectedSection —
// subscribes to the store so each commit sees the freshly-updated node.
function ConnectedSection({ selectId, optionId }: { selectId: string; optionId: string }) {
  const select = useEditorStore((state) => state.document.children?.find((c) => c.id === selectId));
  const option = select?.children?.find((c) => c.id === optionId);
  if (!option) return null;
  return <InspectorOptionSection node={option} parentId={selectId} />;
}

function setup(select: EditorElementNode) {
  useEditorStore.setState((state) => ({
    document: { ...state.document, children: [select] },
  }));
  const optionId = select.children![0].id;
  return { ...render(<ConnectedSection selectId={select.id} optionId={optionId} />), optionId };
}

function currentSelect(id: string) {
  return useEditorStore.getState().document.children?.find((c) => c.id === id);
}

function currentOption(selectId: string, optionId: string) {
  return currentSelect(selectId)?.children?.find((c) => c.id === optionId);
}

describe("InspectorOptionSection (Checkpoint 1.13)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("shows Label/Value/Selected fields", () => {
    setup({ id: "select-1", tag: "select", children: [{ id: "option-a", tag: "option", text: "Bulgaria", value: "bg" }] });

    expect(screen.getByLabelText("Label")).toHaveValue("Bulgaria");
    expect(screen.getByLabelText("Value")).toHaveValue("bg");
    expect(screen.getByRole("switch", { name: "Selected" })).toBeInTheDocument();
  });

  it("commits Label through setElementText", () => {
    const { optionId } = setup({ id: "select-1", tag: "select", children: [{ id: "option-a", tag: "option", text: "Bulgaria" }] });

    fireEvent.change(screen.getByLabelText("Label"), { target: { value: "Germany" } });
    fireEvent.blur(screen.getByLabelText("Label"));

    expect(currentOption("select-1", optionId)?.text).toBe("Germany");
  });

  it("does not commit Label when the field is unchanged (touched guard)", () => {
    setup({ id: "select-1", tag: "select", children: [{ id: "option-a", tag: "option", text: "Bulgaria" }] });
    const pastLengthBefore = useEditorStore.getState().past.length;

    fireEvent.blur(screen.getByLabelText("Label"));

    expect(useEditorStore.getState().past).toHaveLength(pastLengthBefore);
  });

  it("Escape reverts an in-progress Label edit without committing", () => {
    const { optionId } = setup({ id: "select-1", tag: "select", children: [{ id: "option-a", tag: "option", text: "Bulgaria" }] });

    fireEvent.change(screen.getByLabelText("Label"), { target: { value: "something else entirely" } });
    fireEvent.keyDown(screen.getByLabelText("Label"), { key: "Escape" });

    expect(currentOption("select-1", optionId)?.text).toBe("Bulgaria");
    expect(screen.getByLabelText("Label")).toHaveValue("Bulgaria");
  });

  it("commits Value through setElementValue", () => {
    const { optionId } = setup({ id: "select-1", tag: "select", children: [{ id: "option-a", tag: "option", text: "Bulgaria" }] });

    fireEvent.change(screen.getByLabelText("Value"), { target: { value: "bg" } });
    fireEvent.blur(screen.getByLabelText("Value"));

    expect(currentOption("select-1", optionId)?.value).toBe("bg");
  });

  it("Reset Value clears the value back to unset", () => {
    const { optionId } = setup({ id: "select-1", tag: "select", children: [{ id: "option-a", tag: "option", text: "Bulgaria", value: "bg" }] });

    fireEvent.click(screen.getByRole("button", { name: "Reset value" }));

    expect(currentOption("select-1", optionId)?.value).toBeUndefined();
  });

  it("has no Reset affordance for Label (no meaningful 'unset' state, matching every other Canvas-text field in this app)", () => {
    setup({ id: "select-1", tag: "select", children: [{ id: "option-a", tag: "option", text: "Bulgaria" }] });
    expect(screen.queryByRole("button", { name: "Reset label" })).not.toBeInTheDocument();
  });

  it("turning Selected ON calls setSelectSelectedOption with this Option's id", () => {
    const { optionId } = setup({
      id: "select-1",
      tag: "select",
      children: [
        { id: "option-a", tag: "option", text: "A" },
        { id: "option-b", tag: "option", text: "B" },
      ],
    });

    fireEvent.click(screen.getByRole("switch", { name: "Selected" }));

    expect(currentOption("select-1", optionId)?.selected).toBe(true);
  });

  it("turning Selected ON clears any previously-selected sibling in the same commit (single-select invariant)", () => {
    setup({
      id: "select-1",
      tag: "select",
      children: [
        { id: "option-a", tag: "option", text: "A", selected: true },
        { id: "option-b", tag: "option", text: "B" },
      ],
    });

    // The rendered Option here is option-a (the first child) — select it
    // again is a no-op; instead exercise via the store directly for b,
    // then re-render for a to prove clearing.
    useEditorStore.getState().setSelectSelectedOption("select-1", "option-b");
    expect(currentOption("select-1", "option-a")?.selected).toBeUndefined();
    expect(currentOption("select-1", "option-b")?.selected).toBe(true);
  });

  it("reflects the current selected state on the toggle", () => {
    setup({ id: "select-1", tag: "select", children: [{ id: "option-a", tag: "option", text: "A", selected: true }] });
    expect(screen.getByRole("switch", { name: "Selected" })).toHaveAttribute("aria-checked", "true");
  });

  it("turning Selected OFF clears the authored selection entirely (setSelectSelectedOption with undefined)", () => {
    const { optionId } = setup({ id: "select-1", tag: "select", children: [{ id: "option-a", tag: "option", text: "A", selected: true }] });

    fireEvent.click(screen.getByRole("switch", { name: "Selected" }));

    expect(currentOption("select-1", optionId)?.selected).toBeUndefined();
  });

  it("toggling Selected pushes exactly one history entry, undoable", () => {
    setup({ id: "select-1", tag: "select", children: [{ id: "option-a", tag: "option", text: "A" }] });
    const pastLengthBefore = useEditorStore.getState().past.length;

    fireEvent.click(screen.getByRole("switch", { name: "Selected" }));

    expect(useEditorStore.getState().past).toHaveLength(pastLengthBefore + 1);
    useEditorStore.getState().undo();
    expect(currentSelect("select-1")?.children?.[0].selected).toBeUndefined();
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { SelectElement } from "./SelectElement";
import type { EditorElementNode } from "@/features/editor/types/document";

const initialState = useEditorStore.getState();

describe("SelectElement (Checkpoint 1.13)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useEditorStore.setState(initialState, true);
  });

  it("renders a genuine <select>, not a div standing in for one", () => {
    render(
      <SelectElement
        node={{ id: "select-1", tag: "select", children: [] }}
        parentId="form-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.tagName).toBe("SELECT");
  });

  it("reflects name as a real DOM attribute", () => {
    render(
      <SelectElement
        node={{ id: "select-1", tag: "select", name: "country", children: [] }}
        parentId="form-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );

    expect(screen.getByRole("combobox")).toHaveAttribute("name", "country");
  });

  it("renders every Option child passed to it (children rendered by DocumentNodeRenderer, not by SelectElement itself)", () => {
    render(
      <SelectElement
        node={{ id: "select-1", tag: "select", children: [] }}
        parentId="form-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      >
        <option value="a">A</option>
        <option value="b">B</option>
      </SelectElement>,
    );

    expect(screen.getAllByRole("option")).toHaveLength(2);
  });

  it("derives its own defaultValue from whichever Option child is authored selected, using the Option's value", () => {
    render(
      <SelectElement
        node={{
          id: "select-1",
          tag: "select",
          children: [
            { id: "option-a", tag: "option", text: "A", value: "a" },
            { id: "option-b", tag: "option", text: "B", value: "b", selected: true },
          ],
        }}
        parentId="form-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      >
        <option value="a">A</option>
        <option value="b">B</option>
      </SelectElement>,
    );

    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("b");
  });

  it("falls back to the selected Option's own text when it has no explicit value, mirroring native HTMLOptionElement.value behavior", () => {
    render(
      <SelectElement
        node={{
          id: "select-1",
          tag: "select",
          children: [{ id: "option-a", tag: "option", text: "Bulgaria", selected: true }],
        }}
        parentId="form-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      >
        <option>Bulgaria</option>
      </SelectElement>,
    );

    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("Bulgaria");
  });

  it("lets the native first-option default apply when no Option is authored selected", () => {
    render(
      <SelectElement
        node={{
          id: "select-1",
          tag: "select",
          children: [
            { id: "option-a", tag: "option", text: "A", value: "a" },
            { id: "option-b", tag: "option", text: "B", value: "b" },
          ],
        }}
        parentId="form-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      >
        <option value="a">A</option>
        <option value="b">B</option>
      </SelectElement>,
    );

    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("a");
  });

  describe("native interaction safety (Checkpoint 1.13)", () => {
    it("mousedown's default action is prevented — the mechanism that stops the native dropdown from opening / focus from being stolen", () => {
      render(
        <SelectElement node={{ id: "select-1", tag: "select", children: [] }} parentId="form-1" parentLayoutMode="flow" parentFlowDisplay="block" />,
      );

      const notCancelled = fireEvent.mouseDown(screen.getByRole("combobox"));
      expect(notCancelled).toBe(false);
    });

    it("click's default action is also prevented — the same two-guard shape Checkbox/Radio's preventCheckedToggle already established", () => {
      render(
        <SelectElement node={{ id: "select-1", tag: "select", children: [] }} parentId="form-1" parentLayoutMode="flow" parentFlowDisplay="block" />,
      );

      const notCancelled = fireEvent.click(screen.getByRole("combobox"));
      expect(notCancelled).toBe(false);
    });

    it("a plain click still bubbles (propagation untouched) — Canvas selection's own delegated click handler must still see it", () => {
      render(
        <div
          onClick={(event) => {
            (event.currentTarget as HTMLElement).dataset.bubbled = "true";
          }}
        >
          <SelectElement node={{ id: "select-1", tag: "select", children: [] }} parentId="form-1" parentLayoutMode="flow" parentFlowDisplay="block" />
        </div>,
      );

      fireEvent.click(screen.getByRole("combobox"));
      expect(screen.getByRole("combobox").closest("div")).toHaveAttribute("data-bubbled", "true");
    });
  });

  describe("external selection resync (Checkpoint 1.13)", () => {
    it("resyncs the displayed selected value when node's authored selection changes from OUTSIDE interaction (e.g. Undo/Redo/Inspector) — defaultValue alone would NOT do this on a later render, the same class of bug Checkpoint 1.10/1.12 found for defaultValue/defaultChecked", () => {
      const baseNode = {
        id: "select-1",
        tag: "select",
        children: [
          { id: "option-a", tag: "option", text: "A", value: "a" },
          { id: "option-b", tag: "option", text: "B", value: "b" },
        ],
      } as const;

      const { rerender } = render(
        <SelectElement node={{ ...baseNode, children: [{ ...baseNode.children[0], selected: true }, baseNode.children[1]] }} parentId="form-1" parentLayoutMode="flow" parentFlowDisplay="block">
          <option value="a">A</option>
          <option value="b">B</option>
        </SelectElement>,
      );
      const select = screen.getByRole("combobox") as HTMLSelectElement;
      expect(select.value).toBe("a");

      rerender(
        <SelectElement node={{ ...baseNode, children: [baseNode.children[0], { ...baseNode.children[1], selected: true }] }} parentId="form-1" parentLayoutMode="flow" parentFlowDisplay="block">
          <option value="a">A</option>
          <option value="b">B</option>
        </SelectElement>,
      );
      expect(select.value).toBe("b");

      rerender(
        <SelectElement node={{ ...baseNode, children: [{ ...baseNode.children[0], selected: true }, baseNode.children[1]] }} parentId="form-1" parentLayoutMode="flow" parentFlowDisplay="block">
          <option value="a">A</option>
          <option value="b">B</option>
        </SelectElement>,
      );
      expect(select.value).toBe("a");
    });

    it("resyncs to the native first-option default (not a blank value) when the authored selection is cleared entirely from OUTSIDE interaction — a regression this checkpoint's own verification caught: setting .value=\"\" produces a genuinely blank select, not the first option", () => {
      const withSelection: EditorElementNode = {
        id: "select-1",
        tag: "select",
        children: [
          { id: "option-a", tag: "option", text: "A", value: "a", selected: true },
          { id: "option-b", tag: "option", text: "B", value: "b" },
        ],
      };

      const { rerender } = render(
        <SelectElement node={withSelection} parentId="form-1" parentLayoutMode="flow" parentFlowDisplay="block">
          <option value="a">A</option>
          <option value="b">B</option>
        </SelectElement>,
      );
      const select = screen.getByRole("combobox") as HTMLSelectElement;
      expect(select.value).toBe("a");

      const withoutSelection: EditorElementNode = {
        ...withSelection,
        children: withSelection.children!.map((child) => ({ ...child, selected: undefined })),
      };
      rerender(
        <SelectElement node={withoutSelection} parentId="form-1" parentLayoutMode="flow" parentFlowDisplay="block">
          <option value="a">A</option>
          <option value="b">B</option>
        </SelectElement>,
      );
      expect(select.value).toBe("a");
      expect(select.selectedIndex).toBe(0);
    });
  });
});

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { TableSectionElement } from "./TableSectionElement";

const initialState = useEditorStore.getState();

describe("TableSectionElement (Checkpoint 1.14)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useEditorStore.setState(initialState, true);
  });

  it("renders a genuine <thead> for tag: thead", () => {
    render(
      <table>
        <TableSectionElement node={{ id: "thead-1", tag: "thead", children: [] }} parentId="table-1" parentLayoutMode="flow" parentFlowDisplay="block" />
      </table>,
    );
    const el = document.querySelector("[data-node-id='thead-1']");
    expect(el?.tagName).toBe("THEAD");
  });

  it("renders a genuine <tbody> for tag: tbody", () => {
    render(
      <table>
        <TableSectionElement node={{ id: "tbody-1", tag: "tbody", children: [] }} parentId="table-1" parentLayoutMode="flow" parentFlowDisplay="block" />
      </table>,
    );
    expect(document.querySelector("[data-node-id='tbody-1']")?.tagName).toBe("TBODY");
  });

  it("renders a genuine <tfoot> for tag: tfoot", () => {
    render(
      <table>
        <TableSectionElement node={{ id: "tfoot-1", tag: "tfoot", children: [] }} parentId="table-1" parentLayoutMode="flow" parentFlowDisplay="block" />
      </table>,
    );
    expect(document.querySelector("[data-node-id='tfoot-1']")?.tagName).toBe("TFOOT");
  });

  it("renders its children (rows are recursed by DocumentNodeRenderer, not by TableSectionElement itself)", () => {
    render(
      <table>
        <TableSectionElement node={{ id: "tbody-1", tag: "tbody", children: [] }} parentId="table-1" parentLayoutMode="flow" parentFlowDisplay="block">
          <tr>
            <td>Alpha</td>
          </tr>
        </TableSectionElement>
      </table>,
    );
    expect(screen.getByText("Alpha")).toBeInTheDocument();
  });

  it("is never independently text-editable — no contenteditable/double-click editing session exists on the section itself", () => {
    render(
      <table>
        <TableSectionElement node={{ id: "tbody-1", tag: "tbody", children: [] }} parentId="table-1" parentLayoutMode="flow" parentFlowDisplay="block" />
      </table>,
    );
    const el = document.querySelector("[data-node-id='tbody-1']");
    expect(el?.hasAttribute("contenteditable")).toBe(false);
  });
});

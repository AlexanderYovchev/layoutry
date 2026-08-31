import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { TableRowElement } from "./TableRowElement";

const initialState = useEditorStore.getState();

describe("TableRowElement (Checkpoint 1.14)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useEditorStore.setState(initialState, true);
  });

  it("renders a genuine <tr>, not a div standing in for one", () => {
    render(
      <table>
        <tbody>
          <TableRowElement node={{ id: "tr-1", tag: "tr", children: [] }} parentId="tbody-1" parentLayoutMode="flow" parentFlowDisplay="block" />
        </tbody>
      </table>,
    );
    expect(document.querySelector("[data-node-id='tr-1']")?.tagName).toBe("TR");
  });

  it("renders its children (cells are recursed by DocumentNodeRenderer, not by TableRowElement itself)", () => {
    render(
      <table>
        <tbody>
          <TableRowElement node={{ id: "tr-1", tag: "tr", children: [] }} parentId="tbody-1" parentLayoutMode="flow" parentFlowDisplay="block">
            <td>Alpha</td>
          </TableRowElement>
        </tbody>
      </table>,
    );
    expect(screen.getByText("Alpha")).toBeInTheDocument();
  });

  it("is never independently text-editable", () => {
    render(
      <table>
        <tbody>
          <TableRowElement node={{ id: "tr-1", tag: "tr", children: [] }} parentId="tbody-1" parentLayoutMode="flow" parentFlowDisplay="block" />
        </tbody>
      </table>,
    );
    expect(document.querySelector("[data-node-id='tr-1']")?.hasAttribute("contenteditable")).toBe(false);
  });
});

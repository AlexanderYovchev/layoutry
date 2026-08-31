import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { TableElement } from "./TableElement";

const initialState = useEditorStore.getState();

describe("TableElement (Checkpoint 1.14)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useEditorStore.setState(initialState, true);
  });

  it("renders a genuine <table>, not a div standing in for one", () => {
    render(
      <TableElement node={{ id: "table-1", tag: "table", children: [] }} parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block">
        <tbody>
          <tr>
            <td>Cell</td>
          </tr>
        </tbody>
      </TableElement>,
    );

    const table = screen.getByRole("table");
    expect(table.tagName).toBe("TABLE");
  });

  it("renders its children (thead/tbody/tfoot are recursed by DocumentNodeRenderer, not by TableElement itself)", () => {
    render(
      <TableElement node={{ id: "table-1", tag: "table", children: [] }} parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block">
        <tbody>
          <tr>
            <td>Alpha</td>
          </tr>
        </tbody>
      </TableElement>,
    );

    expect(screen.getByText("Alpha")).toBeInTheDocument();
  });

  it("stamps the node's own id/tag as data attributes", () => {
    render(<TableElement node={{ id: "table-1", tag: "table", children: [] }} parentId="page-1" parentLayoutMode="flow" parentFlowDisplay="block" />);
    const table = screen.getByRole("table");
    expect(table).toHaveAttribute("data-node-id", "table-1");
    expect(table).toHaveAttribute("data-node-type", "table");
  });
});

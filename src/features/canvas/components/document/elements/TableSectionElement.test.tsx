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

  it("never applies CSS Transition — thead/tbody/tfoot/tr are native-table-row-group geometry, not a styling capability (Checkpoint 1.15.6.14.1)", () => {
    const transition = { property: "opacity" as const, durationMs: 200, timingFunction: "ease" as const, delayMs: 0 };
    useEditorStore.setState({ editorMode: "preview" });
    render(
      <table>
        <TableSectionElement node={{ id: "tbody-1", tag: "tbody", transition, children: [] }} parentId="table-1" parentLayoutMode="flow" parentFlowDisplay="block" />
      </table>,
    );
    const el = document.querySelector("[data-node-id='tbody-1']") as HTMLElement;
    expect(el.style.transitionProperty).toBe("");
  });

  it("never applies CSS Transform — same native-table-row-group reasoning as Transition above (Checkpoint 1.15.6.14.3)", () => {
    render(
      <table>
        <TableSectionElement node={{ id: "tbody-1", tag: "tbody", transform: { rotateDeg: 15 }, children: [] }} parentId="table-1" parentLayoutMode="flow" parentFlowDisplay="block" />
      </table>,
    );
    const el = document.querySelector("[data-node-id='tbody-1']") as HTMLElement;
    expect(el.style.transform).toBe("");
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { TableCellElement } from "./TableCellElement";

const initialState = useEditorStore.getState();

function renderCell(tag: "th" | "td", text = "Alpha") {
  return render(
    <table>
      <tbody>
        <tr>
          <TableCellElement node={{ id: `${tag}-1`, tag, text }} parentId="tr-1" parentLayoutMode="flow" parentFlowDisplay="block" />
        </tr>
      </tbody>
    </table>,
  );
}

describe("TableCellElement (Checkpoint 1.14)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useEditorStore.setState(initialState, true);
  });

  it("renders a genuine <th> for tag: th", () => {
    renderCell("th");
    expect(screen.getByText("Alpha").tagName).toBe("TH");
  });

  it("renders a genuine <td> for tag: td", () => {
    renderCell("td");
    expect(screen.getByText("Alpha").tagName).toBe("TD");
  });

  it("is not editable until double-clicked", () => {
    renderCell("td");
    expect(screen.getByText("Alpha")).toHaveAttribute("contenteditable", "false");
  });

  it("double-click enters editing mode while remaining a real cell (reuses useEditableText, same as List Item)", () => {
    renderCell("td");
    const cell = screen.getByText("Alpha");
    fireEvent.doubleClick(cell);

    expect(cell.tagName).toBe("TD");
    expect(cell).toHaveAttribute("contenteditable", "true");
  });

  it("commits the edited text through setElementText on blur and exits editing", () => {
    renderCell("td");
    const spy = vi.spyOn(useEditorStore.getState(), "setElementText");

    const cell = screen.getByText("Alpha");
    fireEvent.doubleClick(cell);
    cell.textContent = "Alpha revised";
    fireEvent.blur(cell);

    expect(spy).toHaveBeenCalledWith("td-1", "Alpha revised");
    expect(cell).toHaveAttribute("contenteditable", "false");
  });

  it("Escape reverts without committing", () => {
    renderCell("td");
    const spy = vi.spyOn(useEditorStore.getState(), "setElementText");

    const cell = screen.getByText("Alpha");
    fireEvent.doubleClick(cell);
    cell.textContent = "Discarded";
    fireEvent.keyDown(cell, { key: "Escape" });

    expect(cell.textContent).toBe("Alpha");
    expect(spy).not.toHaveBeenCalled();
  });

  it("an unchanged edit (blur with identical text) produces no history — setElementText is never called", () => {
    renderCell("td");
    const spy = vi.spyOn(useEditorStore.getState(), "setElementText");

    const cell = screen.getByText("Alpha");
    fireEvent.doubleClick(cell);
    fireEvent.blur(cell);

    expect(spy).not.toHaveBeenCalled();
  });

  it("stamps the node's own id/tag as data attributes", () => {
    renderCell("th");
    const cell = screen.getByText("Alpha");
    expect(cell).toHaveAttribute("data-node-id", "th-1");
    expect(cell).toHaveAttribute("data-node-type", "th");
  });

  it("supports CSS Transition — Preview-only, same as any other ordinary box (Checkpoint 1.15.6.14.1)", () => {
    const transition = { property: "opacity" as const, durationMs: 200, timingFunction: "ease" as const, delayMs: 0 };
    useEditorStore.setState({ editorMode: "preview" });
    render(
      <table>
        <tbody>
          <tr>
            <TableCellElement node={{ id: "th-1", tag: "th", text: "Alpha", transition }} parentId="tr-1" parentLayoutMode="flow" parentFlowDisplay="block" />
          </tr>
        </tbody>
      </table>,
    );
    expect(screen.getByText("Alpha")).toHaveStyle({ transitionProperty: "opacity" });
  });

  it("supports CSS Transform — identically in Design, same as any other ordinary box (Checkpoint 1.15.6.14.3)", () => {
    render(
      <table>
        <tbody>
          <tr>
            <TableCellElement node={{ id: "th-1", tag: "th", text: "Alpha", transform: { rotateDeg: 15 } }} parentId="tr-1" parentLayoutMode="flow" parentFlowDisplay="block" />
          </tr>
        </tbody>
      </table>,
    );
    expect(screen.getByText("Alpha")).toHaveStyle({ transform: "rotate(15deg)" });
  });
});

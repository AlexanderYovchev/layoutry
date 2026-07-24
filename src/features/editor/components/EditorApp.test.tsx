import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { EditorApp } from "./EditorApp";

const initialState = useEditorStore.getState();

describe("EditorApp", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("clicking a catalog card inserts a new node, selects it, and syncs Canvas, Structure, and Inspector", async () => {
    const user = userEvent.setup();
    render(<EditorApp />);

    await user.click(screen.getByRole("button", { name: "HTML" }));
    await user.click(screen.getByRole("menuitem", { name: /Button/ }));

    const selectedId = useEditorStore.getState().selectedElementId;
    expect(selectedId).toMatch(/^button-/);

    // Canvas: the new button is really in the rendered document.
    expect(
      screen.getAllByRole("button", { name: "Button" }).length,
    ).toBeGreaterThan(0);

    // Inspector: shows the newly selected node's real generated id.
    expect(screen.getByText(selectedId!)).toBeInTheDocument();

    // Structure: switch to the Structure tab (Elements is the Resource
    // Panel's default), then confirm exactly one row is selected and
    // it's the new node.
    await user.click(screen.getByRole("tab", { name: "Structure" }));
    const selectedRows = screen
      .getAllByRole("treeitem")
      .filter((row) => row.getAttribute("aria-selected") === "true");
    expect(selectedRows).toHaveLength(1);
    expect(selectedRows[0]).toHaveAttribute("title", "Button");
  });

  it("inserts into the document root by default when clicking a catalog card", async () => {
    const user = userEvent.setup();
    render(<EditorApp />);

    await user.click(screen.getByRole("button", { name: "HTML" }));
    await user.click(screen.getByRole("menuitem", { name: /^Container/ }));

    const state = useEditorStore.getState();
    expect(state.document.children?.at(-1)?.id).toBe(state.selectedElementId);
  });
});

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

  it("clicking the Section catalog card inserts a real <section>, selects it, and syncs Canvas and Structure (Checkpoint 1.2)", async () => {
    const user = userEvent.setup();
    const { container } = render(<EditorApp />);

    await user.click(screen.getByRole("button", { name: "HTML" }));
    await user.click(screen.getByRole("menuitem", { name: /^Section/ }));

    const state = useEditorStore.getState();
    const insertedId = state.selectedElementId;
    expect(insertedId).toMatch(/^section-/);
    expect(state.document.children?.at(-1)?.tag).toBe("section");

    // Canvas: the new node is a genuine <section> element, not a <div>.
    const rendered = container.querySelector(`[data-node-id="${insertedId}"]`);
    expect(rendered?.tagName).toBe("SECTION");

    // Structure: the selected row is labeled "Section".
    await user.click(screen.getByRole("tab", { name: "Structure" }));
    const selectedRows = screen
      .getAllByRole("treeitem")
      .filter((row) => row.getAttribute("aria-selected") === "true");
    expect(selectedRows).toHaveLength(1);
    expect(selectedRows[0]).toHaveAttribute("title", "Section");
  });

  it("clicking the Link catalog card inserts a real <a>, selects it, and syncs Canvas and Structure (Checkpoint 1.4)", async () => {
    const user = userEvent.setup();
    const { container } = render(<EditorApp />);

    await user.click(screen.getByRole("button", { name: "HTML" }));
    await user.click(screen.getByRole("menuitem", { name: /^Link/ }));

    const state = useEditorStore.getState();
    const insertedId = state.selectedElementId;
    expect(insertedId).toMatch(/^a-/);
    expect(state.document.children?.at(-1)?.tag).toBe("a");
    expect(state.document.children?.at(-1)?.href).toBe("#");

    // Canvas: the new node is a genuine <a> element with a real href.
    const rendered = container.querySelector(`[data-node-id="${insertedId}"]`);
    expect(rendered?.tagName).toBe("A");
    expect(rendered).toHaveAttribute("href", "#");

    // Structure: the selected row is labeled "Link".
    await user.click(screen.getByRole("tab", { name: "Structure" }));
    const selectedRows = screen
      .getAllByRole("treeitem")
      .filter((row) => row.getAttribute("aria-selected") === "true");
    expect(selectedRows).toHaveLength(1);
    expect(selectedRows[0]).toHaveAttribute("title", "Link");
  });

  it("clicking the Unordered List catalog card inserts a real <ul> with three starter <li> children, selects it, and syncs Structure (Checkpoint 1.6)", async () => {
    const user = userEvent.setup();
    const { container } = render(<EditorApp />);

    await user.click(screen.getByRole("button", { name: "HTML" }));
    await user.click(screen.getByRole("menuitem", { name: /^Unordered List/ }));

    const state = useEditorStore.getState();
    const insertedId = state.selectedElementId;
    expect(insertedId).toMatch(/^ul-/);
    const insertedNode = state.document.children?.at(-1);
    expect(insertedNode?.tag).toBe("ul");
    expect(insertedNode?.children).toHaveLength(3);

    const rendered = container.querySelector(`[data-node-id="${insertedId}"]`);
    expect(rendered?.tagName).toBe("UL");
    expect(rendered?.querySelectorAll("li")).toHaveLength(3);

    await user.click(screen.getByRole("tab", { name: "Structure" }));
    const selectedRows = screen
      .getAllByRole("treeitem")
      .filter((row) => row.getAttribute("aria-selected") === "true");
    expect(selectedRows).toHaveLength(1);
    expect(selectedRows[0]).toHaveAttribute("title", "Unordered List");
  });

  it("clicking the Ordered List catalog card inserts a real <ol> (Checkpoint 1.6)", async () => {
    const user = userEvent.setup();
    const { container } = render(<EditorApp />);

    await user.click(screen.getByRole("button", { name: "HTML" }));
    await user.click(screen.getByRole("menuitem", { name: /^Ordered List/ }));

    const state = useEditorStore.getState();
    const insertedId = state.selectedElementId;
    expect(state.document.children?.at(-1)?.tag).toBe("ol");
    const rendered = container.querySelector(`[data-node-id="${insertedId}"]`);
    expect(rendered?.tagName).toBe("OL");
  });

  it("clicking List Item while an Unordered List is selected appends another <li> into it — the practical add-item path (Checkpoint 1.6)", async () => {
    const user = userEvent.setup();
    render(<EditorApp />);

    await user.click(screen.getByRole("button", { name: "HTML" }));
    await user.click(screen.getByRole("menuitem", { name: /^Unordered List/ }));
    // The freshly inserted ul is already selected.

    await user.click(screen.getByRole("button", { name: "HTML" }));
    await user.click(screen.getByRole("menuitem", { name: /^List Item/ }));

    const state = useEditorStore.getState();
    const list = state.document.children?.find((c) => c.tag === "ul");
    expect(list?.children).toHaveLength(4);
  });

  it("clicking List Item while a plain Container is selected does not insert anything — invalid outside a list (Checkpoint 1.6)", async () => {
    const user = userEvent.setup();
    render(<EditorApp />);

    await user.click(screen.getByRole("button", { name: "HTML" }));
    await user.click(screen.getByRole("menuitem", { name: /^Container/ }));
    const before = useEditorStore.getState().document;

    await user.click(screen.getByRole("button", { name: "HTML" }));
    await user.click(screen.getByRole("menuitem", { name: /^List Item/ }));

    expect(useEditorStore.getState().document).toBe(before);
  });

  it("clicking each semantic sectioning catalog card inserts its genuine native element, selects it, and syncs Structure (Checkpoint 1.8)", async () => {
    // Six full insert+verify rounds through real userEvent interactions —
    // comfortably under 2s alone, but occasionally exceeds Vitest's
    // default 5000ms per-test budget under full-suite parallel load; a
    // generous explicit timeout avoids a resource-contention flake
    // without reducing coverage back down to six separate tests.
    const user = userEvent.setup();
    const { container } = render(<EditorApp />);

    const cases: Array<{ menuName: string; tag: string; domTag: string; structureLabel: string }> = [
      { menuName: "^Header", tag: "header", domTag: "HEADER", structureLabel: "Header" },
      { menuName: "^Nav", tag: "nav", domTag: "NAV", structureLabel: "Navigation" },
      { menuName: "^Main", tag: "main", domTag: "MAIN", structureLabel: "Main" },
      { menuName: "^Article", tag: "article", domTag: "ARTICLE", structureLabel: "Article" },
      { menuName: "^Aside", tag: "aside", domTag: "ASIDE", structureLabel: "Aside" },
      { menuName: "^Footer", tag: "footer", domTag: "FOOTER", structureLabel: "Footer" },
    ];

    for (const { menuName, tag, domTag, structureLabel } of cases) {
      // Clear selection before each insertion — otherwise the previous
      // iteration's inserted (and still-selected) semantic container
      // would become this insertion's destination parent instead of the
      // document root, since every one of these six tags can contain
      // children (see resolveDestinationParent).
      useEditorStore.getState().clearSelection();

      await user.click(screen.getByRole("button", { name: "HTML" }));
      await user.click(screen.getByRole("menuitem", { name: new RegExp(menuName) }));

      const state = useEditorStore.getState();
      const insertedId = state.selectedElementId;
      expect(state.document.children?.at(-1)?.tag, tag).toBe(tag);

      const rendered = container.querySelector(`[data-node-id="${insertedId}"]`);
      expect(rendered?.tagName, tag).toBe(domTag);

      await user.click(screen.getByRole("tab", { name: "Structure" }));
      const selectedRows = screen
        .getAllByRole("treeitem")
        .filter((row) => row.getAttribute("aria-selected") === "true");
      expect(selectedRows, tag).toHaveLength(1);
      expect(selectedRows[0], tag).toHaveAttribute("title", structureLabel);
    }
  }, 15000);
});

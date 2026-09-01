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
    // Anchored (Checkpoint 1.12): a plain /Button/ now also matches the
    // "Radio Button" card's accessible name (card names concatenate
    // name+description) — see this checkpoint's own report.
    await user.click(screen.getByRole("menuitem", { name: /^Button/ }));

    const selectedId = useEditorStore.getState().selection.primaryId;
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
    expect(state.document.children?.at(-1)?.id).toBe(state.selection.primaryId);
  });

  it("clicking the Section catalog card inserts a real <section>, selects it, and syncs Canvas and Structure (Checkpoint 1.2)", async () => {
    const user = userEvent.setup();
    const { container } = render(<EditorApp />);

    await user.click(screen.getByRole("button", { name: "HTML" }));
    await user.click(screen.getByRole("menuitem", { name: /^Section/ }));

    const state = useEditorStore.getState();
    const insertedId = state.selection.primaryId;
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
    const insertedId = state.selection.primaryId;
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
    const insertedId = state.selection.primaryId;
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
    const insertedId = state.selection.primaryId;
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
      const insertedId = state.selection.primaryId;
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

  it("clicking the Form catalog card inserts a real <form>, selects it, and syncs Structure (Checkpoint 1.10)", async () => {
    const user = userEvent.setup();
    const { container } = render(<EditorApp />);

    await user.click(screen.getByRole("button", { name: "Forms" }));
    // Anchored to "FormForm" (Checkpoint 1.15.1): card accessible names
    // concatenate name+description with no separator ("FormForm
    // container"), and the Forms category now also has a still-disabled
    // "Form Row" placeholder card, whose own accessible name
    // ("Form RowHorizontal field grouping") also starts with "Form" — the
    // same kind of collision Checkpoint 1.12's own Radio Button fix
    // already documented, one level more specific here.
    await user.click(screen.getByRole("menuitem", { name: /^FormForm/ }));

    const state = useEditorStore.getState();
    const insertedId = state.selection.primaryId;
    expect(state.document.children?.at(-1)?.tag).toBe("form");

    const rendered = container.querySelector(`[data-node-id="${insertedId}"]`);
    expect(rendered?.tagName).toBe("FORM");

    await user.click(screen.getByRole("tab", { name: "Structure" }));
    const selectedRows = screen
      .getAllByRole("treeitem")
      .filter((row) => row.getAttribute("aria-selected") === "true");
    expect(selectedRows).toHaveLength(1);
    expect(selectedRows[0]).toHaveAttribute("title", "Form");
  });

  it("clicking Text Input while a Form is selected inserts a real <input type=\"text\"> inside it — Form > Input (Checkpoint 1.10)", async () => {
    const user = userEvent.setup();
    const { container } = render(<EditorApp />);

    await user.click(screen.getByRole("button", { name: "Forms" }));
    // Anchored to "FormForm" (Checkpoint 1.15.1): card accessible names
    // concatenate name+description with no separator ("FormForm
    // container"), and the Forms category now also has a still-disabled
    // "Form Row" placeholder card, whose own accessible name
    // ("Form RowHorizontal field grouping") also starts with "Form" — the
    // same kind of collision Checkpoint 1.12's own Radio Button fix
    // already documented, one level more specific here.
    await user.click(screen.getByRole("menuitem", { name: /^FormForm/ }));
    // The freshly inserted form is already selected.

    await user.click(screen.getByRole("button", { name: "Forms" }));
    await user.click(screen.getByRole("menuitem", { name: /^Text Input/ }));

    const state = useEditorStore.getState();
    const form = state.document.children?.find((c) => c.tag === "form");
    expect(form?.children).toHaveLength(1);
    expect(form?.children?.[0]?.tag).toBe("input");
    expect(form?.children?.[0]?.inputType).toBe("text");

    const inputId = state.selection.primaryId;
    const rendered = container.querySelector(`[data-node-id="${inputId}"]`);
    expect(rendered?.tagName).toBe("INPUT");
    expect(rendered).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("tab", { name: "Structure" }));
    const selectedRows = screen
      .getAllByRole("treeitem")
      .filter((row) => row.getAttribute("aria-selected") === "true");
    expect(selectedRows).toHaveLength(1);
    expect(selectedRows[0]).toHaveAttribute("title", "Text Input");
  });

  it("clicking Label then Email Input inserts a real <label><input type=\"email\"></label>, syncing Structure with the subtype-aware name (Checkpoint 1.11)", async () => {
    const user = userEvent.setup();
    const { container } = render(<EditorApp />);

    await user.click(screen.getByRole("button", { name: "Forms" }));
    await user.click(screen.getByRole("menuitem", { name: /^Label/ }));
    const labelId = useEditorStore.getState().selection.primaryId;
    // The freshly inserted label is already selected.

    await user.click(screen.getByRole("button", { name: "Forms" }));
    await user.click(screen.getByRole("menuitem", { name: /^Email Input/ }));

    const state = useEditorStore.getState();
    const label = state.document.children?.find((c) => c.id === labelId);
    expect(label?.tag).toBe("label");
    expect(label?.children).toHaveLength(1);
    expect(label?.children?.[0]?.tag).toBe("input");
    expect(label?.children?.[0]?.inputType).toBe("email");

    const labelRendered = container.querySelector(`[data-node-id="${labelId}"]`);
    expect(labelRendered?.tagName).toBe("LABEL");
    const inputRendered = labelRendered?.querySelector('input[data-node-type="input"]');
    expect(inputRendered).toHaveAttribute("type", "email");

    await user.click(screen.getByRole("tab", { name: "Structure" }));
    const selectedRows = screen
      .getAllByRole("treeitem")
      .filter((row) => row.getAttribute("aria-selected") === "true");
    expect(selectedRows).toHaveLength(1);
    expect(selectedRows[0]).toHaveAttribute("title", "Email Input");
  });

  it("clicking Checkbox then Textarea inserts a real checkbox and a genuine <textarea>, syncing Structure with their own names (Checkpoint 1.12)", async () => {
    const user = userEvent.setup();
    const { container } = render(<EditorApp />);

    await user.click(screen.getByRole("button", { name: "Forms" }));
    // Anchored to "FormForm" (Checkpoint 1.15.1): card accessible names
    // concatenate name+description with no separator ("FormForm
    // container"), and the Forms category now also has a still-disabled
    // "Form Row" placeholder card, whose own accessible name
    // ("Form RowHorizontal field grouping") also starts with "Form" — the
    // same kind of collision Checkpoint 1.12's own Radio Button fix
    // already documented, one level more specific here.
    await user.click(screen.getByRole("menuitem", { name: /^FormForm/ }));
    const formId = useEditorStore.getState().selection.primaryId;

    await user.click(screen.getByRole("button", { name: "Forms" }));
    await user.click(screen.getByRole("menuitem", { name: /^Checkbox/ }));
    const checkboxId = useEditorStore.getState().selection.primaryId;

    // Re-select the Form so Textarea lands as its sibling, not nested
    // inside the checkbox (a leaf, but insertion targets the selected
    // node's parent when the selection can't contain children).
    await user.click(screen.getByRole("tab", { name: "Structure" }));
    await user.click(screen.getByRole("treeitem", { name: /Form/ }));
    await user.click(screen.getByRole("button", { name: "Forms" }));
    await user.click(screen.getByRole("menuitem", { name: /^Textarea/ }));
    const textareaId = useEditorStore.getState().selection.primaryId;

    const form = useEditorStore.getState().document.children?.find((c) => c.id === formId);
    expect(form?.tag).toBe("form");
    expect(form?.children?.some((c) => c.id === checkboxId && c.inputType === "checkbox")).toBe(true);
    expect(form?.children?.some((c) => c.id === textareaId && c.tag === "textarea")).toBe(true);

    const checkboxRendered = container.querySelector(`[data-node-id="${checkboxId}"]`);
    expect(checkboxRendered).toHaveAttribute("type", "checkbox");
    const textareaRendered = container.querySelector(`[data-node-id="${textareaId}"]`);
    expect(textareaRendered?.tagName).toBe("TEXTAREA");

    await user.click(screen.getByRole("tab", { name: "Structure" }));
    const selectedRows = screen
      .getAllByRole("treeitem")
      .filter((row) => row.getAttribute("aria-selected") === "true");
    expect(selectedRows).toHaveLength(1);
    expect(selectedRows[0]).toHaveAttribute("title", "Textarea");
  }, 15000); // multi-round real userEvent interaction — see Checkpoint 1.8's identical fix for the same resource-contention flake under full-suite parallel load

  it("clicking Select inserts a real <select> with three genuine <option> children, syncing Structure with their own names (Checkpoint 1.13)", async () => {
    const user = userEvent.setup();
    const { container } = render(<EditorApp />);

    await user.click(screen.getByRole("button", { name: "Forms" }));
    await user.click(screen.getByRole("menuitem", { name: /^Select/ }));
    const selectId = useEditorStore.getState().selection.primaryId;

    const selectNode = useEditorStore.getState().document.children?.find((c) => c.id === selectId);
    expect(selectNode?.tag).toBe("select");
    expect(selectNode?.children).toHaveLength(3);
    expect(selectNode?.children?.every((c) => c.tag === "option")).toBe(true);

    const selectRendered = container.querySelector(`[data-node-id="${selectId}"]`);
    expect(selectRendered?.tagName).toBe("SELECT");
    expect(selectRendered?.querySelectorAll("option")).toHaveLength(3);

    await user.click(screen.getByRole("tab", { name: "Structure" }));
    const selectedRows = screen
      .getAllByRole("treeitem")
      .filter((row) => row.getAttribute("aria-selected") === "true");
    expect(selectedRows).toHaveLength(1);
    expect(selectedRows[0]).toHaveAttribute("title", "Select");
  }, 15000); // multi-round real userEvent interaction — see Checkpoint 1.8's identical fix for the same resource-contention flake under full-suite parallel load
});

import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "./useEditorStore";

// A separate file from useEditorStore.test.ts (Checkpoint 1.15.2's own
// new selection/bulk-CSS coverage) rather than appended to that already-
// large existing file — see this checkpoint's own report for why.

const initialState = useEditorStore.getState();

describe("useEditorStore — multi-selection actions (Checkpoint 1.15.2)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("selectOnly/selectElement replace the whole selection with one id", () => {
    useEditorStore.getState().selectOnly("heading-1");
    expect(useEditorStore.getState().selection).toEqual({ ids: ["heading-1"], primaryId: "heading-1" });

    useEditorStore.getState().selectOnly("paragraph-1");
    expect(useEditorStore.getState().selection).toEqual({ ids: ["paragraph-1"], primaryId: "paragraph-1" });
  });

  it("toggleSelection adds then removes, matching Ctrl/Cmd+click semantics", () => {
    useEditorStore.getState().selectOnly("heading-1");
    useEditorStore.getState().toggleSelection("paragraph-1");
    expect(useEditorStore.getState().selection.ids.sort()).toEqual(["heading-1", "paragraph-1"].sort());

    useEditorStore.getState().toggleSelection("paragraph-1");
    expect(useEditorStore.getState().selection).toEqual({ ids: ["heading-1"], primaryId: "heading-1" });
  });

  it("addToSelection never removes an already-selected id (Shift+click semantics)", () => {
    useEditorStore.getState().selectOnly("heading-1");
    useEditorStore.getState().addToSelection("paragraph-1");
    useEditorStore.getState().addToSelection("heading-1"); // re-adding an existing member
    expect(useEditorStore.getState().selection.ids.sort()).toEqual(["heading-1", "paragraph-1"].sort());
  });

  it("setSelection replaces the whole selection at once (e.g. Table's Select All Cells)", () => {
    useEditorStore.getState().setSelection(["heading-1", "paragraph-1", "button-1"]);
    expect(useEditorStore.getState().selection.ids).toEqual(["heading-1", "paragraph-1", "button-1"]);
    expect(useEditorStore.getState().selection.primaryId).toBe("button-1");
  });

  it("clearSelection empties the selection", () => {
    useEditorStore.getState().setSelection(["heading-1", "paragraph-1"]);
    useEditorStore.getState().clearSelection();
    expect(useEditorStore.getState().selection).toEqual({ ids: [] });
  });

  it("selection changes never push history entries (clicking is not an undoable action)", () => {
    const pastLengthBefore = useEditorStore.getState().past.length;
    useEditorStore.getState().selectOnly("heading-1");
    useEditorStore.getState().toggleSelection("paragraph-1");
    useEditorStore.getState().addToSelection("button-1");
    useEditorStore.getState().setSelection(["heading-1"]);
    useEditorStore.getState().clearSelection();
    expect(useEditorStore.getState().past.length).toBe(pastLengthBefore);
  });
});

describe("useEditorStore — bulk CSS commands (Checkpoint 1.15.2)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("applies one field to every selected node in exactly one history entry", () => {
    useEditorStore.getState().setSelection(["heading-1", "paragraph-1"]);
    const pastLengthBefore = useEditorStore.getState().past.length;

    useEditorStore.getState().setElementsTypographyField(["heading-1", "paragraph-1"], "fontWeight", 700);

    expect(useEditorStore.getState().past.length).toBe(pastLengthBefore + 1);
    const document = useEditorStore.getState().document;
    const heading = document.children?.[0].children?.find((c) => c.id === "heading-1");
    const paragraph = document.children?.[0].children?.find((c) => c.id === "paragraph-1");
    expect(heading?.typography?.fontWeight).toBe(700);
    expect(paragraph?.typography?.fontWeight).toBe(700);
  });

  it("no-op bulk edit (every targeted node already at that value) pushes no history entry", () => {
    useEditorStore.getState().setElementsTypographyField(["heading-1"], "fontWeight", 700);
    const pastLengthAfterFirst = useEditorStore.getState().past.length;

    useEditorStore.getState().setElementsTypographyField(["heading-1"], "fontWeight", 700);
    expect(useEditorStore.getState().past.length).toBe(pastLengthAfterFirst);
  });

  it("undo reverts every targeted node's change together, redo reapplies them together", () => {
    useEditorStore.getState().setElementsBackgroundField(["heading-1", "paragraph-1"], "color", "#ff0000");

    useEditorStore.getState().undo();
    let document = useEditorStore.getState().document;
    expect(document.children?.[0].children?.find((c) => c.id === "heading-1")?.background?.color).toBeUndefined();
    expect(document.children?.[0].children?.find((c) => c.id === "paragraph-1")?.background?.color).toBeUndefined();

    useEditorStore.getState().redo();
    document = useEditorStore.getState().document;
    expect(document.children?.[0].children?.find((c) => c.id === "heading-1")?.background?.color).toBe("#ff0000");
    expect(document.children?.[0].children?.find((c) => c.id === "paragraph-1")?.background?.color).toBe("#ff0000");
  });

  it("setElementsBorderAllSidesField/setElementsBorderRadiusAllCorners/setElementsSpacingAllSides each push one entry", () => {
    const cases: Array<() => void> = [
      () => useEditorStore.getState().setElementsBorderAllSidesField(["heading-1"], "width", { value: 2, unit: "px" }),
      () => useEditorStore.getState().setElementsBorderRadiusAllCorners(["heading-1"], { value: 4, unit: "px" }),
      () => useEditorStore.getState().setElementsSpacingAllSides(["heading-1"], "margin", 8),
      () => useEditorStore.getState().setElementsDisplayField(["heading-1"], "display", "none"),
      () => useEditorStore.getState().setElementsFilterField(["heading-1"], "opacity", 50),
      () => useEditorStore.getState().setElementsPositionField(["heading-1"], "position", "relative"),
      () => useEditorStore.getState().setElementsSizeConstraintField(["heading-1"], "minWidth", 100),
    ];

    for (const apply of cases) {
      const before = useEditorStore.getState().past.length;
      apply();
      expect(useEditorStore.getState().past.length).toBe(before + 1);
    }
  });
});

describe("useEditorStore — multi-selection delete (Checkpoint 1.15.2)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("deletes every selected sibling in one history entry", () => {
    useEditorStore.getState().setSelection(["heading-1", "paragraph-1"]);
    const pastLengthBefore = useEditorStore.getState().past.length;

    useEditorStore.getState().deleteSelection();

    expect(useEditorStore.getState().past.length).toBe(pastLengthBefore + 1);
    const section = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(section?.children?.some((c) => c.id === "heading-1")).toBe(false);
    expect(section?.children?.some((c) => c.id === "paragraph-1")).toBe(false);
    expect(section?.children?.some((c) => c.id === "button-1")).toBe(true); // untouched sibling survives
  });

  it("normalizes ancestor+descendant overlap to one deletion, not a double-remove", () => {
    useEditorStore.getState().setSelection(["section-1", "heading-1"]); // heading-1 is section-1's own child
    const pastLengthBefore = useEditorStore.getState().past.length;

    useEditorStore.getState().deleteSelection();

    expect(useEditorStore.getState().past.length).toBe(pastLengthBefore + 1); // one entry, not an error/double mutation
    expect(useEditorStore.getState().document.children?.some((c) => c.id === "section-1")).toBe(false);
  });

  it("undo restores the entire deleted selection together", () => {
    useEditorStore.getState().setSelection(["heading-1", "paragraph-1"]);
    useEditorStore.getState().deleteSelection();

    useEditorStore.getState().undo();

    const section = useEditorStore.getState().document.children?.find((c) => c.id === "section-1");
    expect(section?.children?.some((c) => c.id === "heading-1")).toBe(true);
    expect(section?.children?.some((c) => c.id === "paragraph-1")).toBe(true);
  });

  it("is a no-op with nothing selected", () => {
    const document = useEditorStore.getState().document;
    useEditorStore.getState().deleteSelection();
    expect(useEditorStore.getState().document).toBe(document);
  });
});

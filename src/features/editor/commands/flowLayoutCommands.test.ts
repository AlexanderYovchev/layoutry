import { describe, expect, it } from "vitest";
import {
  setFlexChildSettings,
  setFlexContainerSettings,
  setFlowDisplayMode,
  setGridChildSettings,
  setGridContainerSettings,
} from "./flowLayoutCommands";
import type { EditorElementNode } from "@/features/editor/types/document";

function tree(): EditorElementNode {
  return {
    id: "root",
    tag: "page",
    children: [
      { id: "container-1", tag: "div", children: [{ id: "heading-1", tag: "h1" }] },
      { id: "container-2", tag: "div", children: [] },
    ],
  };
}

describe("setFlowDisplayMode", () => {
  it("sets display on exactly one node", () => {
    const result = setFlowDisplayMode(tree(), "container-1", "flex");
    expect(result.children?.find((c) => c.id === "container-1")?.flowLayout?.display).toBe("flex");
  });

  it("keeps unrelated branches referentially unchanged", () => {
    const root = tree();
    const result = setFlowDisplayMode(root, "container-1", "flex");
    expect(result.children?.find((c) => c.id === "container-2")).toBe(
      root.children?.find((c) => c.id === "container-2"),
    );
  });

  it("preserves previously-set flex settings when switching display away and back", () => {
    const flexSettings = {
      direction: "column" as const,
      wrap: "wrap" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      rowGap: 8,
      columnGap: 8,
    };
    let root = tree();
    root = setFlowDisplayMode(root, "container-1", "flex");
    root = setFlexContainerSettings(root, "container-1", flexSettings);
    root = setFlowDisplayMode(root, "container-1", "grid");
    root = setFlowDisplayMode(root, "container-1", "flex");

    const node = root.children?.find((c) => c.id === "container-1");
    expect(node?.flowLayout?.display).toBe("flex");
    expect(node?.flowLayout?.flex).toEqual(flexSettings);
  });

  it("is a no-op (same reference) if nodeId doesn't exist", () => {
    const root = tree();
    expect(setFlowDisplayMode(root, "does-not-exist", "flex")).toBe(root);
  });
});

describe("setFlexContainerSettings / setGridContainerSettings", () => {
  it("sets flex settings independently of grid settings on the same node", () => {
    const flex = {
      direction: "row" as const,
      wrap: "nowrap" as const,
      justifyContent: "start" as const,
      alignItems: "stretch" as const,
      rowGap: 0,
      columnGap: 0,
    };
    const grid = { columns: 3 as const, rows: "auto" as const, rowGap: 16, columnGap: 16 };

    let root = tree();
    root = setFlexContainerSettings(root, "container-1", flex);
    root = setGridContainerSettings(root, "container-1", grid);

    const node = root.children?.find((c) => c.id === "container-1");
    expect(node?.flowLayout?.flex).toEqual(flex);
    expect(node?.flowLayout?.grid).toEqual(grid);
  });
});

describe("setGridContainerSettings — re-clamps existing children (Checkpoint 3.5.1)", () => {
  function gridTreeWithChildren(): EditorElementNode {
    return {
      id: "root",
      tag: "page",
      children: [
        {
          id: "grid-1",
          tag: "div",
          flowLayout: { display: "grid", grid: { columns: 4, rows: "auto", rowGap: 16, columnGap: 16 } },
          children: [
            { id: "a", tag: "button", gridChild: { columnStart: 1, columnSpan: 2, rowStart: "auto", rowSpan: 1 } },
            { id: "b", tag: "button", gridChild: { columnStart: 3, columnSpan: 2, rowStart: "auto", rowSpan: 1 } },
            { id: "c", tag: "button" }, // no gridChild set — must stay untouched
          ],
        },
      ],
    };
  }

  it("clamps every child's columnStart/columnSpan when the column count shrinks out from under them", () => {
    const root = gridTreeWithChildren();
    const result = setGridContainerSettings(root, "grid-1", {
      columns: 2,
      rows: "auto",
      rowGap: 16,
      columnGap: 16,
    });

    const grid = result.children?.find((c) => c.id === "grid-1");
    expect(grid?.children?.find((c) => c.id === "a")?.gridChild).toEqual({
      columnStart: 1,
      columnSpan: 2,
      rowStart: "auto",
      rowSpan: 1,
    });
    // columnStart 3 no longer exists in a 2-column grid — clamped to the last column.
    expect(grid?.children?.find((c) => c.id === "b")?.gridChild).toEqual({
      columnStart: 2,
      columnSpan: 2,
      rowStart: "auto",
      rowSpan: 1,
    });
  });

  it("leaves a child with no gridChild set untouched", () => {
    const root = gridTreeWithChildren();
    const result = setGridContainerSettings(root, "grid-1", { columns: 2, rows: "auto", rowGap: 16, columnGap: 16 });
    const grid = result.children?.find((c) => c.id === "grid-1");
    expect(grid?.children?.find((c) => c.id === "c")?.gridChild).toBeUndefined();
  });

  it("no unreachable child remains after shrinking columns — every columnStart+columnSpan-1 stays within the new column count", () => {
    const root = gridTreeWithChildren();
    const result = setGridContainerSettings(root, "grid-1", { columns: 2, rows: "auto", rowGap: 16, columnGap: 16 });
    const grid = result.children?.find((c) => c.id === "grid-1");
    for (const child of grid?.children ?? []) {
      if (!child.gridChild || child.gridChild.columnStart === "auto") continue;
      expect(child.gridChild.columnStart).toBeLessThanOrEqual(2);
    }
  });
});

describe("setFlexChildSettings / setGridChildSettings", () => {
  it("sets a child's own flex settings without touching siblings", () => {
    const root: EditorElementNode = {
      id: "root",
      tag: "page",
      children: [
        { id: "a", tag: "div", children: [] },
        { id: "b", tag: "div", children: [] },
      ],
    };
    const result = setFlexChildSettings(root, "a", { grow: 1, shrink: 0, basis: 200, alignSelf: "center" });
    expect(result.children?.find((c) => c.id === "a")?.flexChild).toEqual({
      grow: 1,
      shrink: 0,
      basis: 200,
      alignSelf: "center",
    });
    expect(result.children?.find((c) => c.id === "b")?.flexChild).toBeUndefined();
  });

  it("sets a child's own grid placement", () => {
    const root: EditorElementNode = { id: "root", tag: "page", children: [{ id: "a", tag: "div", children: [] }] };
    const result = setGridChildSettings(root, "a", { columnStart: 2, columnSpan: 2, rowStart: "auto", rowSpan: 1 });
    expect(result.children?.[0].gridChild).toEqual({
      columnStart: 2,
      columnSpan: 2,
      rowStart: "auto",
      rowSpan: 1,
    });
  });

  it("is a no-op (same reference) if nodeId doesn't exist", () => {
    const root = tree();
    expect(setFlexChildSettings(root, "nope", { grow: 1, shrink: 1, basis: "auto", alignSelf: "auto" })).toBe(root);
    expect(setGridChildSettings(root, "nope", { columnStart: "auto", columnSpan: 1, rowStart: "auto", rowSpan: 1 })).toBe(
      root,
    );
  });
});

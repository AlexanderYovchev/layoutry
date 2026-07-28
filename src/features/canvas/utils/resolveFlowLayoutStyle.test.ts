import { describe, expect, it } from "vitest";
import { resolveFlowLayoutStyle } from "./resolveFlowLayoutStyle";
import type { EditorElementNode } from "@/features/editor/types/document";

describe("resolveFlowLayoutStyle", () => {
  it("returns undefined for a legacy node with no flowLayout at all", () => {
    const node: EditorElementNode = { id: "n1", tag: "div" };
    expect(resolveFlowLayoutStyle(node)).toBeUndefined();
  });

  it("renders Block as a flex column with no wrap/justify/align exposed", () => {
    const node: EditorElementNode = { id: "n1", tag: "div", flowLayout: { display: "block" } };
    expect(resolveFlowLayoutStyle(node)).toEqual({
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
    });
  });

  it("renders Flex with direction/wrap/justify/align/gap from flex settings", () => {
    const node: EditorElementNode = {
      id: "n1",
      tag: "div",
      flowLayout: {
        display: "flex",
        flex: {
          direction: "column",
          wrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          rowGap: 8,
          columnGap: 12,
        },
      },
    };
    expect(resolveFlowLayoutStyle(node)).toEqual({
      display: "flex",
      flexDirection: "column",
      flexWrap: "wrap",
      justifyContent: "space-between",
      alignItems: "center",
      rowGap: 8,
      columnGap: 12,
    });
  });

  it("uses Flex defaults when display is flex but no flex settings are set yet", () => {
    const node: EditorElementNode = { id: "n1", tag: "div", flowLayout: { display: "flex" } };
    expect(resolveFlowLayoutStyle(node)).toEqual({
      display: "flex",
      flexDirection: "row",
      flexWrap: "nowrap",
      justifyContent: "flex-start",
      alignItems: "stretch",
      rowGap: 0,
      columnGap: 0,
    });
  });

  it("maps every justifyContent option to real CSS values", () => {
    const options: Array<[string, string]> = [
      ["start", "flex-start"],
      ["center", "center"],
      ["end", "flex-end"],
      ["space-between", "space-between"],
      ["space-around", "space-around"],
      ["space-evenly", "space-evenly"],
    ];
    for (const [input, expected] of options) {
      const node: EditorElementNode = {
        id: "n1",
        tag: "div",
        flowLayout: {
          display: "flex",
          flex: {
            direction: "row",
            wrap: "nowrap",
            justifyContent: input as never,
            alignItems: "stretch",
            rowGap: 0,
            columnGap: 0,
          },
        },
      };
      expect(resolveFlowLayoutStyle(node)?.justifyContent).toBe(expected);
    }
  });

  it("includes alignContent only when explicitly set", () => {
    const node: EditorElementNode = {
      id: "n1",
      tag: "div",
      flowLayout: {
        display: "flex",
        flex: {
          direction: "row",
          wrap: "wrap",
          justifyContent: "start",
          alignItems: "stretch",
          alignContent: "space-between",
          rowGap: 0,
          columnGap: 0,
        },
      },
    };
    expect(resolveFlowLayoutStyle(node)?.alignContent).toBe("space-between");
  });

  it("renders Grid with equal-fraction column/row templates and gaps", () => {
    const node: EditorElementNode = {
      id: "n1",
      tag: "div",
      flowLayout: { display: "grid", grid: { columns: 3, rows: 2, rowGap: 8, columnGap: 16 } },
    };
    expect(resolveFlowLayoutStyle(node)).toEqual({
      display: "grid",
      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
      gridTemplateRows: "repeat(2, minmax(0, 1fr))",
      rowGap: 8,
      columnGap: 16,
    });
  });

  it("omits gridTemplateRows when rows is auto", () => {
    const node: EditorElementNode = {
      id: "n1",
      tag: "div",
      flowLayout: { display: "grid", grid: { columns: 2, rows: "auto", rowGap: 16, columnGap: 16 } },
    };
    expect(resolveFlowLayoutStyle(node)?.gridTemplateRows).toBeUndefined();
  });

  it("uses Grid defaults (2 equal columns, 16px gaps) when display is grid but no grid settings are set yet", () => {
    const node: EditorElementNode = { id: "n1", tag: "div", flowLayout: { display: "grid" } };
    expect(resolveFlowLayoutStyle(node)).toEqual({
      display: "grid",
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      gridTemplateRows: undefined,
      rowGap: 16,
      columnGap: 16,
    });
  });
});

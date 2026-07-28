import { describe, expect, it } from "vitest";
import { clampGridChildPlacement } from "./clampGridChildPlacement";
import type { GridContainerSettings } from "@/features/editor/types/flowLayout";

const GRID_4_COLS_AUTO_ROWS: GridContainerSettings = { columns: 4, rows: "auto", rowGap: 16, columnGap: 16 };
const GRID_2_COLS_3_ROWS: GridContainerSettings = { columns: 2, rows: 3, rowGap: 16, columnGap: 16 };

describe("clampGridChildPlacement", () => {
  it("passes auto start through unclamped", () => {
    const result = clampGridChildPlacement(
      { columnStart: "auto", columnSpan: 1, rowStart: "auto", rowSpan: 1 },
      GRID_4_COLS_AUTO_ROWS,
    );
    expect(result.columnStart).toBe("auto");
    expect(result.rowStart).toBe("auto");
  });

  it("clamps a column start greater than the track count down to the last track", () => {
    const result = clampGridChildPlacement(
      { columnStart: 9, columnSpan: 1, rowStart: "auto", rowSpan: 1 },
      GRID_4_COLS_AUTO_ROWS,
    );
    expect(result.columnStart).toBe(4);
  });

  it("clamps a span larger than the available tracks down to the track count", () => {
    const result = clampGridChildPlacement(
      { columnStart: 1, columnSpan: 10, rowStart: "auto", rowSpan: 1 },
      GRID_4_COLS_AUTO_ROWS,
    );
    expect(result.columnSpan).toBe(4);
  });

  it("floors a row start below 1 up to 1, even when rows is 'auto' (previously unclamped — a real bug fixed in Checkpoint 3.5.1)", () => {
    const result = clampGridChildPlacement(
      { columnStart: "auto", columnSpan: 1, rowStart: -3, rowSpan: 1 },
      GRID_4_COLS_AUTO_ROWS,
    );
    expect(result.rowStart).toBe(1);
  });

  it("floors a row start of 0 up to 1 when rows has a known track count", () => {
    const result = clampGridChildPlacement(
      { columnStart: "auto", columnSpan: 1, rowStart: 0, rowSpan: 1 },
      GRID_2_COLS_3_ROWS,
    );
    expect(result.rowStart).toBe(1);
  });

  it("floors a row span of 0 up to 1", () => {
    const result = clampGridChildPlacement(
      { columnStart: "auto", columnSpan: 1, rowStart: "auto", rowSpan: 0 },
      GRID_2_COLS_3_ROWS,
    );
    expect(result.rowSpan).toBe(1);
  });

  it("ceilings a numeric row start at the known row count", () => {
    const result = clampGridChildPlacement(
      { columnStart: "auto", columnSpan: 1, rowStart: 12, rowSpan: 1 },
      GRID_2_COLS_3_ROWS,
    );
    expect(result.rowStart).toBe(3);
  });

  it("leaves already-valid placements untouched", () => {
    const settings = { columnStart: 2 as const, columnSpan: 2, rowStart: 1 as const, rowSpan: 1 };
    expect(clampGridChildPlacement(settings, GRID_4_COLS_AUTO_ROWS)).toEqual(settings);
  });
});

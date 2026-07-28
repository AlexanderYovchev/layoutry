import type { GridChildSettings, GridContainerSettings } from "@/features/editor/types/flowLayout";

/**
 * Normalizes a Grid child's committed column/row start+span against its
 * parent's actual track counts (Checkpoint 3.5 / 3.5.1) — the single
 * place this happens, shared by the store's setGridChildSettings action
 * (clamping a fresh commit against the parent's current tracks) and
 * setGridContainerSettings (re-clamping every existing child when the
 * container's own column/row count shrinks out from under them). Never
 * leaves a child referencing an unreachable track: "auto" start passes
 * through unclamped (grid auto-placement always finds a valid cell); a
 * numeric start is floored at 1 and, when the axis has a known (non-
 * "auto") track count, ceilinged at it too. Span is always floored at 1
 * and ceilinged at the track count when known — a span of 0 or a
 * negative span would render nothing, which is exactly the "invisible
 * child" this exists to prevent.
 */
export function clampGridChildPlacement(
  settings: GridChildSettings,
  grid: GridContainerSettings,
): GridChildSettings {
  return {
    columnStart: clampTrackStart(settings.columnStart, grid.columns),
    columnSpan: clampTrackSpan(settings.columnSpan, grid.columns),
    rowStart: clampTrackStart(settings.rowStart, grid.rows),
    rowSpan: clampTrackSpan(settings.rowSpan, grid.rows),
  };
}

function clampTrackStart(value: number | "auto", trackCount: "auto" | number): number | "auto" {
  if (value === "auto") return value;
  const flooredAtOne = Math.max(1, value);
  return trackCount === "auto" ? flooredAtOne : Math.min(flooredAtOne, trackCount);
}

function clampTrackSpan(span: number, trackCount: "auto" | number): number {
  const flooredAtOne = Math.max(1, span);
  return trackCount === "auto" ? flooredAtOne : Math.min(flooredAtOne, trackCount);
}

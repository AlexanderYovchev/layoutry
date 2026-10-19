/**
 * Shared look of the Inspector's visual choice grids (Shape,
 * Object Position, Background Position — UI-1.7): the same tinted track
 * as InspectorSegmentedRow, with the chosen cell raised and ringed in the
 * accent color. Behavior (roving focus, aria-pressed) stays in each grid.
 */
export const inspectorChoiceGridClassName =
  "rounded-control border border-line bg-surface-panel-secondary p-1";

export function inspectorChoiceCellClassName(isActive: boolean): string {
  return isActive
    ? "bg-surface-panel shadow-panel ring-1 ring-accent/45"
    : "hover:bg-surface-hover";
}

/** The small glyph inside a cell (shape swatch or position dot). */
export function inspectorChoiceMarkClassName(isActive: boolean): string {
  return isActive ? "bg-accent" : "bg-fg-muted";
}

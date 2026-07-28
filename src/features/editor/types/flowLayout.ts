/**
 * Flow-mode container arrangement (Checkpoint 3.5) — the counterpart to
 * Free mode's positioning model (types/layout.ts). "block" is this app's
 * predictable-vertical-stacking mode: implemented as a flex column under
 * the hood (see resolveFlowLayoutStyle) rather than literal CSS
 * display:block, since this app's leaf elements (button, image) are
 * inline-level by default and would sit side-by-side/wrap under real
 * block formatting instead of stacking — "vertical stacking" is the
 * actual, explicit requirement, not the literal display value.
 */
export type FlowDisplayMode = "block" | "flex" | "grid";

export type FlexDirection = "row" | "column";
export type FlexWrap = "nowrap" | "wrap";
export type JustifyContent = "start" | "center" | "end" | "space-between" | "space-around" | "space-evenly";
export type AlignItems = "start" | "center" | "end" | "stretch";
export type AlignContent = "start" | "center" | "end" | "space-between" | "space-around" | "stretch";

export interface FlexContainerSettings {
  direction: FlexDirection;
  wrap: FlexWrap;
  justifyContent: JustifyContent;
  alignItems: AlignItems;
  alignContent?: AlignContent;
  rowGap: number;
  columnGap: number;
}

/** Only equal-fraction presets this checkpoint (rendered as repeat(n, minmax(0, 1fr))) — no custom track editor, per the task's own scope boundary. */
export type GridTrackPreset = 1 | 2 | 3 | 4;

export interface GridContainerSettings {
  columns: GridTrackPreset;
  rows: "auto" | GridTrackPreset;
  rowGap: number;
  columnGap: number;
}

export interface FlowLayoutSettings {
  display: FlowDisplayMode;
  /** Retained even while display isn't "flex", so switching Flex -> Grid -> Flex never discards prior Flex configuration. */
  flex?: FlexContainerSettings;
  /** Retained even while display isn't "grid" — same reasoning as flex. */
  grid?: GridContainerSettings;
}

export type FlexBasis = number | "auto";
export type AlignSelf = "auto" | "start" | "center" | "end" | "stretch";

export interface FlexChildSettings {
  grow: number;
  shrink: number;
  basis: FlexBasis;
  alignSelf: AlignSelf;
}

export interface GridChildSettings {
  columnStart: number | "auto";
  columnSpan: number;
  rowStart: number | "auto";
  rowSpan: number;
}

const DEFAULT_FLEX_SETTINGS: FlexContainerSettings = {
  direction: "row",
  wrap: "nowrap",
  justifyContent: "start",
  alignItems: "stretch",
  rowGap: 0,
  columnGap: 0,
};

const DEFAULT_GRID_SETTINGS: GridContainerSettings = {
  columns: 2,
  rows: "auto",
  rowGap: 16,
  columnGap: 16,
};

const DEFAULT_FLOW_LAYOUT: FlowLayoutSettings = { display: "block" };

const DEFAULT_FLEX_CHILD_SETTINGS: FlexChildSettings = {
  grow: 0,
  shrink: 1,
  basis: "auto",
  alignSelf: "auto",
};

const DEFAULT_GRID_CHILD_SETTINGS: GridChildSettings = {
  columnStart: "auto",
  columnSpan: 1,
  rowStart: "auto",
  rowSpan: 1,
};

/**
 * A node with no flowLayout at all is "legacy" (predates Checkpoint
 * 3.5) — see resolveFlowLayoutStyle, which renders those via the
 * original hardcoded classes rather than this default. This getter is
 * for nodes that *do* have a flowLayout (even a partial one, e.g. only
 * `{ display: "flex" }`), filling in safe defaults for whichever
 * sub-settings weren't set yet.
 */
export function getFlowLayoutSettings(node: { flowLayout?: FlowLayoutSettings }): FlowLayoutSettings {
  return node.flowLayout ?? DEFAULT_FLOW_LAYOUT;
}

export function getFlexContainerSettings(node: { flowLayout?: FlowLayoutSettings }): FlexContainerSettings {
  return node.flowLayout?.flex ?? DEFAULT_FLEX_SETTINGS;
}

export function getGridContainerSettings(node: { flowLayout?: FlowLayoutSettings }): GridContainerSettings {
  return node.flowLayout?.grid ?? DEFAULT_GRID_SETTINGS;
}

export function getFlexChildSettings(node: { flexChild?: FlexChildSettings }): FlexChildSettings {
  return node.flexChild ?? DEFAULT_FLEX_CHILD_SETTINGS;
}

export function getGridChildSettings(node: { gridChild?: GridChildSettings }): GridChildSettings {
  return node.gridChild ?? DEFAULT_GRID_CHILD_SETTINGS;
}

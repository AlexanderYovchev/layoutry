import { getFlexContainerSettings, getGridContainerSettings } from "@/features/editor/types/flowLayout";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { CSSProperties } from "react";

const JUSTIFY_CONTENT_CSS: Record<string, CSSProperties["justifyContent"]> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  "space-between": "space-between",
  "space-around": "space-around",
  "space-evenly": "space-evenly",
};

const ALIGN_ITEMS_CSS: Record<string, CSSProperties["alignItems"]> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  stretch: "stretch",
};

const ALIGN_CONTENT_CSS: Record<string, CSSProperties["alignContent"]> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  "space-between": "space-between",
  "space-around": "space-around",
  stretch: "stretch",
};

function gridTrackTemplate(count: number): string {
  return `repeat(${count}, minmax(0, 1fr))`;
}

/**
 * A container's own arrangement of its direct children (Checkpoint
 * 3.5) — the Flow-mode counterpart to freeChildStyle's per-child
 * positioning. Returns undefined when node.flowLayout is entirely
 * unset, so a "legacy" node (predating this checkpoint) keeps rendering
 * exactly as before via ContainerElement's original hardcoded Tailwind
 * classes — this resolver only takes over once a node has an explicit
 * flowLayout (every newly created container, see elementFactories.ts).
 *
 * "block" renders as a flex column (see the type's own doc comment for
 * why: this app's leaf elements are inline-level by default, so literal
 * CSS display:block would let them sit side-by-side instead of the
 * "vertical stacking" the checkpoint explicitly asks for) — deliberately
 * with no wrap/justify/align exposed, since Block is meant to be the
 * simple, predictable option; those become available once display is
 * actually "flex".
 */
export function resolveFlowLayoutStyle(node: EditorElementNode): CSSProperties | undefined {
  const flowLayout = node.flowLayout;
  if (!flowLayout) return undefined;

  if (flowLayout.display === "flex") {
    const flex = getFlexContainerSettings(node);
    const style: CSSProperties = {
      display: "flex",
      flexDirection: flex.direction === "column" ? "column" : "row",
      flexWrap: flex.wrap === "wrap" ? "wrap" : "nowrap",
      justifyContent: JUSTIFY_CONTENT_CSS[flex.justifyContent],
      alignItems: ALIGN_ITEMS_CSS[flex.alignItems],
      rowGap: flex.rowGap,
      columnGap: flex.columnGap,
    };
    if (flex.alignContent) style.alignContent = ALIGN_CONTENT_CSS[flex.alignContent];
    return style;
  }

  if (flowLayout.display === "grid") {
    const grid = getGridContainerSettings(node);
    return {
      display: "grid",
      gridTemplateColumns: gridTrackTemplate(grid.columns),
      gridTemplateRows: grid.rows === "auto" ? undefined : gridTrackTemplate(grid.rows),
      rowGap: grid.rowGap,
      columnGap: grid.columnGap,
    };
  }

  // "block" — a flex column with no configurable wrap/justify/align, see
  // the function's own doc comment above.
  return {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
  };
}

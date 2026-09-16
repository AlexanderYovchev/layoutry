import { getFlexChildSettings, getGridChildSettings } from "@/features/editor/types/flowLayout";
import type { FlowDisplayMode } from "@/features/editor/types/flowLayout";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { CSSProperties } from "react";

const ALIGN_SELF_CSS: Record<string, CSSProperties["alignSelf"]> = {
  auto: "auto",
  start: "flex-start",
  center: "center",
  end: "flex-end",
  stretch: "stretch",
};

/**
 * A node's own flex-item or grid-item CSS (Checkpoint 3.5) — the
 * sibling of resolveFlowLayoutStyle (which governs a container's
 * arrangement of its children), this governs how one child participates
 * in that arrangement. Returns undefined whenever the immediate parent
 * isn't actually Flex/Grid (a Block or Free parent has no such
 * placement concept), regardless of whether the node happens to carry
 * retained flexChild/gridChild settings from a previous Flex/Grid
 * configuration.
 *
 * `wasManuallyResized` (Checkpoint 1.15.6.1, "Resize Semantics") is
 * true once a node has been dragged via a resize handle at least once
 * (node.dimensions exists — see resizeNode/resizeElement) — the
 * signal this resolver uses to tell "the user set an explicit size for
 * this child" apart from "this child has never been touched, use the
 * container's own default child-fill behavior." Before this flag
 * existed, both branches below silently discarded that authored size on
 * every render: Flex reset flexShrink back to the container's default
 * (1) and Grid unconditionally forced width/height to 100% of the
 * track, so a user dragging a Flex/Grid child narrower or shorter than
 * its siblings/track would watch the drag "snap back" or "fight" the
 * pointer the instant flex-shrink or the 100% grid-fill kicked back in
 * (see this checkpoint's own report, section C — the actual root cause
 * of the reported Nav > Button resize bug once Nav's Content Layout is
 * set to Flex, the realistic navbar configuration). A manual resize is
 * only ever treated as authored intent when the user hasn't ALSO
 * explicitly configured that same axis's flex-shrink via the Flex Child
 * Inspector (flexChild.shrink !== undefined) — an explicit Inspector
 * value always wins, exactly like resolveSizeConstraintsStyle already
 * wins over this resolver's own min-width/min-height:0 default (see
 * that resolver's own doc comment).
 */
export function resolveFlexOrGridChildStyle(
  node: EditorElementNode,
  parentFlowDisplay: FlowDisplayMode,
): CSSProperties | undefined {
  const wasManuallyResized = node.dimensions !== undefined;

  if (parentFlowDisplay === "flex") {
    const flex = getFlexChildSettings(node);
    const hasExplicitShrink = node.flexChild?.shrink !== undefined;
    return {
      flexGrow: flex.grow,
      // A resized child keeps flex-shrink:0 (matching elementDimensionsStyle's
      // own flexShrink:0 for the same node) unless the user has explicitly
      // authored a shrink factor of their own — see this function's own
      // doc comment.
      flexShrink: wasManuallyResized && !hasExplicitShrink ? 0 : flex.shrink,
      flexBasis: flex.basis === "auto" ? "auto" : flex.basis,
      alignSelf: ALIGN_SELF_CSS[flex.alignSelf],
      // Flex items default to min-width/min-height: auto, which refuses
      // to shrink below the item's own content size (e.g. a button's
      // text) no matter what flexShrink says — the classic flexbox
      // overflow trap. Forcing both to 0 is what actually lets
      // flexShrink shrink a child past its content size, which the
      // containment guarantee requires whenever the container itself
      // gets resized smaller than its children's combined natural size.
      minWidth: 0,
      minHeight: 0,
    };
  }

  if (parentFlowDisplay === "grid") {
    const grid = getGridChildSettings(node);
    const style: CSSProperties = {};
    style.gridColumn =
      grid.columnStart === "auto" ? `span ${grid.columnSpan}` : `${grid.columnStart} / span ${grid.columnSpan}`;
    style.gridRow = grid.rowStart === "auto" ? `span ${grid.rowSpan}` : `${grid.rowStart} / span ${grid.rowSpan}`;
    // Same min-width/min-height:0 reasoning as the Flex branch above —
    // but verified live in a real browser (Checkpoint 3.5 containment
    // pass) that it's not sufficient by itself for a grid item: an
    // element like a <button> keeps shrink-to-fit sizing to its own
    // content instead of filling its track (grid's default
    // justify-items/align-items: normal does not resolve to stretch for
    // it the way it does for a plain block box), so the track shrinks
    // correctly but the item still overflows past it. Forcing
    // width/height to 100% is what actually makes the item fill its
    // (already-correctly-sized) track rather than its own content size —
    // this is the one containment guarantee this checkpoint could not
    // have caught without live-browser verification, since jsdom has no
    // real grid track-sizing algorithm. Only the *default* (never
    // resized) case forces 100% — once a user has explicitly resized
    // this grid child, that authored size wins instead (Checkpoint
    // 1.15.6.1 — see this function's own doc comment).
    style.minWidth = 0;
    style.minHeight = 0;
    if (!wasManuallyResized) {
      style.width = "100%";
      style.height = "100%";
    }
    return style;
  }

  return undefined;
}

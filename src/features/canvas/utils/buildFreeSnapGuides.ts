import type { Rect } from "@/features/canvas/utils/freeLayoutFrame";
import { edgeCoordinate, SNAP_EPSILON, type SnapAxis, type SnapMatch, type SnapResult } from "@/features/canvas/utils/snapEngine";
import type { ActiveSnapGuides, SnapDistanceLabel, SnapGuideSegment, SnapSpacingIndicator } from "@/features/editor/types/snap";

/**
 * BC-13.3 — turns one frame's snap result into the guide overlay state
 * (pure). Per axis only the WINNING match is drawn (D18):
 * - an alignment match → one guide line spanning the dragged box and the
 *   referenced targets (the whole padding box for a parent reference), plus
 *   one CSS-px distance label to the nearest referenced element that doesn't
 *   overlap it along the line;
 * - a spacing match → an equal-spacing indicator (the equal gaps, each
 *   labelled) instead of a line.
 * `achieved` is true only when the dragged box really is on the coordinate
 * (snapped, or exactly aligned already); otherwise the guide is a nearby
 * opportunity and is drawn as such (snapping off / Alt). All distances use
 * border boxes (the targets' measured boxes and the dragged visual box), so
 * margins never count.
 */

const other = (axis: SnapAxis): SnapAxis => (axis === "x" ? "y" : "x");

function span(rect: Rect, axis: SnapAxis): { start: number; end: number } {
  return axis === "x" ? { start: rect.x, end: rect.x + rect.width } : { start: rect.y, end: rect.y + rect.height };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function alignmentGuide(match: SnapMatch, box: Rect, rectById: ReadonlyMap<string, Rect>, parentRect: Rect, achieved: boolean): { line: SnapGuideSegment; distance: SnapDistanceLabel | null } {
  const cross = other(match.axis);
  const own = span(box, cross);
  let from = own.start;
  let to = own.end;
  let nearest: SnapDistanceLabel | null = null;
  for (const reference of match.line?.references ?? []) {
    const rect = reference.kind === "parent" ? parentRect : rectById.get(reference.targetId);
    if (!rect) continue;
    const target = span(rect, cross);
    from = Math.min(from, target.start);
    to = Math.max(to, target.end);
    if (reference.kind === "parent") continue;
    // The gap along the guide between the dragged box and this target, when they don't overlap on that axis.
    const gap = target.start >= own.end ? { from: own.end, to: target.start } : target.end <= own.start ? { from: target.end, to: own.start } : null;
    if (gap && gap.to - gap.from > SNAP_EPSILON && (!nearest || gap.to - gap.from < nearest.value)) {
      nearest = { axis: cross, from: gap.from, to: gap.to, at: match.coordinate, value: round(gap.to - gap.from) };
    }
  }
  return { line: { coordinate: match.coordinate, from, to, achieved }, distance: nearest };
}

function spacingIndicator(match: SnapMatch, box: Rect, rectById: ReadonlyMap<string, Rect>, achieved: boolean): SnapSpacingIndicator | null {
  const candidate = match.spacing;
  if (!candidate) return null;
  const a = rectById.get(candidate.referenceIds[0]);
  const b = rectById.get(candidate.referenceIds[1]);
  if (!a || !b) return null;
  const axis = match.axis;
  const own = span(box, axis);
  const first = span(a, axis);
  const second = span(b, axis);
  const gaps =
    candidate.mode === "repeat-after"
      ? [{ from: first.end, to: second.start }, { from: second.end, to: own.start }]
      : candidate.mode === "repeat-before"
        ? [{ from: own.end, to: first.start }, { from: first.end, to: second.start }]
        : [{ from: first.end, to: own.start }, { from: own.end, to: second.start }];
  const cross = span(box, other(axis));
  return { axis, gaps, at: (cross.start + cross.end) / 2, value: round(candidate.gap), achieved };
}

export function buildFreeSnapGuides(
  containerId: string,
  result: SnapResult,
  box: Rect,
  rectById: ReadonlyMap<string, Rect>,
  parentRect: Rect,
): ActiveSnapGuides | null {
  const guides: ActiveSnapGuides = { containerId, distances: [], spacing: [] };
  for (const axis of ["x", "y"] as const) {
    const match = result[axis].match;
    if (!match) continue;
    const achieved = Math.abs(edgeCoordinate(box, axis, match.edge) - match.coordinate) <= SNAP_EPSILON;
    if (match.kind === "spacing") {
      const indicator = spacingIndicator(match, box, rectById, achieved);
      if (indicator) guides.spacing.push(indicator);
      continue;
    }
    const { line, distance } = alignmentGuide(match, box, rectById, parentRect, achieved);
    if (axis === "x") guides.vertical = line;
    else guides.horizontal = line;
    if (distance) guides.distances.push(distance);
  }
  return guides.vertical || guides.horizontal || guides.spacing.length > 0 ? guides : null;
}

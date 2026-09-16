/**
 * Free-layout Snap (Checkpoint 1.15.6.1.1) — editor assistance only,
 * never document content. This is the single centralized place snap
 * math lives (per this checkpoint's own section 11: "do not put dozens
 * of geometry comparisons directly inside useFreeChildMoveSession") —
 * a pure function with no DOM/React dependency, so it's fully testable
 * on its own and reused unchanged by both the move session and its own
 * tests. The document only ever stores the resulting x/y this function
 * returns; there is no "snappedToParentCenter" flag anywhere.
 */

/** Screen/document pixels a moving edge/center must land within to snap — this app has no Canvas zoom (confirmed via audit), so screen pixels and document pixels are always 1:1; see this checkpoint's own report for why no zoom-conversion step exists. */
export const SNAP_THRESHOLD_PX = 8;

export interface FreeMoveSnapBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FreeMoveSnapResult {
  x: number;
  y: number;
  /** Present only when the x-axis actually snapped this call — the absolute (parent-content-box-relative) x position a vertical guide line should be drawn at. */
  verticalGuide?: number;
  /** Present only when the y-axis actually snapped this call — the absolute (parent-content-box-relative) y position a horizontal guide line should be drawn at. */
  horizontalGuide?: number;
}

interface AxisTarget {
  value: number;
  isParent: boolean;
  /** Stable document order among sibling targets, for deterministic tie-breaking; -1 for a parent target (parent always outranks any sibling — see resolveAxisSnap). */
  siblingIndex: number;
}

interface AxisCandidate {
  snappedStart: number;
  distance: number;
  target: AxisTarget;
  /** 0 = start edge, 1 = center, 2 = end edge — the moving box's own reference point that matched; used only as a final, deterministic tie-break (section 13 names distance, then parent-vs-sibling, then document order; this is an explicit fourth tier this implementation adds for full determinism when even those are tied). */
  edgeRank: number;
}

function axisTargets(parentSize: number, siblingStarts: number[], siblingSizes: number[]): AxisTarget[] {
  const targets: AxisTarget[] = [
    { value: 0, isParent: true, siblingIndex: -1 },
    { value: parentSize / 2, isParent: true, siblingIndex: -1 },
    { value: parentSize, isParent: true, siblingIndex: -1 },
  ];
  for (let i = 0; i < siblingStarts.length; i++) {
    const start = siblingStarts[i];
    const size = siblingSizes[i];
    targets.push({ value: start, isParent: false, siblingIndex: i });
    targets.push({ value: start + size / 2, isParent: false, siblingIndex: i });
    targets.push({ value: start + size, isParent: false, siblingIndex: i });
  }
  return targets;
}

/**
 * Resolves snapping for exactly one axis — reused identically for x and
 * y (section 12: axes resolve fully independently, so a box may snap
 * horizontally to the parent's center while simultaneously snapping
 * vertically to a sibling's top edge).
 */
function resolveAxisSnap(
  proposedStart: number,
  movingSize: number,
  parentSize: number,
  siblingStarts: number[],
  siblingSizes: number[],
  threshold: number,
): { start: number; guide?: number } {
  const targets = axisTargets(parentSize, siblingStarts, siblingSizes);
  // The moving box's own three reference points, as an offset from its
  // own start edge: start (0), center (size/2), end (size).
  const edgeOffsets = [0, movingSize / 2, movingSize];

  let best: AxisCandidate | null = null;

  for (let edgeRank = 0; edgeRank < edgeOffsets.length; edgeRank++) {
    const offset = edgeOffsets[edgeRank];
    for (const target of targets) {
      const snappedStart = target.value - offset;
      const distance = Math.abs(snappedStart - proposedStart);
      if (distance > threshold) continue;

      const candidate: AxisCandidate = { snappedStart, distance, target, edgeRank };
      if (!best) {
        best = candidate;
        continue;
      }
      if (isBetterCandidate(candidate, best)) best = candidate;
    }
  }

  if (!best) return { start: proposedStart };
  return { start: best.snappedStart, guide: best.target.value };
}

/** Section 13's deterministic priority: closest distance wins; a tie prefers a parent target over a sibling target; a further tie prefers earlier document order (lower siblingIndex); a final tie (e.g. a symmetric box where start/center/end are equidistant from the same target) prefers the lower edgeRank, purely so the result never depends on object/array iteration order. */
function isBetterCandidate(candidate: AxisCandidate, current: AxisCandidate): boolean {
  if (candidate.distance !== current.distance) return candidate.distance < current.distance;
  if (candidate.target.isParent !== current.target.isParent) return candidate.target.isParent;
  if (candidate.target.siblingIndex !== current.target.siblingIndex) {
    return candidate.target.siblingIndex < current.target.siblingIndex;
  }
  return candidate.edgeRank < current.edgeRank;
}

/**
 * Free-child movement snap (Checkpoint 1.15.6.1.1, sections 4/12/13/15/16).
 * `proposed` is the box's raw geometry from the pointer delta, BEFORE the
 * existing parent-containment clamp (normalizeFreeLayoutGeometry/
 * computeFreeChildMoveResult's own clamp) — snapping intentionally runs
 * before that clamp (section 21's "proposed geometry -> snapping ->
 * containment/clamp"), so a snap to the parent's right/bottom edge still
 * gets the exact same final containment guarantee applied afterward.
 * `siblings` never includes the moving node itself (section 14) — the
 * caller is responsible for excluding it, since only the caller knows
 * which node is being dragged.
 */
export function resolveFreeMoveSnap(
  proposed: FreeMoveSnapBox,
  parentBounds: { width: number; height: number },
  siblings: FreeMoveSnapBox[],
  threshold: number = SNAP_THRESHOLD_PX,
): FreeMoveSnapResult {
  const siblingXStarts = siblings.map((s) => s.x);
  const siblingXSizes = siblings.map((s) => s.width);
  const siblingYStarts = siblings.map((s) => s.y);
  const siblingYSizes = siblings.map((s) => s.height);

  const xResult = resolveAxisSnap(proposed.x, proposed.width, parentBounds.width, siblingXStarts, siblingXSizes, threshold);
  const yResult = resolveAxisSnap(proposed.y, proposed.height, parentBounds.height, siblingYStarts, siblingYSizes, threshold);

  const result: FreeMoveSnapResult = { x: xResult.start, y: yResult.start };
  if (xResult.guide !== undefined) result.verticalGuide = xResult.guide;
  if (yResult.guide !== undefined) result.horizontalGuide = yResult.guide;
  return result;
}

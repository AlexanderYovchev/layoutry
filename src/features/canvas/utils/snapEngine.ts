import { screenDistanceToLocal, type Rect } from "@/features/canvas/utils/freeLayoutFrame";
import type { SpacingCandidate } from "@/features/canvas/utils/snapEqualSpacing";

/**
 * BC-13.2 — the reusable snapping engine (pure: no DOM, no React). One
 * engine for Free dragging, the eight resize handles, Resource Panel
 * insertion and future multi/cross-container drags; callers differ only in
 * which edges of the moving box participate and how a delta is applied
 * (the `adjust` callback, which also enforces the operation's own
 * constraints: containment, minimum sizes, aspect ratio).
 *
 * Everything is in ONE local frame (see freeLayoutFrame.ts): rendered
 * border boxes, parent padding box, target boxes (nested and transformed
 * targets are supplied as their axis-aligned bounds converted into that
 * frame by the caller). Distances are local CSS px; the threshold is given
 * in SCREEN px and divided by the scale (1 until the Canvas has zoom).
 *
 * Not yet wired into a gesture: the Free move session still uses
 * resolveFreeMoveSnap (8px) until BC-13.3.
 */

/** D3: the fixed snapping threshold, in screen px. */
export const SNAP_THRESHOLD_SCREEN_PX = 6;
/** A lock is kept until the pointer moves this far away (× threshold): hysteresis against jitter. */
export const SNAP_RELEASE_FACTOR = 1.5;
/** A different candidate replaces a held lock only when it is closer by at least this much (screen px). Equal distance keeps the lock (D45). */
export const SNAP_LOCK_SWITCH_MARGIN_SCREEN_PX = 1;
/** Coordinates closer than this are the same logical position (D34), and an adjusted edge must land this close to count as aligned (D46). */
export const SNAP_EPSILON = 1e-6;

export type SnapAxis = "x" | "y";
/** Start = left/top, center, end = right/bottom. */
export type SnapEdge = "start" | "center" | "end";
export type SnapTargetKind = "parent" | "element";

const EDGE_ORDER: Readonly<Record<SnapEdge, number>> = { start: 0, center: 1, end: 2 };
const EDGES: readonly SnapEdge[] = ["start", "center", "end"];

/** An eligible target in the local frame. `rank` is a stable caller-supplied order (e.g. document order); lower wins ties. Never DOM order. */
export interface SnapTarget {
  id: string;
  kind: SnapTargetKind;
  rect: Rect;
  rank: number;
}

/** One target edge contributing to a snap line. */
export interface SnapReference {
  targetId: string;
  kind: SnapTargetKind;
  edge: SnapEdge;
  rank: number;
}

/** One logical alignment position on an axis; identical coordinates from several targets are merged (D34). */
export interface SnapLine {
  axis: SnapAxis;
  coordinate: number;
  /** Sorted: parent first, then rank, then edge. */
  references: SnapReference[];
}

export interface SnapIndex {
  /** Sorted by coordinate (binary-searchable). */
  x: SnapLine[];
  y: SnapLine[];
}

/** Which edges of the moving box may snap on each axis (move: all; resizing the right edge: x ["end"], y []). */
export interface SnapSourceEdges {
  x: readonly SnapEdge[];
  y: readonly SnapEdge[];
}

export const ALL_EDGES: SnapSourceEdges = { x: EDGES, y: EDGES };

export type SnapMatchKind = "alignment" | "spacing";

export interface SnapMatch {
  axis: SnapAxis;
  kind: SnapMatchKind;
  /** The moving box's edge that aligns. */
  edge: SnapEdge;
  /** Where it aligns (local frame). */
  coordinate: number;
  /** coordinate − the edge's proposed position. */
  delta: number;
  /** |delta|, local px. */
  distance: number;
  /** Alignment: the merged line with its references (guide metadata). */
  line?: SnapLine;
  /** Spacing: the equal-gap candidate (guide metadata). */
  spacing?: SpacingCandidate;
}

/** What is held between frames (in the gesture's own state, never in React or the store). */
export interface SnapLockKey {
  kind: SnapMatchKind;
  edge: SnapEdge;
  coordinate: number;
}

export interface SnapLock {
  x: SnapLockKey | null;
  y: SnapLockKey | null;
}

export const NO_SNAP_LOCK: SnapLock = { x: null, y: null };

export interface SnapAxisResult {
  /** The winning valid alignment within reach, even when automatic snapping is off (D22: guides can still be shown). */
  match: SnapMatch | null;
  /** Whether the match was applied to the box (automatic snapping on, and a match). */
  applied: boolean;
}

export interface SnapResult {
  /** The resulting box (the proposed box when nothing was applied). */
  box: Rect;
  x: SnapAxisResult;
  y: SnapAxisResult;
  /** Pass back in on the next frame. */
  lock: SnapLock;
}

/**
 * Applies `delta` to `edge` on `axis` and enforces the operation's own
 * constraints. Returns null when the result is not allowed (the candidate is
 * rejected). For a move this translates the box; for a resize it moves one
 * edge (and, under an aspect lock, derives the other axis).
 */
export type SnapAdjust = (box: Rect, axis: SnapAxis, edge: SnapEdge, delta: number) => Rect | null;

export interface SnapRequest {
  /** Proposed geometry (rendered border box, local frame). */
  box: Rect;
  edges: SnapSourceEdges;
  index: SnapIndex;
  /** Optional equal-spacing candidates (snapEqualSpacing), ranked with alignment. */
  spacing?: readonly SpacingCandidate[];
  /** Automatic snapping on/off. Off still reports matches (D22) but never changes the box. */
  enabled: boolean;
  lock?: SnapLock;
  adjust: SnapAdjust;
  /** Screen px per local px (default 1). */
  scale?: number;
  thresholdScreenPx?: number;
}

/** Translation: the adjust function for a plain move (no constraints of its own). */
export const translateBox: SnapAdjust = (box, axis, _edge, delta) => (axis === "x" ? { ...box, x: box.x + delta } : { ...box, y: box.y + delta });

export function edgeCoordinate(box: Rect, axis: SnapAxis, edge: SnapEdge): number {
  const start = axis === "x" ? box.x : box.y;
  const size = axis === "x" ? box.width : box.height;
  return edge === "start" ? start : edge === "center" ? start + size / 2 : start + size;
}

function compareReferences(a: SnapReference, b: SnapReference): number {
  if (a.kind !== b.kind) return a.kind === "parent" ? -1 : 1;
  if (a.rank !== b.rank) return a.rank - b.rank;
  if (a.edge !== b.edge) return EDGE_ORDER[a.edge] - EDGE_ORDER[b.edge];
  return a.targetId < b.targetId ? -1 : a.targetId > b.targetId ? 1 : 0;
}

function buildAxis(targets: readonly SnapTarget[], axis: SnapAxis): SnapLine[] {
  const points: { coordinate: number; reference: SnapReference }[] = [];
  for (const target of targets) {
    for (const edge of EDGES) {
      points.push({ coordinate: edgeCoordinate(target.rect, axis, edge), reference: { targetId: target.id, kind: target.kind, edge, rank: target.rank } });
    }
  }
  points.sort((a, b) => a.coordinate - b.coordinate);
  const lines: SnapLine[] = [];
  for (const point of points) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(point.coordinate - last.coordinate) <= SNAP_EPSILON) last.references.push(point.reference);
    else lines.push({ axis, coordinate: point.coordinate, references: [point.reference] });
  }
  for (const line of lines) line.references.sort(compareReferences);
  return lines;
}

/** The deduplicated, sorted alignment lines of all targets (build once per gesture or after targeted invalidation). */
export function buildSnapIndex(targets: readonly SnapTarget[]): SnapIndex {
  return { x: buildAxis(targets, "x"), y: buildAxis(targets, "y") };
}

/** Index of the first line with coordinate ≥ value. */
function lowerBound(lines: readonly SnapLine[], value: number): number {
  let low = 0;
  let high = lines.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (lines[mid].coordinate < value) low = mid + 1;
    else high = mid;
  }
  return low;
}

interface Scored {
  match: SnapMatch;
  /** Best (lowest) tie-break key: parent first, then rank. */
  parentFirst: number;
  rank: number;
}

/** Ranking (documented, deterministic): distance; alignment before spacing; a parent reference before elements; lower target rank; source edge start < center < end; lower coordinate. */
function compareScored(a: Scored, b: Scored): number {
  if (Math.abs(a.match.distance - b.match.distance) > SNAP_EPSILON) return a.match.distance - b.match.distance;
  if (a.match.kind !== b.match.kind) return a.match.kind === "alignment" ? -1 : 1;
  if (a.parentFirst !== b.parentFirst) return a.parentFirst - b.parentFirst;
  if (a.rank !== b.rank) return a.rank - b.rank;
  if (a.match.edge !== b.match.edge) return EDGE_ORDER[a.match.edge] - EDGE_ORDER[b.match.edge];
  return a.match.coordinate - b.match.coordinate;
}

function sameLock(match: SnapMatch, lock: SnapLockKey | null): boolean {
  return lock !== null && lock.kind === match.kind && lock.edge === match.edge && Math.abs(lock.coordinate - match.coordinate) <= SNAP_EPSILON;
}

/**
 * Valid candidates on one axis within `reach` (local px). A candidate is
 * valid when `adjust` accepts it AND the adjusted edge really lands on the
 * coordinate (a clamp that moved it elsewhere means no exact alignment, so
 * no guide — D15/D46).
 */
function axisCandidates(request: SnapRequest, box: Rect, axis: SnapAxis, reach: number): Scored[] {
  const lines = request.index[axis];
  const scored: Scored[] = [];
  const consider = (match: SnapMatch, parentFirst: number, rank: number) => {
    const adjusted = request.adjust(box, axis, match.edge, match.delta);
    if (!adjusted || Math.abs(edgeCoordinate(adjusted, axis, match.edge) - match.coordinate) > SNAP_EPSILON) return;
    scored.push({ match, parentFirst, rank });
  };
  for (const edge of request.edges[axis]) {
    const position = edgeCoordinate(box, axis, edge);
    for (let i = lowerBound(lines, position - reach); i < lines.length && lines[i].coordinate <= position + reach; i++) {
      const line = lines[i];
      const delta = line.coordinate - position;
      const lead = line.references[0];
      consider({ axis, kind: "alignment", edge, coordinate: line.coordinate, delta, distance: Math.abs(delta), line }, lead.kind === "parent" ? 0 : 1, lead.rank);
    }
    for (const candidate of request.spacing ?? []) {
      if (candidate.axis !== axis || candidate.sourceEdge !== edge) continue;
      const delta = candidate.coordinate - position;
      if (Math.abs(delta) > reach) continue;
      consider({ axis, kind: "spacing", edge, coordinate: candidate.coordinate, delta, distance: Math.abs(delta), spacing: candidate }, 1, Number.POSITIVE_INFINITY);
    }
  }
  return scored;
}

/**
 * The winner on one axis: the closest valid candidate within the threshold;
 * a held lock stays while it is within the release distance, unless another
 * candidate is closer by at least the switch margin (ties keep the lock).
 */
function resolveAxis(request: SnapRequest, box: Rect, axis: SnapAxis, threshold: number, release: number, switchMargin: number): SnapMatch | null {
  const lockKey = request.lock?.[axis] ?? null;
  const candidates = axisCandidates(request, box, axis, lockKey ? release : threshold);
  const locked = candidates.find((candidate) => sameLock(candidate.match, lockKey));
  const fresh = candidates.filter((candidate) => candidate.match.distance <= threshold + SNAP_EPSILON).sort(compareScored);
  const best = fresh[0];
  if (locked && locked.match.distance <= release + SNAP_EPSILON) {
    if (!best || sameLock(best.match, lockKey) || best.match.distance > locked.match.distance - switchMargin) return locked.match;
  }
  return best?.match ?? null;
}

/**
 * Resolves snapping for one frame. Axes are independent (D8): x is resolved
 * on the proposed box, y on the box after x was applied (so the y check sees
 * the real geometry). With `enabled` false both matches are still reported
 * but nothing is applied.
 */
export function resolveSnap(request: SnapRequest): SnapResult {
  const scale = request.scale ?? 1;
  const threshold = screenDistanceToLocal(request.thresholdScreenPx ?? SNAP_THRESHOLD_SCREEN_PX, scale);
  const release = threshold * SNAP_RELEASE_FACTOR;
  const switchMargin = screenDistanceToLocal(SNAP_LOCK_SWITCH_MARGIN_SCREEN_PX, scale);

  const xMatch = resolveAxis(request, request.box, "x", threshold, release, switchMargin);
  const afterX = request.enabled && xMatch ? (request.adjust(request.box, "x", xMatch.edge, xMatch.delta) ?? request.box) : request.box;
  const yMatch = resolveAxis(request, afterX, "y", threshold, release, switchMargin);
  const afterY = request.enabled && yMatch ? (request.adjust(afterX, "y", yMatch.edge, yMatch.delta) ?? afterX) : afterX;

  const key = (match: SnapMatch | null): SnapLockKey | null => (match ? { kind: match.kind, edge: match.edge, coordinate: match.coordinate } : null);
  return {
    box: afterY,
    x: { match: xMatch, applied: request.enabled && xMatch !== null },
    y: { match: yMatch, applied: request.enabled && yMatch !== null },
    lock: { x: key(xMatch), y: key(yMatch) },
  };
}

/** The parent Free container as a target: its padding box in its own local frame (edges and centre, D2). */
export function parentSnapTarget(containerId: string, paddingBox: { width: number; height: number }): SnapTarget {
  return { id: containerId, kind: "parent", rect: { x: 0, y: 0, width: paddingBox.width, height: paddingBox.height }, rank: -1 };
}

/** A target candidate before eligibility filtering (from the future DOM collector, BC-13.3). */
export interface SnapTargetInput {
  id: string;
  rect: Rect;
  rank: number;
  /** Authored hidden (display:none / visibility:hidden) — never a target (D10). */
  hidden: boolean;
  /** The visible region the target can be seen through (clipping ancestors, scroll viewports), local frame. Omitted = unclipped. */
  visibleRegion?: Rect;
}

function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/**
 * Target eligibility, separate from evaluation: hidden targets and the
 * moving element (and anything inside it) are excluded; a target is kept
 * when any part of it is visible (D19: partially visible counts, aligned to
 * its full bounds); a zero-area target still counts if it is visible
 * (a divider's line).
 */
export function selectSnapTargets(inputs: readonly SnapTargetInput[], excludedIds: ReadonlySet<string>): SnapTarget[] {
  const targets: SnapTarget[] = [];
  for (const input of inputs) {
    if (input.hidden || excludedIds.has(input.id)) continue;
    if (input.visibleRegion) {
      const probe = { x: input.rect.x, y: input.rect.y, width: Math.max(input.rect.width, SNAP_EPSILON), height: Math.max(input.rect.height, SNAP_EPSILON) };
      if (!intersects(probe, input.visibleRegion)) continue;
    }
    targets.push({ id: input.id, kind: "element", rect: input.rect, rank: input.rank });
  }
  return targets;
}

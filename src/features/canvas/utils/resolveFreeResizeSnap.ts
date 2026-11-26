import type { Rect } from "@/features/canvas/utils/freeLayoutFrame";
import {
  edgeCoordinate,
  NO_SNAP_LOCK,
  resolveSnap,
  SNAP_EPSILON,
  SNAP_LOCK_SWITCH_MARGIN_SCREEN_PX,
  type SnapAdjust,
  type SnapAxis,
  type SnapEdge,
  type SnapIndex,
  type SnapLock,
  type SnapResult,
  type SnapSourceEdges,
  type SnapTarget,
} from "@/features/canvas/utils/snapEngine";
import { computeEqualSpacingCandidates, type SpacingCandidate } from "@/features/canvas/utils/snapEqualSpacing";
import type { FreeLayoutGeometry } from "@/features/editor/types/layout";
import type { ResizeConstraints, ResizeDirection } from "@/features/editor/types/resize";
import type { FreeLayoutBounds } from "@/features/editor/utils/normalizeFreeLayoutGeometry";

/**
 * BC-13.4 — snapping for the eight Free resize handles, on the shared
 * engine (no second engine). Pure: no DOM, no React.
 *
 * - Only the edges the handle controls participate (E → right, W → left,
 *   S → bottom, N → top, corners → one of each); a centre never snaps
 *   during a resize. A snapped candidate moves only that edge: the opposite
 *   edge stays anchored (W/N change position AND size).
 * - Every candidate is validated as a whole stored rectangle: finite values,
 *   the minimum size, the (unchanged) containment rule, and an optional
 *   extra check (the Free-container scaling floor). An invalid candidate is
 *   rejected by the engine, so it is never applied and never drawn as a snap.
 * - Aspect-ratio-locked corners (the existing rule: corners only): a snap on
 *   one axis derives the other dimension from the ratio, anchored on the
 *   handle's opposite corner. Both axes are honoured only when one
 *   ratio-preserving rectangle satisfies both; otherwise ONE axis wins
 *   (closest; the previous winner is kept unless the other is closer by the
 *   switch margin; ties prefer x) and only its guide is reported.
 * - Equal spacing: E/S use "one gap before a pair" (end edge), W/N "one gap
 *   after a pair" (start edge).
 * The visual (snapping) box is the stored rectangle shifted by `offset`
 * (the element's margin / translate): margins never count as size.
 */
export interface FreeResizeSnapRequest {
  direction: ResizeDirection;
  /** The unsnapped stored geometry for this frame (computeFreeChildResizeResult). */
  proposal: FreeLayoutGeometry;
  /** visual position = stored position + offset. */
  offset: { x: number; y: number };
  /** Axes whose rendered size follows the stored size; an axis that doesn't (e.g. content taller than the box) never snaps. */
  axes: { x: boolean; y: boolean };
  containment: FreeLayoutBounds;
  constraints: ResizeConstraints;
  /** width / height when the corner's aspect ratio is locked; null otherwise. */
  aspectRatio: number | null;
  /** An extra validity rule for a candidate stored rectangle. */
  accept?: (geometry: FreeLayoutGeometry) => boolean;
  index: SnapIndex;
  siblingTargets: readonly SnapTarget[];
  enabled: boolean;
  lock: SnapLock;
  /** The axis that won a coupled (ratio-locked) corner last frame. */
  coupledWinner: SnapAxis | null;
}

export interface FreeResizeSnapResult {
  geometry: FreeLayoutGeometry;
  result: SnapResult;
  coupledWinner: SnapAxis | null;
}

export function controlledEdges(direction: ResizeDirection): { x: SnapEdge | null; y: SnapEdge | null } {
  return {
    x: direction.includes("e") ? "end" : direction.includes("w") ? "start" : null,
    y: direction.includes("s") ? "end" : direction.includes("n") ? "start" : null,
  };
}

export function isValidFreeResizeGeometry(
  geometry: FreeLayoutGeometry,
  containment: FreeLayoutBounds,
  constraints: ResizeConstraints,
): boolean {
  const { x, y, width, height } = geometry;
  if (![x, y, width, height].every(Number.isFinite)) return false;
  if (width < constraints.minWidth - SNAP_EPSILON || height < constraints.minHeight - SNAP_EPSILON) return false;
  if (x < -SNAP_EPSILON || y < -SNAP_EPSILON) return false;
  return x + width <= containment.width + SNAP_EPSILON && y + height <= containment.height + SNAP_EPSILON;
}

export function resolveFreeResizeSnap(request: FreeResizeSnapRequest): FreeResizeSnapResult {
  const { direction, offset, containment, constraints, aspectRatio } = request;
  const toVisual = (g: FreeLayoutGeometry): Rect => ({ x: g.x + offset.x, y: g.y + offset.y, width: g.width, height: g.height });
  const toStored = (r: Rect): FreeLayoutGeometry => ({ x: r.x - offset.x, y: r.y - offset.y, width: r.width, height: r.height });
  const controlled = controlledEdges(direction);
  const edges: SnapSourceEdges = {
    x: controlled.x && request.axes.x ? [controlled.x] : [],
    y: controlled.y && request.axes.y ? [controlled.y] : [],
  };
  const coupled = aspectRatio !== null && aspectRatio > 0 && direction.length === 2;

  const adjust: SnapAdjust = (box, axis, edge, delta) => {
    const g = toStored(box);
    const next = { ...g };
    if (axis === "x") {
      if (edge === "end") next.width = g.width + delta;
      else if (edge === "start") {
        next.x = g.x + delta;
        next.width = g.width - delta;
      } else return null;
      if (coupled) {
        next.height = next.width / aspectRatio;
        if (direction.includes("n")) next.y = g.y + g.height - next.height;
      }
    } else {
      if (edge === "end") next.height = g.height + delta;
      else if (edge === "start") {
        next.y = g.y + delta;
        next.height = g.height - delta;
      } else return null;
      if (coupled) {
        next.width = next.height * aspectRatio;
        if (direction.includes("w")) next.x = g.x + g.width - next.width;
      }
    }
    if (!isValidFreeResizeGeometry(next, containment, constraints)) return null;
    if (request.accept && !request.accept(next)) return null;
    return toVisual(next);
  };

  const box = toVisual(request.proposal);
  const spacing = (axis: SnapAxis): SpacingCandidate[] =>
    edges[axis].length > 0 ? computeEqualSpacingCandidates(axis, box, request.siblingTargets) : [];
  const base = { box, index: request.index, enabled: request.enabled, adjust };

  if (!coupled) {
    const result = resolveSnap({ ...base, edges, spacing: [...spacing("x"), ...spacing("y")], lock: request.lock });
    const applied = result.x.applied || result.y.applied;
    return { geometry: applied ? toStored(result.box) : request.proposal, result, coupledWinner: null };
  }

  // Ratio-locked corner: each axis is resolved on its own, then reconciled.
  const rx = resolveSnap({ ...base, edges: { x: edges.x, y: [] }, spacing: spacing("x"), lock: { x: request.lock.x, y: null } });
  const ry = resolveSnap({ ...base, edges: { x: [], y: edges.y }, spacing: spacing("y"), lock: { x: null, y: request.lock.y } });
  const mx = rx.x.match;
  const my = ry.y.match;
  const none = { match: null, applied: false };

  if (mx && my) {
    // One ratio-preserving rectangle on both lines?
    const both = adjust(box, "x", mx.edge, mx.delta);
    if (both && Math.abs(edgeCoordinate(both, "y", my.edge) - my.coordinate) <= SNAP_EPSILON) {
      const final = request.enabled ? both : box;
      return {
        geometry: request.enabled ? toStored(final) : request.proposal,
        result: { box: final, x: rx.x, y: { match: my, applied: request.enabled }, lock: { x: rx.lock.x, y: ry.lock.y } },
        coupledWinner: request.coupledWinner ?? "x",
      };
    }
  }

  let winner: SnapAxis | null = null;
  if (mx && my) {
    const margin = SNAP_LOCK_SWITCH_MARGIN_SCREEN_PX;
    if (request.coupledWinner === "x") winner = my.distance < mx.distance - margin ? "y" : "x";
    else if (request.coupledWinner === "y") winner = mx.distance < my.distance - margin ? "x" : "y";
    else winner = my.distance < mx.distance ? "y" : "x";
  } else if (mx) winner = "x";
  else if (my) winner = "y";

  if (winner === "x") {
    return { geometry: request.enabled ? toStored(rx.box) : request.proposal, result: { box: rx.box, x: rx.x, y: none, lock: { x: rx.lock.x, y: null } }, coupledWinner: "x" };
  }
  if (winner === "y") {
    return { geometry: request.enabled ? toStored(ry.box) : request.proposal, result: { box: ry.box, x: none, y: ry.y, lock: { x: null, y: ry.lock.y } }, coupledWinner: "y" };
  }
  return { geometry: request.proposal, result: { box, x: none, y: none, lock: NO_SNAP_LOCK }, coupledWinner: null };
}

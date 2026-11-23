import type { Rect } from "@/features/canvas/utils/freeLayoutFrame";
import type { SnapAxis, SnapEdge, SnapTarget } from "@/features/canvas/utils/snapEngine";

/**
 * BC-13.2 — equal-spacing candidates (D13/D14), a pure generator feeding
 * the same engine (resolveSnap's `spacing` input), so equal spacing uses the
 * same threshold, validation, ranking and lock as alignment instead of a
 * parallel system.
 *
 * Unlike an alignment line (any edge of the moving box may land on it), a
 * spacing candidate fixes WHICH edge lands WHERE, because the gap is
 * measured from a specific side:
 * - "repeat-after":  the moving box's start sits one gap after B (A ▢ B ▢ [moving]);
 * - "repeat-before": the moving box's end sits one gap before A ([moving] ▢ A ▢ B);
 * - "center-between": the moving box's centre is midway between P and Q, so
 *   both gaps are equal (P ▢ [moving] ▢ Q).
 * Only boxes that overlap the moving box on the PERPENDICULAR axis take part
 * (a row of boxes for x, a column for y). Gaps must be strictly positive:
 * overlapping or touching boxes never define a spacing (D14).
 */
export type SpacingMode = "repeat-after" | "repeat-before" | "center-between";

export interface SpacingCandidate {
  axis: SnapAxis;
  mode: SpacingMode;
  /** The moving box's edge that must land on `coordinate`. */
  sourceEdge: SnapEdge;
  coordinate: number;
  /** The equal gap (local px), > 0. */
  gap: number;
  /** The boxes whose existing gap is repeated, or the two neighbours the moving box is centred between. */
  referenceIds: [string, string];
}

/** The minimum meaningful gap (local px). */
export const MIN_SPACING_GAP = 0.5;

interface Span {
  id: string;
  start: number;
  end: number;
}

function along(rect: Rect, axis: SnapAxis): { start: number; end: number } {
  return axis === "x" ? { start: rect.x, end: rect.x + rect.width } : { start: rect.y, end: rect.y + rect.height };
}

function across(rect: Rect, axis: SnapAxis): { start: number; end: number } {
  return along(rect, axis === "x" ? "y" : "x");
}

/**
 * Candidates for a moving box of `size` along `axis`, whose perpendicular
 * extent is `moving` (only its cross-axis span is read). `targets` are
 * element targets (parent excluded), already eligibility-filtered and
 * without the moving element.
 */
export function computeEqualSpacingCandidates(axis: SnapAxis, moving: Rect, targets: readonly SnapTarget[]): SpacingCandidate[] {
  const cross = across(moving, axis);
  const size = axis === "x" ? moving.width : moving.height;
  const spans: Span[] = targets
    .filter((target) => target.kind === "element")
    .filter((target) => {
      const span = across(target.rect, axis);
      return span.start < cross.end && cross.start < span.end;
    })
    .map((target) => ({ id: target.id, ...along(target.rect, axis) }))
    .sort((a, b) => a.start - b.start || a.end - b.end || (a.id < b.id ? -1 : 1));

  const candidates: SpacingCandidate[] = [];
  const seen = new Set<string>();
  const add = (candidate: SpacingCandidate) => {
    const key = `${candidate.mode}:${candidate.sourceEdge}:${candidate.coordinate.toFixed(6)}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(candidate);
  };

  for (let i = 0; i + 1 < spans.length; i++) {
    const a = spans[i];
    const b = spans[i + 1];
    const gap = b.start - a.end;
    if (gap < MIN_SPACING_GAP) continue; // overlapping or touching: no meaningful spacing
    add({ axis, mode: "repeat-after", sourceEdge: "start", coordinate: b.end + gap, gap, referenceIds: [a.id, b.id] });
    add({ axis, mode: "repeat-before", sourceEdge: "end", coordinate: a.start - gap, gap, referenceIds: [a.id, b.id] });
    const centredGap = (gap - size) / 2;
    if (centredGap >= MIN_SPACING_GAP) {
      add({ axis, mode: "center-between", sourceEdge: "center", coordinate: (a.end + b.start) / 2, gap: centredGap, referenceIds: [a.id, b.id] });
    }
  }
  return candidates;
}

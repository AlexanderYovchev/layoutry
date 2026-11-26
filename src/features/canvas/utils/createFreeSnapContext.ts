import { collectFreeSnapTargets } from "@/features/canvas/utils/collectFreeSnapTargets";
import { clientRectToLocal, freeChildRenderedRect, measureFreeContainerFrame, type FreeContainerFrame, type Rect } from "@/features/canvas/utils/freeLayoutFrame";
import { buildSnapIndex, type SnapIndex, type SnapResult, type SnapTarget } from "@/features/canvas/utils/snapEngine";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { FreeLayoutGeometry } from "@/features/editor/types/layout";
import { getElementSpacing } from "@/features/editor/types/spacing";

/**
 * BC-13.3/13.4: everything snapping needs for one Free drag or resize,
 * measured ONCE at pointer-down (never per pointer move). Shared by
 * useFreeChildMoveSession and useFreeChildResizeSession.
 */
export interface FreeSnapContext {
  containerId: string;
  index: SnapIndex;
  rectById: Map<string, Rect>;
  /** Direct Free siblings: the boxes equal spacing is measured among. */
  siblingTargets: SnapTarget[];
  parentRect: Rect;
  /**
   * visual box = stored geometry + this offset: the element's own margin
   * (freeChildStyle) and, for a transformed element, the difference between
   * its untransformed box and its visible axis-aligned bounds (D23).
   */
  offset: Rect;
  /** The element's measured visible box in the local frame, or null when it isn't laid out (e.g. jsdom). */
  measured: Rect | null;
}

export function createFreeSnapContext(
  containerEl: HTMLElement,
  frame: FreeContainerFrame,
  document: EditorElementNode,
  containerId: string,
  node: EditorElementNode & { freeLayout: FreeLayoutGeometry },
  targetEl: HTMLElement,
): FreeSnapContext {
  const collected = collectFreeSnapTargets(containerEl, frame, document, containerId, node.id);
  const stored = node.freeLayout;
  const visible = clientRectToLocal(targetEl.getBoundingClientRect(), frame);
  // Degenerate measurements (not laid out): fall back to the margin only.
  const measured = visible.width > 0 || visible.height > 0 ? visible : null;
  const rendered = freeChildRenderedRect(stored, getElementSpacing(node).margin);
  const offset: Rect = measured
    ? { x: measured.x - stored.x, y: measured.y - stored.y, width: measured.width - stored.width, height: measured.height - stored.height }
    : { x: rendered.x - stored.x, y: rendered.y - stored.y, width: 0, height: 0 };
  return {
    containerId,
    index: buildSnapIndex(collected.targets),
    rectById: collected.rectById,
    siblingTargets: collected.siblingTargets,
    parentRect: collected.parentRect,
    offset,
    measured,
  };
}

/** BC-13.5: the target ids a frame's snap result relies on (alignment references and spacing pairs) — what target invalidation watches. */
export function referencedTargetIds(result: SnapResult): string[] {
  const ids = new Set<string>();
  for (const axis of [result.x, result.y]) {
    const match = axis.match;
    if (!match) continue;
    for (const reference of match.line?.references ?? []) ids.add(reference.targetId);
    for (const id of match.spacing?.referenceIds ?? []) ids.add(id);
  }
  return [...ids];
}

/**
 * BC-13.6: the snap context for a box that isn't an element yet (a Resource
 * Panel insertion preview): the same targets and eligibility as a drag (the
 * whole container, nothing excluded), with the new element's own margin as
 * the visual offset.
 */
export function createFreeInsertionSnapContext(
  containerEl: HTMLElement,
  frame: FreeContainerFrame,
  document: EditorElementNode,
  containerId: string,
  margin: { left?: number; top?: number },
): FreeSnapContext {
  const collected = collectFreeSnapTargets(containerEl, frame, document, containerId, "");
  return {
    containerId,
    index: buildSnapIndex(collected.targets),
    rectById: collected.rectById,
    siblingTargets: collected.siblingTargets,
    parentRect: collected.parentRect,
    offset: { x: margin.left ?? 0, y: margin.top ?? 0, width: 0, height: 0 },
    measured: null,
  };
}

/** A referenced target that moved more than this (px) invalidates the snap snapshot. */
const TARGET_MOVE_TOLERANCE_PX = 0.5;

function rectsClose(a: Rect | undefined, b: Rect): boolean {
  if (!a) return false;
  const t = TARGET_MOVE_TOLERANCE_PX;
  return Math.abs(a.x - b.x) <= t && Math.abs(a.y - b.y) <= t && Math.abs(a.width - b.width) <= t && Math.abs(a.height - b.height) <= t;
}

/**
 * BC-13.5 (shared since BC-13.6): whether any target the current snap result
 * relies on (or the parent's padding box) moved, resized, was hidden or
 * vanished since the snap context was measured — re-measures only those
 * (1–3) elements, never the whole container.
 */
export function snapReferencesChanged(snap: FreeSnapContext, containerEl: HTMLElement, references: readonly string[]): boolean {
  if (references.length === 0) return false;
  const frame = measureFreeContainerFrame(containerEl);
  for (const id of references) {
    if (id === snap.containerId) {
      if (Math.abs(frame.paddingBox.width - snap.parentRect.width) > TARGET_MOVE_TOLERANCE_PX || Math.abs(frame.paddingBox.height - snap.parentRect.height) > TARGET_MOVE_TOLERANCE_PX) return true;
      continue;
    }
    const el = containerEl.querySelector(`[data-node-id="${CSS.escape(id)}"]`);
    if (!el) return true;
    if (!rectsClose(snap.rectById.get(id), clientRectToLocal(el.getBoundingClientRect(), frame))) return true;
  }
  return false;
}

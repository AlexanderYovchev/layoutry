import { collectFreeSnapTargets } from "@/features/canvas/utils/collectFreeSnapTargets";
import { clientRectToLocal, freeChildRenderedRect, type FreeContainerFrame, type Rect } from "@/features/canvas/utils/freeLayoutFrame";
import { buildSnapIndex, type SnapIndex, type SnapTarget } from "@/features/canvas/utils/snapEngine";
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

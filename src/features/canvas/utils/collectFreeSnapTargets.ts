import { clientRectToLocal, type FreeContainerFrame, type Rect } from "@/features/canvas/utils/freeLayoutFrame";
import { parentSnapTarget, selectSnapTargets, type SnapTarget, type SnapTargetInput } from "@/features/canvas/utils/snapEngine";
import type { EditorElementNode } from "@/features/editor/types/document";
import { findNodeById } from "@/features/editor/utils/findNodeById";
import { isNodeAuthoredHidden } from "@/features/editor/utils/isNodeAuthoredHidden";

/**
 * BC-13.3 — the snapping targets for a Free child's drag, measured ONCE at
 * pointer-down (never per pointer event):
 * - the parent Free container's padding box (edges + centre);
 * - every rendered document element INSIDE that container except the
 *   dragged element and its own subtree — direct Free siblings, nested
 *   descendants at any depth, Flow/Flex/Grid children (reference only;
 *   nothing is ever written to them), style-locked elements;
 * - each measured as its visible border box (getBoundingClientRect: margins
 *   excluded, transforms as axis-aligned bounds) converted into the
 *   container's local frame.
 * Excluded: authored-hidden elements (display:none / visibility:hidden,
 * isNodeAuthoredHidden) and elements with no visible part: each target is
 * intersected with every clipping ancestor (overflow ≠ visible, including
 * the Workspace scroll area) and the window; a target with no visible part
 * is dropped, a partly visible one kept (D19).
 * Ranks follow DOCUMENT order (a traversal of the container's subtree),
 * never DOM query order.
 */
export interface FreeSnapTargets {
  /** Parent + eligible elements, for buildSnapIndex. */
  targets: SnapTarget[];
  /** Local border boxes by id (guide extents, distances, spacing). */
  rectById: Map<string, Rect>;
  /** The eligible DIRECT Free siblings only: equal spacing is measured among them (nested boxes never define a row's spacing). */
  siblingTargets: SnapTarget[];
  /** The parent target's local rect (its padding box). */
  parentRect: Rect;
}

function intersect(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  if (right < x || bottom < y) return null;
  return { x, y, width: right - x, height: bottom - y };
}

/** An element's clipping rect (its padding box, client space) when it clips its content, else null. Cached per gesture. */
function clipRectOf(element: HTMLElement, cache: Map<HTMLElement, Rect | null>): Rect | null {
  const cached = cache.get(element);
  if (cached !== undefined) return cached;
  const style = getComputedStyle(element);
  let clip: Rect | null = null;
  if (style.overflowX !== "visible" || style.overflowY !== "visible") {
    const rect = element.getBoundingClientRect();
    clip = { x: rect.left + element.clientLeft, y: rect.top + element.clientTop, width: element.clientWidth, height: element.clientHeight };
  }
  cache.set(element, clip);
  return clip;
}

export function collectFreeSnapTargets(
  containerEl: HTMLElement,
  frame: FreeContainerFrame,
  documentModel: EditorElementNode,
  containerId: string,
  movingId: string,
): FreeSnapTargets {
  const containerNode = findNodeById(documentModel, containerId);
  const rank = new Map<string, number>();
  const visit = (node: EditorElementNode) => {
    for (const child of node.children ?? []) {
      rank.set(child.id, rank.size);
      visit(child);
    }
  };
  if (containerNode) visit(containerNode);
  const directChildIds = new Set((containerNode?.children ?? []).map((child) => child.id));

  const movingEl = containerEl.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(movingId)}"]`);
  const clipCache = new Map<HTMLElement, Rect | null>();
  const windowRect: Rect = { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
  const inputs: SnapTargetInput[] = [];
  const rectById = new Map<string, Rect>();

  for (const element of containerEl.querySelectorAll<HTMLElement>("[data-node-id]")) {
    const id = element.getAttribute("data-node-id");
    if (!id || !rank.has(id) || id === movingId || movingEl?.contains(element)) continue;
    const client = element.getBoundingClientRect();
    // Not laid out at all (e.g. inside a closed dialog): a 0×0 box at the origin, never a target.
    if (client.width === 0 && client.height === 0) continue;
    const rect = clientRectToLocal(client, frame);
    // The visible region: the window, cut by every clipping ancestor up to the document.
    let visible: Rect | null = windowRect;
    for (let ancestor = element.parentElement; ancestor && visible; ancestor = ancestor.parentElement) {
      const clip = clipRectOf(ancestor, clipCache);
      if (clip) visible = intersect(visible, clip);
    }
    const visibleRegion = visible ? clientRectToLocal({ left: visible.x, top: visible.y, width: visible.width, height: visible.height }, frame) : { x: 0, y: 0, width: -1, height: -1 };
    rectById.set(id, rect);
    inputs.push({ id, rect, rank: rank.get(id) ?? 0, hidden: isNodeAuthoredHidden(documentModel, id) === true, visibleRegion });
  }

  const elements = selectSnapTargets(inputs, new Set());
  const parent = parentSnapTarget(containerId, frame.paddingBox);
  return {
    targets: [parent, ...elements],
    rectById,
    siblingTargets: elements.filter((target) => directChildIds.has(target.id)),
    parentRect: parent.rect,
  };
}

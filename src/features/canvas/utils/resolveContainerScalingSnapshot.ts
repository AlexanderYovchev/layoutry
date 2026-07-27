import { measureFreeContainerBounds } from "@/features/canvas/utils/measureFreeContainerBounds";
import type { ContainerChildSnapshot } from "@/features/canvas/utils/computeContainerChildScaling";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { findNodeById } from "@/features/editor/utils/findNodeById";
import { getLayoutMode, resolveChildResizePolicy } from "@/features/editor/types/layout";
import type { ChildResizePolicy } from "@/features/editor/types/layout";
import type { FreeLayoutBounds } from "@/features/editor/utils/normalizeFreeLayoutGeometry";

export interface ContainerScalingSnapshot {
  containerId: string;
  /** Measured once at pointer-down (see measureFreeContainerBounds) — never re-measured mid-drag. */
  startContentBounds: FreeLayoutBounds;
  /** Border + padding, a fixed pixel amount for the whole drag — converts between the outer size a resize handle manipulates and the inner content bounds children are positioned against. */
  outerToContentInset: { width: number; height: number };
  policy: ChildResizePolicy;
  children: ContainerChildSnapshot[];
}

/**
 * Resolved once at pointer-down (by both useResizeSession and
 * useFreeChildResizeSession — Checkpoint 3.4.4) for whichever node is
 * being resized: null unless that node is itself a Free container with
 * at least one direct child, in which case its resize must also
 * proportionally scale/clamp those children (see
 * computeContainerChildScaling). A plain function, not a hook — reads
 * the store directly via getState(), same pattern the sessions'
 * pointer-down handlers already use for per-tag constraints.
 */
export function resolveContainerScalingSnapshot(
  targetEl: HTMLElement | null,
  outerWidth: number,
  outerHeight: number,
): ContainerScalingSnapshot | null {
  if (!targetEl) return null;
  const nodeId = targetEl.getAttribute("data-node-id");
  if (!nodeId) return null;

  const node = findNodeById(useEditorStore.getState().document, nodeId);
  if (!node || getLayoutMode(node) !== "free" || !node.children || node.children.length === 0) {
    return null;
  }

  const startContentBounds = measureFreeContainerBounds(targetEl);
  const outerToContentInset = {
    width: outerWidth - startContentBounds.width,
    height: outerHeight - startContentBounds.height,
  };

  const children: ContainerChildSnapshot[] = node.children
    .filter((child) => child.freeLayout)
    .map((child) => ({ id: child.id, tag: child.tag, geometry: child.freeLayout! }));

  return {
    containerId: nodeId,
    startContentBounds,
    outerToContentInset,
    policy: resolveChildResizePolicy(node),
    children,
  };
}

import { canContainChildren } from "@/features/editor/rules/insertionRules";
import { getResizeConstraintsForTag } from "@/features/editor/types/layout";
import type { ElementDimensions, EditorElementNode } from "@/features/editor/types/document";
import type { ChildResizePolicy, FreeLayoutGeometry } from "@/features/editor/types/layout";

/**
 * Free-layout-mode document commands (Checkpoint 3.4.4) — the counterpart
 * to documentCommands.ts's resizeNode/moveNode, sharing the same
 * immutable/structural-sharing shape: every command returns a new root
 * only along the path that actually changed, and a rejected/no-op call
 * returns the exact same root reference. Kept in their own file rather
 * than folded into documentCommands.ts since Free-layout geometry is a
 * cohesive, sizeable concern of its own (mirrors resizeNode's tag-capable
 * defensive clamp, but for freeLayout instead of dimensions).
 */

/** Replaces exactly one node's Free-layout geometry. A no-op if nodeId doesn't exist. Width/height floor at the tag's own minimum (see resizeNode's identical minimum-only defensive clamp) — bounds against the live parent content box are the live session's job, already applied before this is ever called. */
export function setFreeChildGeometry(
  root: EditorElementNode,
  nodeId: string,
  geometry: FreeLayoutGeometry,
): EditorElementNode {
  if (root.id === nodeId) {
    const constraints = getResizeConstraintsForTag();
    const safeGeometry: FreeLayoutGeometry = {
      x: geometry.x,
      y: geometry.y,
      width: Math.max(constraints.minWidth, geometry.width),
      height: Math.max(constraints.minHeight, geometry.height),
    };
    return { ...root, freeLayout: safeGeometry };
  }

  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = setFreeChildGeometry(child, nodeId, geometry);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}

export interface FreeContainerSelfUpdate {
  dimensions?: ElementDimensions;
  freeLayout?: FreeLayoutGeometry;
}

/**
 * Updates a Free container's own geometry and its direct children's
 * freeLayout in a single tree pass — one atomic write per resize frame,
 * so a whole proportional-scaling drag (see computeContainerChildScaling)
 * never risks the container and its children momentarily disagreeing
 * mid-render. selfUpdate.dimensions applies when containerId is itself a
 * Flow child; selfUpdate.freeLayout when it's itself a Free child —
 * exactly one of the two is expected to be set, mirroring how a node only
 * ever has one geometry source active at a time (see EditorElementNode).
 * A no-op (same reference) if containerId doesn't exist.
 */
export function applyFreeContainerChildGeometries(
  root: EditorElementNode,
  containerId: string,
  selfUpdate: FreeContainerSelfUpdate,
  childGeometries: Record<string, FreeLayoutGeometry>,
): EditorElementNode {
  if (root.id === containerId) {
    const children = root.children?.map((child) => {
      const childGeometry = childGeometries[child.id];
      return childGeometry ? { ...child, freeLayout: childGeometry } : child;
    });

    return {
      ...root,
      ...(selfUpdate.dimensions ? { dimensions: selfUpdate.dimensions } : {}),
      ...(selfUpdate.freeLayout ? { freeLayout: selfUpdate.freeLayout } : {}),
      ...(children ? { children } : {}),
    };
  }

  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = applyFreeContainerChildGeometries(
      child,
      containerId,
      selfUpdate,
      childGeometries,
    );
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}

/**
 * Flow -> Free conversion: sets layoutMode "free" (defaulting
 * childResizePolicy to "scale", the checkpoint's required default for
 * new Free containers, unless one was already explicitly set — e.g. by
 * converting back and forth), each direct child's freeLayout, and —
 * critically — the container's *own* current rendered size (selfUpdate,
 * already measured by the caller alongside the children — see
 * useConvertContainerToFreeLayout). Without this, the container would
 * visually collapse the instant its children switch to position:
 * absolute, since absolutely-positioned children no longer contribute to
 * their parent's auto-height — exactly the "preserve the existing visual
 * composition" requirement this conversion exists to satisfy. A no-op if
 * containerId doesn't exist or can't contain children.
 */
export function convertToFreeLayout(
  root: EditorElementNode,
  containerId: string,
  childGeometries: Record<string, FreeLayoutGeometry>,
  selfUpdate?: FreeContainerSelfUpdate,
): EditorElementNode {
  if (root.id === containerId) {
    if (!canContainChildren(root.tag)) return root;
    const children = root.children?.map((child) => {
      const childGeometry = childGeometries[child.id];
      return childGeometry ? { ...child, freeLayout: childGeometry } : child;
    });

    return {
      ...root,
      layoutMode: "free",
      childResizePolicy: root.childResizePolicy ?? "scale",
      ...(selfUpdate?.dimensions ? { dimensions: selfUpdate.dimensions } : {}),
      ...(selfUpdate?.freeLayout ? { freeLayout: selfUpdate.freeLayout } : {}),
      ...(children ? { children } : {}),
    };
  }

  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = convertToFreeLayout(child, containerId, childGeometries, selfUpdate);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}

/**
 * Free -> Flow conversion: sets layoutMode "flow", clears every direct
 * child's freeLayout (Free position data is archived by simply dropping
 * it — a later Flow -> Free trip re-measures fresh rather than reviving
 * stale coordinates), and — only for a child with no dimensions of its
 * own yet — seeds dimensions from its former freeLayout width/height so
 * visual size survives the round-trip (offsetX/Y: 0, since flow position
 * is now purely document-order, no anchor compensation needed). Document
 * order is untouched: Free mode never reorders the tree, only overlays
 * position data on top of it.
 */
export function convertToFlowLayout(
  root: EditorElementNode,
  containerId: string,
): EditorElementNode {
  if (root.id === containerId) {
    const children = root.children?.map((child) => {
      if (!child.freeLayout) return child;
      const { freeLayout, ...rest } = child;
      const dimensions: ElementDimensions =
        rest.dimensions ??
        ({
          preferredWidth: freeLayout.width,
          preferredHeight: freeLayout.height,
          offsetX: 0,
          offsetY: 0,
        } satisfies ElementDimensions);
      return { ...rest, dimensions };
    });

    return {
      ...root,
      layoutMode: "flow",
      ...(children ? { children } : {}),
    };
  }

  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = convertToFlowLayout(child, containerId);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}

/** Sets a Free container's own child-resize policy. A no-op if containerId doesn't exist. */
export function setChildResizePolicyForNode(
  root: EditorElementNode,
  containerId: string,
  policy: ChildResizePolicy,
): EditorElementNode {
  if (root.id === containerId) {
    return { ...root, childResizePolicy: policy };
  }

  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = setChildResizePolicyForNode(child, containerId, policy);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}

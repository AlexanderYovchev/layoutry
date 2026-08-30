import { normalizeFreeLayoutGeometry, type FreeLayoutBounds } from "@/features/editor/utils/normalizeFreeLayoutGeometry";
import { getResizeConstraintsForTag, MIN_FREE_CONTAINER_SCALE } from "@/features/editor/types/layout";
import type { ChildResizePolicy, FreeLayoutGeometry } from "@/features/editor/types/layout";

export interface ContainerChildSnapshot {
  id: string;
  tag: string;
  /** The child's freeLayout at the moment the container's resize session began — every frame derives from this, never from the previous frame's output (see computeContainerChildScaling). */
  geometry: FreeLayoutGeometry;
}

/**
 * Proportionally scales (policy "scale") or re-clamps (policy "clamp")
 * every direct child of a Free container being resized (Checkpoint
 * 3.4.4). Always computed from the session-start snapshot
 * (startBounds/children) against the container's *current* content
 * bounds — never compounding frame over frame, the same reasoning
 * computeResizeResult/computeFreeChildResizeResult already follow.
 *
 * Scale: every child's x/y/width/height is multiplied by the same
 * scaleX/scaleY, so relative composition is preserved exactly; no
 * additional per-child minimum-size clamp is applied here — the
 * *container's* own achievable resize is what's floored (see
 * deriveFlooredContainerOuterSize's MIN_FREE_CONTAINER_SCALE), which is
 * what keeps content from scaling below readability, without breaking
 * proportionality by clamping one child independently of its siblings.
 *
 * Clamp: children keep their session-start size/position, each
 * independently re-clamped (via normalizeFreeLayoutGeometry, respecting
 * that child's own tag minimum) into the new — possibly smaller —
 * bounds; this can shrink a child that no longer fits, exactly as the
 * checkpoint spec describes.
 */
export function computeContainerChildScaling(
  children: ContainerChildSnapshot[],
  startBounds: FreeLayoutBounds,
  newBounds: FreeLayoutBounds,
  policy: ChildResizePolicy,
): Record<string, FreeLayoutGeometry> {
  const result: Record<string, FreeLayoutGeometry> = {};

  if (policy === "clamp") {
    for (const child of children) {
      result[child.id] = normalizeFreeLayoutGeometry(
        child.geometry,
        newBounds,
        getResizeConstraintsForTag(),
      );
    }
    return result;
  }

  const scaleX = startBounds.width > 0 ? newBounds.width / startBounds.width : 1;
  const scaleY = startBounds.height > 0 ? newBounds.height / startBounds.height : 1;

  for (const child of children) {
    result[child.id] = {
      x: child.geometry.x * scaleX,
      y: child.geometry.y * scaleY,
      width: child.geometry.width * scaleX,
      height: child.geometry.height * scaleY,
    };
  }
  return result;
}

/**
 * Floors a Free container's own requested outer width/height so its
 * content box never scales below MIN_FREE_CONTAINER_SCALE (0.25) of its
 * session-start content size — "if reaching the minimum scale would
 * require a smaller parent, stop the container resize" (Checkpoint
 * 3.4.4), rather than letting children shrink past readability. Growing
 * (or any resize that doesn't cross the floor) passes through untouched,
 * since Math.max only ever intervenes when the requested size is smaller
 * than the floor. outerToContentInset (border + padding, a fixed pixel
 * amount that doesn't itself scale) converts between the outer size a
 * resize handle actually manipulates and the inner content bounds
 * children are positioned against.
 */
export function deriveFlooredContainerOuterSize(
  requestedOuterWidth: number,
  requestedOuterHeight: number,
  startContentBounds: FreeLayoutBounds,
  outerToContentInset: { width: number; height: number },
): { width: number; height: number } {
  const requestedContentWidth = requestedOuterWidth - outerToContentInset.width;
  const requestedContentHeight = requestedOuterHeight - outerToContentInset.height;

  const flooredContentWidth = Math.max(requestedContentWidth, startContentBounds.width * MIN_FREE_CONTAINER_SCALE);
  const flooredContentHeight = Math.max(
    requestedContentHeight,
    startContentBounds.height * MIN_FREE_CONTAINER_SCALE,
  );

  return {
    width: flooredContentWidth + outerToContentInset.width,
    height: flooredContentHeight + outerToContentInset.height,
  };
}

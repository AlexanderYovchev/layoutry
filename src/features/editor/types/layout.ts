import { DEFAULT_RESIZE_CONSTRAINTS, type ResizeConstraints } from "@/features/editor/types/resize";

/**
 * How a container arranges its direct children: normal document flow, or
 * independent free-form positioning (Checkpoint 3.4.4). Absent on a node
 * means "flow" — see getLayoutMode.
 */
export type ContainerLayoutMode = "flow" | "free";

/**
 * How a Free container's direct children respond when the container
 * itself is resized. Only meaningful when the container's layoutMode is
 * "free"; absent means "scale" (the required default for new Free
 * containers — see resolveChildResizePolicy).
 */
export type ChildResizePolicy = "clamp" | "scale";

/**
 * One Free-mode child's position and size, in pixels relative to its
 * parent's content box (border and padding already excluded). Only
 * meaningful while the node is a direct child of a "free" layoutMode
 * parent — deliberately a separate field from ElementDimensions rather
 * than a repurposing of it, since Flow's offsetX/offsetY margin trick has
 * no meaning here (a Free child is positioned with left/top, not margin).
 */
export interface FreeLayoutGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Reuses the same shape as the live resize session's ResizeConstraints — a minimum size floor. */
export type ElementResizeConstraints = ResizeConstraints;

/**
 * The single place a node's minimum resizable size is decided (Checkpoint
 * 1.12.1). Previously this returned a bigger, per-tag-category floor for
 * container tags (e.g. a div floored at 160x120, a section at 240x160) —
 * that made a container's *creation* size read as an artificial minimum
 * size, which manual QA flagged as a bug: a factory's initial dimensions
 * are only a starting point, never a floor. Every tag now shares the same
 * small, generic DEFAULT_RESIZE_CONSTRAINTS floor — just enough to keep
 * geometry valid, never a component-specific minimum. No longer takes a
 * tag at all — nothing about the answer varies by tag any more, so
 * keeping an unused parameter "for later" would just be dead API surface
 * (every call site below was updated to call this with no arguments).
 */
export function getResizeConstraintsForTag(): ElementResizeConstraints {
  return DEFAULT_RESIZE_CONSTRAINTS;
}

/**
 * Below this fraction of its starting size, a Free container's children
 * would become effectively unreadable — see computeContainerChildScaling,
 * which floors the container's own achievable resize so this is never
 * crossed rather than letting content shrink past it.
 */
export const MIN_FREE_CONTAINER_SCALE = 0.25;

/** A container with no explicit layoutMode renders/behaves as "flow" — the pre-3.4.4 default. */
export function getLayoutMode(node: { layoutMode?: ContainerLayoutMode }): ContainerLayoutMode {
  return node.layoutMode ?? "flow";
}

/** A Free container with no explicit policy defaults to "scale" — the checkpoint's required default for new Free containers. */
export function resolveChildResizePolicy(node: {
  childResizePolicy?: ChildResizePolicy;
}): ChildResizePolicy {
  return node.childResizePolicy ?? "scale";
}

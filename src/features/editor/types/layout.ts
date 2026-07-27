import { canContainChildren } from "@/features/editor/rules/insertionRules";
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
 * Minimum size for container tags, keyed by tag (Checkpoint 3.4.4 —
 * "containers must never become a line or unusably small rectangle").
 * "section" and "div" already exist as distinct tags in the document
 * model (see fixtureDocument.ts / documentNodeComponents.ts) — no new
 * element type is introduced for this. Any other container tag
 * (form/ul/ol/li/header/footer/main/article/aside/nav/table) falls back
 * to the same floor as "div".
 */
const CONTAINER_RESIZE_CONSTRAINTS_BY_TAG: Record<string, ElementResizeConstraints> = {
  section: { minWidth: 240, minHeight: 160 },
  div: { minWidth: 160, minHeight: 120 },
};

const DEFAULT_CONTAINER_RESIZE_CONSTRAINTS: ElementResizeConstraints = { minWidth: 160, minHeight: 120 };

/**
 * The single place a node's minimum resizable size is decided: a
 * container-tagged node gets its (bigger) container floor, any other
 * (leaf) tag keeps the original global DEFAULT_RESIZE_CONSTRAINTS
 * (64x64). Replaces the previous single hardcoded constant used
 * uniformly by resizeNode and the live resize session.
 */
export function getResizeConstraintsForTag(tag: string): ElementResizeConstraints {
  if (!canContainChildren(tag)) return DEFAULT_RESIZE_CONSTRAINTS;
  return CONTAINER_RESIZE_CONSTRAINTS_BY_TAG[tag] ?? DEFAULT_CONTAINER_RESIZE_CONSTRAINTS;
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

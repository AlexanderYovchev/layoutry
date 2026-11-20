import { setAspectRatio } from "@/features/editor/commands/aspectRatioCommands";
import { setElementDimensions } from "@/features/editor/commands/documentCommands";
import { setFlowDisplayMode } from "@/features/editor/commands/flowLayoutCommands";
import { setFreeChildGeometry } from "@/features/editor/commands/layoutCommands";
import { setMediaFitSettings } from "@/features/editor/commands/mediaFitCommands";
import { applySectionSettings } from "@/features/editor/commands/sectionSettingsCommands";
import { setElementShape } from "@/features/editor/commands/shapeCommands";
import { setSizeConstraints } from "@/features/editor/commands/sizeConstraintsCommands";
import { setSvgFill, setSvgStroke, setSvgStrokeWidth } from "@/features/editor/commands/svgCommands";
import { getElementCapabilities, type ElementCapabilities } from "@/features/editor/rules/elementCapabilities";
import { canContainChildren } from "@/features/editor/rules/insertionRules";
import { editorElementNodeSchema } from "@/features/editor/schemas/editorDocumentSchema";
import type { BorderSettings } from "@/features/editor/types/border";
import type { EditorElementNode } from "@/features/editor/types/document";
import { getFlowLayoutSettings, type FlowDisplayMode } from "@/features/editor/types/flowLayout";
import { getLayoutMode } from "@/features/editor/types/layout";
import type { StyleGroupKey, StyleSnapshot } from "@/features/editor/types/styleClipboard";
import { approximateFreeContainerSize } from "@/features/editor/utils/approximateFreeContainerSize";
import { findNodeById, findParentId } from "@/features/editor/utils/findNodeById";

/**
 * BC-11.2 — Copy/Paste CSS: the CSS group registry, the authored snapshot
 * and the merge-paste, as pure document functions.
 *
 * Every group maps to the element settings the matching Inspector section
 * owns, is offered on a destination by the SAME rules the Inspector uses
 * (getElementCapabilities plus the Inspector's per-node rules: no Position
 * on a Free child/container, Flex/Grid child settings only under a
 * Flex/Grid parent, content layout only on a container), and is written
 * through the same commands the Inspector writes through (BC-10.4
 * applySectionSettings and the per-field commands), so validation,
 * clamping and rendering are identical.
 *
 * NOT CSS, so never copied: ids, the authored HTML id, class names, the
 * tag, text and form values, link destinations, media sources,
 * interactions, Preview visibility, style locks, component markers and
 * accessibility fields, an SVG's primitive/viewBox/drawn content, children
 * and the parent, a Free child's x/y position (placement), and editor-only
 * resize preferences (aspectRatioLocked).
 */

/** What a destination looks like to the group rules. */
interface Destination {
  node: EditorElementNode;
  parent: EditorElementNode | undefined;
  capabilities: ElementCapabilities;
  isFreeChild: boolean;
  isFreeContainer: boolean;
  parentFlowDisplay: FlowDisplayMode;
}

/** A group's write: the next document, or "invalid" (refuses the whole paste). */
type GroupWrite = EditorElementNode | "invalid";

interface StyleGroup<K extends StyleGroupKey> {
  label: string;
  /** The source's authored value for this group, deep-cloned; undefined if it authored nothing here. */
  capture: (document: EditorElementNode, node: EditorElementNode) => StyleSnapshot[K] | undefined;
  /** Whether this destination has this group (the Inspector shows the section for it). */
  supports: (destination: Destination, value: NonNullable<StyleSnapshot[K]>) => boolean;
  /** Merges `value` into the destination: the source's fields replace the same fields; others are kept. */
  apply: (root: EditorElementNode, destination: Destination, value: NonNullable<StyleSnapshot[K]>) => GroupWrite;
}

/** The defined top-level fields of `value`, as a fresh deep copy; undefined when none. */
function authored<T extends object>(value: T | undefined): T | undefined {
  if (!value) return undefined;
  const copy = structuredClone(value);
  let any = false;
  for (const key in copy) {
    if (copy[key] === undefined) delete copy[key];
    else any = true;
  }
  return any ? copy : undefined;
}

/** An element's own fields (not its children), for no-op detection: several per-field commands return a new object even for an identical value. */
function ownFields(node: EditorElementNode | undefined): string {
  return JSON.stringify(node ? { ...node, children: undefined } : null);
}

const clone = <T>(value: T): T => structuredClone(value);
const section = applySectionSettings;

const BORDER_SIDES = ["top", "right", "bottom", "left"] as const;

const GROUPS: { [K in StyleGroupKey]: StyleGroup<K> } = {
  typography: {
    label: "Typography",
    capture: (_, node) => authored(node.typography),
    supports: (destination) => destination.capabilities.supportsTypography,
    apply: (root, { node }, value) => section(root, [node.id], "typography", { ...node.typography, ...clone(value) }),
  },
  background: {
    label: "Background",
    capture: (_, node) => authored(node.background),
    supports: (destination) => destination.capabilities.supportsBackground,
    apply: (root, { node }, value) => section(root, [node.id], "background", { ...node.background, ...clone(value) }),
  },
  border: {
    label: "Border",
    capture: (_, node) => {
      if (!node.border) return undefined;
      const sides: BorderSettings = {};
      for (const side of BORDER_SIDES) {
        const value = authored(node.border[side]);
        if (value) sides[side] = value;
      }
      return Object.keys(sides).length > 0 ? sides : undefined;
    },
    supports: (destination) => destination.capabilities.supportsBorder,
    apply: (root, { node }, value) => {
      const next: BorderSettings = { ...node.border };
      for (const side of BORDER_SIDES) if (value[side]) next[side] = { ...node.border?.[side], ...clone(value[side]) };
      return section(root, [node.id], "border", next);
    },
  },
  borderRadius: {
    label: "Border Radius",
    capture: (_, node) => authored(node.borderRadius),
    supports: (destination) => destination.capabilities.supportsBorderRadius,
    apply: (root, { node }, value) => section(root, [node.id], "borderRadius", { ...node.borderRadius, ...clone(value) }),
  },
  shape: {
    label: "Shape",
    capture: (_, node) => node.shape,
    supports: (destination) => destination.capabilities.supportsShape,
    apply: (root, { node }, value) => setElementShape(root, node.id, value),
  },
  boxShadow: {
    label: "Box Shadow",
    // A layer stack is one value: it replaces the destination's stack whole.
    // Layer ids are local to one element, so the copy keeps them.
    capture: (_, node) => (node.boxShadow && node.boxShadow.length > 0 ? clone(node.boxShadow) : undefined),
    supports: (destination) => destination.capabilities.supportsBoxShadow,
    apply: (root, { node }, value) => section(root, [node.id], "boxShadow", clone(value)),
  },
  filters: {
    label: "Visual Effects",
    capture: (_, node) => authored(node.filters),
    supports: (destination) => destination.capabilities.supportsFilters,
    apply: (root, { node }, value) => section(root, [node.id], "filters", { ...node.filters, ...clone(value) }),
  },
  transition: {
    label: "Transition",
    capture: (_, node) => (node.transition ? clone(node.transition) : undefined),
    supports: (destination) => destination.capabilities.supportsTransition,
    apply: (root, { node }, value) => section(root, [node.id], "transition", clone(value)),
  },
  transform: {
    label: "Transform",
    capture: (_, node) => authored(node.transform),
    supports: (destination) => destination.capabilities.supportsTransform,
    apply: (root, { node }, value) => section(root, [node.id], "transform", { ...node.transform, ...clone(value) }),
  },
  display: {
    label: "Display & Visibility",
    capture: (_, node) => authored(node.display),
    supports: (destination) => destination.capabilities.supportsDisplay,
    apply: (root, { node }, value) => section(root, [node.id], "display", { ...node.display, ...clone(value) }),
  },
  position: {
    label: "Position",
    capture: (_, node) => authored(node.position),
    // Free layout owns `position` on a Free child and a Free container (as in the Inspector).
    supports: (destination) => destination.capabilities.supportsPosition && !destination.isFreeChild && !destination.isFreeContainer,
    apply: (root, { node }, value) => section(root, [node.id], "position", { ...node.position, ...clone(value) }),
  },
  spacing: {
    label: "Spacing",
    capture: (_, node) => {
      const margin = authored(node.spacing?.margin);
      const padding = authored(node.spacing?.padding);
      if (!margin && !padding) return undefined;
      return { ...(margin ? { margin } : {}), ...(padding ? { padding } : {}) };
    },
    supports: () => true,
    apply: (root, { node }, value) => {
      let next = root;
      if (value.margin) next = section(next, [node.id], "margin", { ...node.spacing?.margin, ...value.margin });
      if (value.padding) next = section(next, [node.id], "padding", { ...node.spacing?.padding, ...value.padding });
      return next;
    },
  },
  size: {
    label: "Size",
    capture: (document, node) => {
      const parentId = findParentId(document, node.id);
      const parent = parentId ? findNodeById(document, parentId) : undefined;
      const isFreeChild = parent !== undefined && getLayoutMode(parent) === "free";
      const box = isFreeChild
        ? node.freeLayout && { width: node.freeLayout.width, height: node.freeLayout.height }
        : node.dimensions && { width: node.dimensions.preferredWidth, height: node.dimensions.preferredHeight };
      const constraints = authored(node.sizeConstraints);
      const aspectRatio = node.aspectRatio && clone(node.aspectRatio);
      if (!box && !constraints && !aspectRatio) return undefined;
      return { ...(box ? { box } : {}), ...(constraints ? { constraints } : {}), ...(aspectRatio ? { aspectRatio } : {}) };
    },
    supports: (destination) => destination.capabilities.supportsAspectRatio,
    apply: (root, destination, value) => {
      const { node, parent } = destination;
      let next = root;
      if (value.box) {
        if (destination.isFreeChild) {
          // A Free child's size is its Free box: kept at its own x/y, and it
          // must still fit its container (never shrunk to fit, never escaping).
          const geometry = { x: node.freeLayout?.x ?? 0, y: node.freeLayout?.y ?? 0, width: value.box.width, height: value.box.height };
          const bounds = parent ? approximateFreeContainerSize(parent) : undefined;
          if (bounds && (geometry.x + geometry.width > bounds.width || geometry.y + geometry.height > bounds.height)) return "invalid";
          next = setFreeChildGeometry(next, node.id, geometry);
        } else {
          next = setElementDimensions(next, node.id, {
            preferredWidth: value.box.width,
            preferredHeight: value.box.height,
            offsetX: node.dimensions?.offsetX ?? 0,
            offsetY: node.dimensions?.offsetY ?? 0,
          });
        }
      }
      if (value.constraints) next = setSizeConstraints(next, node.id, { ...node.sizeConstraints, ...value.constraints });
      if (value.aspectRatio) next = setAspectRatio(next, node.id, clone(value.aspectRatio));
      return next;
    },
  },
  mediaFit: {
    label: "Media",
    capture: (_, node) => authored(node.mediaFit),
    supports: (destination) => destination.capabilities.supportsMediaFit,
    apply: (root, { node }, value) => setMediaFitSettings(root, node.id, { ...node.mediaFit, ...clone(value) }),
  },
  svgPaint: {
    label: "SVG Fill & Stroke",
    capture: (_, node) => authored({ fill: node.svgFill, stroke: node.svgStroke, strokeWidth: node.svgStrokeWidth }),
    supports: (destination) => destination.capabilities.supportsSvgSettings,
    apply: (root, { node }, value) => {
      let next = root;
      if (value.fill !== undefined) next = setSvgFill(next, node.id, value.fill);
      if (value.stroke !== undefined) next = setSvgStroke(next, node.id, value.stroke);
      if (value.strokeWidth !== undefined) next = setSvgStrokeWidth(next, node.id, value.strokeWidth);
      return next;
    },
  },
  layout: {
    label: "Content Layout",
    capture: (_, node) => {
      if (!canContainChildren(node.tag)) return undefined;
      if (getLayoutMode(node) === "free") return { mode: "free", ...(node.childResizePolicy ? { childResizePolicy: node.childResizePolicy } : {}) };
      return node.flowLayout ? { mode: "flow", flowLayout: clone(node.flowLayout) } : undefined;
    },
    // Switching a container between Flow and Free re-positions its children
    // (Flow -> Free needs a DOM measurement per child), which is a structural
    // conversion, not a settings write: the group applies only when the
    // destination already uses the source's mode.
    supports: (destination, value) =>
      canContainChildren(destination.node.tag) && destination.capabilities.supportsChildLayout && getLayoutMode(destination.node) === value.mode,
    apply: (root, { node }, value) => {
      if (value.mode === "free") return value.childResizePolicy ? section(root, [node.id], "childResizePolicy", value.childResizePolicy) : root;
      let next = setFlowDisplayMode(root, node.id, value.flowLayout.display);
      if (value.flowLayout.flex) next = section(next, [node.id], "flexContainer", clone(value.flowLayout.flex));
      if (value.flowLayout.grid) next = section(next, [node.id], "gridContainer", clone(value.flowLayout.grid));
      return next;
    },
  },
  flexChild: {
    label: "Flex item",
    capture: (_, node) => (node.flexChild ? clone(node.flexChild) : undefined),
    supports: (destination) => !destination.isFreeChild && destination.parentFlowDisplay === "flex",
    apply: (root, { node }, value) => section(root, [node.id], "flexChild", clone(value)),
  },
  gridChild: {
    label: "Grid item",
    capture: (_, node) => (node.gridChild ? clone(node.gridChild) : undefined),
    supports: (destination) => !destination.isFreeChild && destination.parentFlowDisplay === "grid",
    // Clamped to the destination's own grid, as for one element.
    apply: (root, { node }, value) => section(root, [node.id], "gridChild", clone(value)),
  },
};

/** Registry order: the order of the Inspector sections, and of skipped groups in feedback. */
export const STYLE_GROUP_KEYS: readonly StyleGroupKey[] = [
  "size",
  "flexChild",
  "gridChild",
  "mediaFit",
  "svgPaint",
  "typography",
  "background",
  "border",
  "borderRadius",
  "shape",
  "boxShadow",
  "filters",
  "transition",
  "transform",
  "display",
  "position",
  "spacing",
  "layout",
];

export function styleGroupLabel(key: StyleGroupKey): string {
  return GROUPS[key].label;
}

function captureInto<K extends StyleGroupKey>(snapshot: StyleSnapshot, key: K, document: EditorElementNode, node: EditorElementNode, onlyOffered: boolean): void {
  const value = GROUPS[key].capture(document, node);
  if (value === undefined || value === null) return;
  // BC-11.3 section copy: only a group the source itself shows in its Inspector.
  if (onlyOffered && !GROUPS[key].supports(resolveDestination(document, node), value)) return;
  snapshot[key] = value;
}

/**
 * The source's authored CSS, every group it authored (or only `groups`,
 * for a future section-level copy). Deep-cloned: the source can change or
 * be deleted afterwards without affecting it.
 */
export function captureStyleSnapshot(
  document: EditorElementNode,
  node: EditorElementNode,
  groups: readonly StyleGroupKey[] = STYLE_GROUP_KEYS,
  /** BC-11.3 (section copy): leave out a group the source doesn't offer in its own Inspector, even if a stale value is stored. */
  options: { onlyOffered?: boolean } = {},
): StyleSnapshot {
  const snapshot: StyleSnapshot = {};
  for (const key of groups) captureInto(snapshot, key, document, node, options.onlyOffered ?? false);
  return snapshot;
}

export function isEmptyStyleSnapshot(snapshot: StyleSnapshot): boolean {
  return Object.keys(snapshot).length === 0;
}

function resolveDestination(document: EditorElementNode, node: EditorElementNode): Destination {
  const parentId = findParentId(document, node.id);
  const parent = parentId ? findNodeById(document, parentId) : undefined;
  return {
    node,
    parent,
    capabilities: getElementCapabilities(node.tag),
    isFreeChild: parent !== undefined && getLayoutMode(parent) === "free",
    isFreeContainer: getLayoutMode(node) === "free",
    parentFlowDisplay: parent ? getFlowLayoutSettings(parent).display : "block",
  };
}

type GroupOutcome = { kind: "absent" } | { kind: "skipped" } | { kind: "invalid" } | { kind: "applied"; document: EditorElementNode };

function applyGroup<K extends StyleGroupKey>(root: EditorElementNode, destination: Destination, key: K, snapshot: StyleSnapshot): GroupOutcome {
  const value = snapshot[key];
  if (value === undefined || value === null) return { kind: "absent" };
  const group = GROUPS[key];
  if (!group.supports(destination, value)) return { kind: "skipped" };
  const written = group.apply(root, destination, value);
  return written === "invalid" ? { kind: "invalid" } : { kind: "applied", document: written };
}

export type StylePasteResult =
  /** Written: commit `document` as one history entry. `skipped` names the groups some destination doesn't support. */
  | { status: "pasted"; document: EditorElementNode; skipped: string[] }
  /** Compatible groups exist but every destination already has those values. */
  | { status: "unchanged"; skipped: string[] }
  /** No destination supports any copied group. */
  | { status: "nothing-compatible" }
  /** A compatible write is invalid (a Free size that doesn't fit, or a value the schema rejects): nothing is pasted. */
  | { status: "invalid"; reason: "free-size" | "invalid-value"; nodeId: string };

/**
 * Merges `snapshot` into every destination (unique, existing, never the
 * page root), each group only where the destination supports it. All or
 * nothing: any invalid write refuses the whole paste. Each destination gets
 * the same snapshot (never another destination's result). The style-lock
 * check is the store's (guarded, like every BC-10 bulk edit).
 */
export function applyStyleSnapshot(
  document: EditorElementNode,
  destinationIds: readonly string[],
  snapshot: StyleSnapshot,
  groups: readonly StyleGroupKey[] = STYLE_GROUP_KEYS,
): StylePasteResult {
  const ids = Array.from(new Set(destinationIds)).filter((id) => id !== document.id && findNodeById(document, id) !== undefined);
  const skipped = new Set<StyleGroupKey>();
  let anyCompatible = false;
  let next = document;
  for (const id of ids) {
    for (const key of groups) {
      // Resolved against the document as written so far (one destination's
      // earlier groups), but the value always comes from the snapshot.
      const node = findNodeById(next, id)!;
      const outcome = applyGroup(next, resolveDestination(next, node), key, snapshot);
      if (outcome.kind === "skipped") skipped.add(key);
      if (outcome.kind === "invalid") return { status: "invalid", reason: "free-size", nodeId: id };
      if (outcome.kind === "applied") {
        anyCompatible = true;
        next = outcome.document;
      }
    }
  }
  if (!anyCompatible) return { status: "nothing-compatible" };
  const skippedLabels = STYLE_GROUP_KEYS.filter((key) => skipped.has(key)).map(styleGroupLabel);
  const changed = ids.filter((id) => ownFields(findNodeById(next, id)) !== ownFields(findNodeById(document, id)));
  if (changed.length === 0) return { status: "unchanged", skipped: skippedLabels };
  for (const id of changed) {
    if (!editorElementNodeSchema.safeParse(findNodeById(next, id)).success) return { status: "invalid", reason: "invalid-value", nodeId: id };
  }
  return { status: "pasted", document: next, skipped: skippedLabels };
}

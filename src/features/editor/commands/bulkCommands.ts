import { canResizeElement } from "@/features/editor/rules/elementCapabilities";
import { getResizeConstraintsForTag } from "@/features/editor/types/layout";
import { getBackgroundSettings, withBackgroundField, type BackgroundSettings } from "@/features/editor/types/background";
import {
  BORDER_SIDES,
  getBorderSettings,
  getBorderSide,
  withBorderAllSidesField,
  type BorderSideSettings,
} from "@/features/editor/types/border";
import {
  BORDER_RADIUS_CORNERS,
  getBorderRadiusSettings,
  withBorderRadiusAllCorners,
} from "@/features/editor/types/borderRadius";
import { getDisplaySettings, withDisplayField, type DisplaySettings } from "@/features/editor/types/display";
import type { ElementDimensions, EditorElementNode } from "@/features/editor/types/document";
import { getFilterSettings, withFilterField, type FilterSettings } from "@/features/editor/types/filters";
import { getMediaFitSettings, withMediaFitField, type MediaFitSettings } from "@/features/editor/types/mediaFit";
import { getPositionSettings, withPositionField, type PositionSettings } from "@/features/editor/types/position";
import { getSizeConstraints, withSizeConstraintField, type SizeConstraints } from "@/features/editor/types/sizeConstraints";
import { getElementSpacing, type ElementSpacing } from "@/features/editor/types/spacing";
import type { EdgeValues } from "@/features/editor/types/spacing";
import { getShapePreset, type ShapePreset } from "@/features/editor/types/shape";
import type { SvgPrimitiveKind } from "@/features/editor/types/svg";
import { getTypographySettings, withTypographyField, type CssLengthValue, type TypographySettings } from "@/features/editor/types/typography";
import { DEFAULT_TRANSITION_SETTINGS, getTransitionSettings, transitionSettingsEqual, withTransitionField, type TransitionSettings } from "@/features/editor/types/transition";
import { getTransformSettings, transformSettingsEqual, withTransformField, type TransformSettings } from "@/features/editor/types/transform";
import type { AspectRatioValue } from "@/features/editor/types/aspectRatio";
import { findParentId } from "@/features/editor/utils/findNodeById";

/**
 * The one shared traversal every bulk (multi-node) command in this file
 * is built on (Checkpoint 1.15.2, Parts 30/58) — a SINGLE pass over the
 * whole document tree, not one full-tree search per selected id (which
 * would be O(selection size × document size) for a large selection; this
 * is O(document size) regardless of how many ids are targeted).
 * Structural sharing is preserved exactly like every other command in
 * this codebase: `updater` returning the same node reference back (a
 * per-node no-op) never forces a parent rebuild, and a node with no
 * targeted id anywhere in its subtree is returned completely untouched.
 */
export function updateNodesByIds(
  root: EditorElementNode,
  ids: ReadonlySet<string>,
  updater: (node: EditorElementNode) => EditorElementNode,
): EditorElementNode {
  let nextChildren = root.children;
  if (root.children) {
    let childrenChanged = false;
    const mapped = root.children.map((child) => {
      const updatedChild = updateNodesByIds(child, ids, updater);
      if (updatedChild !== child) childrenChanged = true;
      return updatedChild;
    });
    if (childrenChanged) nextChildren = mapped;
  }

  if (ids.has(root.id)) {
    const updated = updater(root);
    return nextChildren !== root.children ? { ...updated, children: nextChildren } : updated;
  }

  return nextChildren !== root.children ? { ...root, children: nextChildren } : root;
}

/**
 * Removes every targeted id in one pass (Checkpoint 1.15.2's own bulk
 * Delete — see this checkpoint's report, section M) — the multi-node
 * counterpart to documentCommands.removeNode, used instead of calling
 * that once per id (which would re-search the whole tree per id). Ids
 * are expected to already be normalized to non-overlapping top-level
 * selection roots (see normalizeSelectionRoots) before this is called —
 * removing both an ancestor and its own descendant in the same pass is
 * harmless here regardless (the descendant simply vanishes along with
 * its ancestor, same as a single removeNode call already behaves), but
 * the caller is what's responsible for turning that into exactly one
 * semantically-meaningful deletion rather than a confusing double-remove.
 */
export function removeNodesByIds(root: EditorElementNode, ids: ReadonlySet<string>): EditorElementNode {
  if (!root.children) return root;

  const filtered = root.children.filter((child) => !ids.has(child.id));
  let changed = filtered.length !== root.children.length;

  const nextChildren = filtered.map((child) => {
    const updatedChild = removeNodesByIds(child, ids);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children: nextChildren } : root;
}

/**
 * Reduces an arbitrary selected-id list down to its top-level roots
 * (Checkpoint 1.15.2, Part 16) — drops any id that is itself a
 * descendant of another selected id, so deleting "Container + its own
 * selected Paragraph child" only ever removes Container once, never
 * attempts a second, now-dangling removal of the Paragraph. O(ids ×
 * document) via repeated findParentId walks — selection lists are small
 * relative to full-tree bulk CSS edits, so this is not the traversal
 * this checkpoint's own performance requirement (Part 57/58) targets.
 */
export function normalizeSelectionRoots(document: EditorElementNode, ids: readonly string[]): string[] {
  const idSet = new Set(ids);
  return ids.filter((id) => !isDescendantOfAnySelected(document, id, idSet));
}

function isDescendantOfAnySelected(document: EditorElementNode, nodeId: string, selectedIds: ReadonlySet<string>): boolean {
  let currentId: string | null = nodeId;
  for (;;) {
    const parentId: string | null = findParentId(document, currentId);
    if (!parentId) return false;
    if (selectedIds.has(parentId)) return true;
    currentId = parentId;
  }
}

function cssLengthEqual(a: CssLengthValue | undefined, b: CssLengthValue | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.value === b.value && a.unit === b.unit;
}

function isCssLengthLike(value: unknown): value is { value: unknown; unit: unknown } {
  return typeof value === "object" && value !== null && "value" in value && "unit" in value;
}

/**
 * The general no-op equality every single-field bulk command below uses
 * (Checkpoint 1.15.2) — a plain `===` is correct for a primitive field
 * (fontWeight, color, display, ...) but silently wrong for the handful of
 * object-valued fields these settings types also carry (Typography's
 * fontSize/lineHeight/letterSpacing, Filters' blur, Position's offsets,
 * MediaFit's objectPositionX/Y — all CssLengthValue-shaped `{ value,
 * unit }` objects): a freshly-typed value is always a NEW object
 * reference, so `===` would treat "commit the exact same 18px twice" as
 * a real change every time, pushing a spurious history entry each time
 * (found live via this checkpoint's own real-browser verification, not
 * hypothetically — see this checkpoint's report). Structural comparison
 * for anything CssLengthValue-shaped; `===` for everything else.
 */
function looseFieldEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (isCssLengthLike(a) && isCssLengthLike(b)) {
    return cssLengthEqual(a as CssLengthValue, b as CssLengthValue);
  }
  return false;
}

function dimensionsEqual(a: ElementDimensions | undefined, b: ElementDimensions | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.preferredWidth === b.preferredWidth && a.preferredHeight === b.preferredHeight && a.offsetX === b.offsetX && a.offsetY === b.offsetY;
}

function aspectRatioEqual(a: AspectRatioValue | undefined, b: AspectRatioValue | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Sets one Typography field across every targeted node (Checkpoint
 * 1.15.2 — the "shared CSS editing surface" a multi-selection Inspector
 * needs). Each node's OWN existing typography is individually merged via
 * withTypographyField — never a single shared settings object stamped
 * onto every node, which would silently blow away whichever other
 * typography fields a node already had that happened to differ from its
 * selection-mates. No-op per node (returns that exact node back) when
 * its current value for this one field already equals `value` — the
 * concrete case this checkpoint's own brief calls out (three nodes
 * already at fontWeight 700 stay untouched, and the WHOLE bulk command
 * returns the original root, no history entry, if that's true for every
 * targeted node).
 */
export function setElementsTypographyField<K extends keyof TypographySettings>(
  root: EditorElementNode,
  ids: ReadonlySet<string>,
  field: K,
  value: TypographySettings[K],
): EditorElementNode {
  return updateNodesByIds(root, ids, (node) => {
    const current = getTypographySettings(node);
    if (looseFieldEqual(current[field], value)) return node;
    return { ...node, typography: withTypographyField(current, field, value) };
  });
}

export function setElementsBackgroundField<K extends Exclude<keyof BackgroundSettings, "size" | "customSize" | "gradient">>(
  root: EditorElementNode,
  ids: ReadonlySet<string>,
  field: K,
  value: BackgroundSettings[K],
): EditorElementNode {
  return updateNodesByIds(root, ids, (node) => {
    const current = getBackgroundSettings(node);
    if (looseFieldEqual(current[field], value)) return node;
    return { ...node, background: withBackgroundField(current, field, value) };
  });
}

/** Writes one BorderSideSettings field to all four sides of every targeted node (Checkpoint 1.15.2's own "All Sides" bulk mode — see this checkpoint's report for why per-individual-side bulk editing was deferred). */
export function setElementsBorderAllSidesField<K extends keyof BorderSideSettings>(
  root: EditorElementNode,
  ids: ReadonlySet<string>,
  field: K,
  value: BorderSideSettings[K],
): EditorElementNode {
  return updateNodesByIds(root, ids, (node) => {
    const current = getBorderSettings(node);
    const alreadyUniform = BORDER_SIDES.every((side) => looseFieldEqual(getBorderSide(current, side)[field], value));
    if (alreadyUniform) return node;
    return { ...node, border: withBorderAllSidesField(current, field, value) };
  });
}

/** Writes one uniform radius to all four corners of every targeted node. */
export function setElementsBorderRadiusAllCorners(
  root: EditorElementNode,
  ids: ReadonlySet<string>,
  value: CssLengthValue | undefined,
): EditorElementNode {
  return updateNodesByIds(root, ids, (node) => {
    const current = getBorderRadiusSettings(node);
    const alreadyUniform = BORDER_RADIUS_CORNERS.every((corner) => cssLengthEqual(current[corner], value));
    if (alreadyUniform) return node;
    return { ...node, borderRadius: withBorderRadiusAllCorners(value) };
  });
}

/**
 * Sets every targeted node's Shape preset in one pass (Checkpoint
 * 1.15.4) — the bulk counterpart to setElementShape, same "none"-
 * normalizes-to-`undefined` and per-node no-op detection. Used by
 * InspectorBulkShapeSection; the store's guardedBulkStyleMutation is what
 * makes this atomic against Parent Style Protection (see this
 * checkpoint's own report, section J) — this function itself has no
 * protection awareness, matching every other bulk command in this file.
 */
export function setElementsShape(
  root: EditorElementNode,
  ids: ReadonlySet<string>,
  shape: ShapePreset,
): EditorElementNode {
  const next = shape === "none" ? undefined : shape;
  return updateNodesByIds(root, ids, (node) => {
    if (getShapePreset(node) === (next ?? "none")) return node;
    return { ...node, shape: next };
  });
}

/**
 * Bulk SVG Primitive (Checkpoint 1.15.5, section 35) — vector CONTENT,
 * not styling (same distinction setSvgKind's own doc comment draws), so
 * the store wires this WITHOUT guardedBulkStyleMutation — Parent Style
 * Protection never blocks a Primitive change, single or bulk. Still runs
 * through the same single-pass updateNodesByIds/no-op-detection every
 * other bulk command uses; only the protection-guard wrapping differs,
 * and that decision lives entirely at the store layer, not here.
 */
export function setElementsSvgKind(
  root: EditorElementNode,
  ids: ReadonlySet<string>,
  kind: SvgPrimitiveKind,
): EditorElementNode {
  return updateNodesByIds(root, ids, (node) => {
    if (node.svgKind === kind) return node;
    return { ...node, svgKind: kind };
  });
}

export function setElementsSvgFill(
  root: EditorElementNode,
  ids: ReadonlySet<string>,
  fill: string | undefined,
): EditorElementNode {
  return updateNodesByIds(root, ids, (node) => {
    if (node.svgFill === fill) return node;
    return { ...node, svgFill: fill };
  });
}

/** `undefined` = "None" (see setSvgStroke's own doc comment) — never touches svgStrokeWidth on any targeted node. */
export function setElementsSvgStroke(
  root: EditorElementNode,
  ids: ReadonlySet<string>,
  stroke: string | undefined,
): EditorElementNode {
  return updateNodesByIds(root, ids, (node) => {
    if (node.svgStroke === stroke) return node;
    return { ...node, svgStroke: stroke };
  });
}

export function setElementsSvgStrokeWidth(
  root: EditorElementNode,
  ids: ReadonlySet<string>,
  strokeWidth: number,
): EditorElementNode {
  const safeWidth = Math.max(0, strokeWidth);
  return updateNodesByIds(root, ids, (node) => {
    if (node.svgStrokeWidth === safeWidth) return node;
    return { ...node, svgStrokeWidth: safeWidth };
  });
}

export function setElementsDisplayField<K extends keyof DisplaySettings>(
  root: EditorElementNode,
  ids: ReadonlySet<string>,
  field: K,
  value: DisplaySettings[K],
): EditorElementNode {
  return updateNodesByIds(root, ids, (node) => {
    const current = getDisplaySettings(node);
    if (looseFieldEqual(current[field], value)) return node;
    return { ...node, display: withDisplayField(current, field, value) };
  });
}

export function setElementsFilterField<K extends keyof FilterSettings>(
  root: EditorElementNode,
  ids: ReadonlySet<string>,
  field: K,
  value: FilterSettings[K],
): EditorElementNode {
  return updateNodesByIds(root, ids, (node) => {
    const current = getFilterSettings(node);
    if (looseFieldEqual(current[field], value)) return node;
    return { ...node, filters: withFilterField(current, field, value) };
  });
}

/**
 * Sets one Transition field across every targeted node (Checkpoint
 * 1.15.6.14.1) — a node with no authored transition yet is defaulted to
 * DEFAULT_TRANSITION_SETTINGS first (the same "default-if-absent, then
 * merge" shape a bulk field edit needs whenever the underlying struct
 * isn't independently-optional-per-field — see types/transition.ts's own
 * top comment for why TransitionSettings has no partial/empty state), so
 * bulk-editing e.g. Duration while some selected nodes have no transition
 * at all still produces one coherent, fully-populated transition on every
 * targeted node. No-op per node when its current value for this one
 * field already equals `value`, the same looseFieldEqual convention every
 * other bulk field command in this file uses. Never reached for "clear
 * the whole transition" — that is setElementsTransition's job (`value:
 * undefined`), since a per-field command has no way to express "undefined
 * the whole object" through a single field's value type.
 */
export function setElementsTransitionField<K extends keyof TransitionSettings>(
  root: EditorElementNode,
  ids: ReadonlySet<string>,
  field: K,
  value: TransitionSettings[K],
): EditorElementNode {
  return updateNodesByIds(root, ids, (node) => {
    const current = getTransitionSettings(node) ?? DEFAULT_TRANSITION_SETTINGS;
    if (looseFieldEqual(current[field], value)) return node;
    return { ...node, transition: withTransitionField(current, field, value) };
  });
}

/**
 * Full-value overwrite/clear across every targeted node (Checkpoint
 * 1.15.6.14.1) — the bulk counterpart to setElementTransition, same shape
 * as setElementsAspectRatio: TransitionSettings is only ever meaningful as
 * a complete object, never a per-field partial, so there is nothing to
 * merge here. Used by the Inspector's Property control's "None" option
 * (clearing every targeted node's transition in one atomic bulk commit).
 */
export function setElementsTransition(
  root: EditorElementNode,
  ids: ReadonlySet<string>,
  transition: TransitionSettings | undefined,
): EditorElementNode {
  return updateNodesByIds(root, ids, (node) => {
    if (transitionSettingsEqual(node.transition, transition)) return node;
    return { ...node, transition };
  });
}

/**
 * Sets one Transform field across every targeted node (Checkpoint
 * 1.15.6.14.3) — unlike setElementsTransitionField, a node with no
 * authored Transform yet defaults to `{}` (not a DEFAULT_TRANSFORM_
 * SETTINGS constant — none exists), since every TransformSettings field
 * is independently optional and identity-normalizes on its own (see
 * types/transform.ts's own top comment) — merging one field into `{}`
 * and normalizing is already exactly correct, with no need to stamp the
 * other three fields to any starter value. No-op per node via
 * transformSettingsEqual (identity-normalization-aware), the same
 * convention every other bulk field command in this file uses.
 */
export function setElementsTransformField<K extends keyof TransformSettings>(
  root: EditorElementNode,
  ids: ReadonlySet<string>,
  field: K,
  value: TransformSettings[K],
): EditorElementNode {
  return updateNodesByIds(root, ids, (node) => {
    const current = getTransformSettings(node);
    const next = withTransformField(current, field, value);
    if (transformSettingsEqual(node.transform, next)) return node;
    return { ...node, transform: next };
  });
}

/**
 * Full-value overwrite/clear across every targeted node (Checkpoint
 * 1.15.6.14.3) — the bulk counterpart to setElementTransform, used by the
 * Inspector's bulk Reset Transform action (clearing every targeted
 * node's Transform in one atomic bulk commit, never a group transform —
 * see this checkpoint's own report, Part J).
 */
export function setElementsTransform(
  root: EditorElementNode,
  ids: ReadonlySet<string>,
  transform: TransformSettings | undefined,
): EditorElementNode {
  return updateNodesByIds(root, ids, (node) => {
    if (transformSettingsEqual(node.transform, transform)) return node;
    return { ...node, transform };
  });
}

export function setElementsPositionField<K extends keyof PositionSettings>(
  root: EditorElementNode,
  ids: ReadonlySet<string>,
  field: K,
  value: PositionSettings[K],
): EditorElementNode {
  return updateNodesByIds(root, ids, (node) => {
    const current = getPositionSettings(node);
    if (looseFieldEqual(current[field], value)) return node;
    return { ...node, position: withPositionField(current, field, value) };
  });
}

export function setElementsMediaFitField<K extends keyof MediaFitSettings>(
  root: EditorElementNode,
  ids: ReadonlySet<string>,
  field: K,
  value: MediaFitSettings[K],
): EditorElementNode {
  return updateNodesByIds(root, ids, (node) => {
    const current = getMediaFitSettings(node);
    if (looseFieldEqual(current[field], value)) return node;
    return { ...node, mediaFit: withMediaFitField(current, field, value) };
  });
}

export function setElementsSizeConstraintField<K extends keyof SizeConstraints>(
  root: EditorElementNode,
  ids: ReadonlySet<string>,
  field: K,
  value: SizeConstraints[K],
): EditorElementNode {
  return updateNodesByIds(root, ids, (node) => {
    const current = getSizeConstraints(node);
    if (looseFieldEqual(current[field], value)) return node;
    return { ...node, sizeConstraints: withSizeConstraintField(current, field, value) };
  });
}

/**
 * Writes the same value to all four sides of one box (margin or padding)
 * across every targeted node, in a single per-node update — the bulk
 * Inspector's own simpler "uniform" convenience (mirroring Border's own
 * "All Sides" bulk mode), one call per node rather than four independent
 * setElementsSpacingField calls (which would each be its own bulk
 * traversal and, at the store layer, its own history entry — breaking
 * the "one bulk commit = one history entry" invariant for a single
 * uniform-spacing edit).
 */
export function setElementsSpacingAllSides(
  root: EditorElementNode,
  ids: ReadonlySet<string>,
  box: "margin" | "padding",
  value: number,
): EditorElementNode {
  return updateNodesByIds(root, ids, (node) => {
    const spacing = getElementSpacing(node);
    const currentBox = spacing[box];
    if (currentBox.top === value && currentBox.right === value && currentBox.bottom === value && currentBox.left === value) {
      return node;
    }
    const nextBox: EdgeValues = { top: value, right: value, bottom: value, left: value };
    const nextSpacing: ElementSpacing = { ...spacing, [box]: nextBox };
    return { ...node, spacing: nextSpacing };
  });
}

/** Full-value overwrite (Checkpoint 1.15.2) — AspectRatioValue is already an atomic, always-fully-replaced value at the single-node level (see setElementAspectRatio), so there is no per-field merge to preserve here. */
export function setElementsAspectRatio(
  root: EditorElementNode,
  ids: ReadonlySet<string>,
  aspectRatio: AspectRatioValue | undefined,
): EditorElementNode {
  return updateNodesByIds(root, ids, (node) => {
    if (aspectRatioEqual(node.aspectRatio, aspectRatio)) return node;
    return { ...node, aspectRatio };
  });
}

/**
 * Full-value overwrite, same tag-based resizability gate and floor-clamp
 * resizeNode itself enforces (Checkpoint 1.12.1's own resize-floor fix —
 * see resizeNode's doc comment) so a bulk Width/Height edit can never
 * push a non-resizable tag or an under-floor size the same way a single
 * drag/Inspector edit already can't.
 */
export function setElementsDimensions(
  root: EditorElementNode,
  ids: ReadonlySet<string>,
  dimensions: ElementDimensions | undefined,
): EditorElementNode {
  const safeDimensions = dimensions ? clampDimensions(dimensions) : undefined;
  return updateNodesByIds(root, ids, (node) => {
    if (!canResizeElement(node.tag)) return node;
    if (dimensionsEqual(node.dimensions, safeDimensions)) return node;
    return { ...node, dimensions: safeDimensions };
  });
}

function clampDimensions(dimensions: ElementDimensions): ElementDimensions {
  const constraints = getResizeConstraintsForTag();
  return {
    preferredWidth: Math.max(constraints.minWidth, dimensions.preferredWidth),
    preferredHeight: Math.max(constraints.minHeight, dimensions.preferredHeight),
    offsetX: dimensions.offsetX,
    offsetY: dimensions.offsetY,
  };
}

import { isValidMoveTarget } from "@/features/editor/rules/moveValidationRules";
import { canParentAcceptChild } from "@/features/editor/rules/insertionRules";
import { canResizeElement } from "@/features/editor/rules/elementCapabilities";
import { findNodeById, findParentId } from "@/features/editor/utils/findNodeById";
import { getResizeConstraintsForTag } from "@/features/editor/types/layout";
import { createListItemNode, createOptionNode } from "@/features/editor/factories/elementFactories";
import type { DropZone } from "@/features/editor/utils/resolveDropZone";
import type { ElementDimensions, EditorElementNode } from "@/features/editor/types/document";
import type { InputType } from "@/features/editor/types/input";

/**
 * Document mutation layer — the only place the document tree is ever
 * rebuilt. Every future mutation (replaceNode, duplicateNode) belongs
 * here alongside insertNode/removeNode/moveNode, sharing the same
 * immutable-update shape, so callers never splice EditorElementNode
 * arrays directly.
 *
 * Every command returns a new root only along the path that actually
 * changed — untouched branches keep their existing object identity
 * (structural sharing), which is what lets consumers skip re-rendering
 * subtrees that weren't affected.
 */

export interface InsertPosition {
  /** Insert immediately before/after this sibling rather than appending. */
  referenceId: string;
  placement: "before" | "after";
}

/**
 * Self-validating the same way resizeNode/moveNode already are (see
 * their own doc comments) — never trust the caller alone. This is the
 * ONE place every insertion path (click-insert, drag-insert, paste, and
 * moveNode's own re-insertion step below) ultimately funnels through, so
 * a single canParentAcceptChild check here (Checkpoint 1.6) protects all
 * of them at once, rather than each caller needing its own copy. A
 * rejected insertion is a no-op — the original, completely unmodified
 * root is returned, exactly like an invalid move.
 */
export function insertNode(
  root: EditorElementNode,
  parentId: string,
  newNode: EditorElementNode,
  position?: InsertPosition,
): EditorElementNode {
  if (root.id === parentId) {
    if (!canParentAcceptChild(root.tag, newNode.tag)) return root;

    const children = root.children ?? [];

    if (!position) {
      return { ...root, children: [...children, newNode] };
    }

    const index = children.findIndex((child) => child.id === position.referenceId);
    if (index === -1) {
      return { ...root, children: [...children, newNode] };
    }
    const insertAt = position.placement === "before" ? index : index + 1;
    return {
      ...root,
      children: [...children.slice(0, insertAt), newNode, ...children.slice(insertAt)],
    };
  }

  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = insertNode(child, parentId, newNode, position);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}

/** Removes nodeId from wherever it currently lives. A no-op (same reference returned) if nodeId isn't found. */
export function removeNode(root: EditorElementNode, nodeId: string): EditorElementNode {
  if (!root.children) return root;

  const filteredChildren = root.children.filter((child) => child.id !== nodeId);
  if (filteredChildren.length !== root.children.length) {
    return { ...root, children: filteredChildren };
  }

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = removeNode(child, nodeId);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}

/**
 * Moves nodeId to sit before/after targetId (as a new sibling in
 * targetId's parent) or inside targetId (appended as its last child).
 * Delegates every safety check to isValidMoveTarget — self-descendant
 * drops, the document root, and non-container "inside" targets are all
 * rejected there, not re-implemented here. Any rejection (including the
 * requested target no longer being reachable after removal) returns the
 * original, completely unmodified root — the moved node is never lost.
 */
export function moveNode(
  root: EditorElementNode,
  nodeId: string,
  targetId: string,
  zone: DropZone,
): EditorElementNode {
  if (!isValidMoveTarget(root, nodeId, targetId, zone)) return root;

  const nodeToMove = findNodeById(root, nodeId);
  if (!nodeToMove) return root;

  const withoutNode = removeNode(root, nodeId);

  if (zone === "inside") {
    const result = insertNode(withoutNode, targetId, nodeToMove);
    return result === withoutNode ? root : result;
  }

  const targetParentId = findParentId(withoutNode, targetId);
  if (!targetParentId) return root;

  const result = insertNode(withoutNode, targetParentId, nodeToMove, {
    referenceId: targetId,
    placement: zone,
  });
  return result === withoutNode ? root : result;
}

/**
 * Sets nodeId's explicit pixel dimensions (and its west/north-anchor
 * offset — see ElementDimensions in document.ts). A no-op (same reference
 * returned) if nodeId doesn't resolve to a resizable tag (see
 * canResizeElement) or doesn't exist — the live resize session already
 * gates on the same rule before a drag can even start, so this is a
 * second, independent check rather than the only one, matching moveNode's
 * "never trust the caller alone" shape. width/height are also clamped
 * defensively to the same minimums the live session enforces, in case a
 * caller ever passes this command a raw value that bypassed
 * computeResizeResult's own clamping — offsetX/offsetY have no such floor
 * (a valid anchor shift can legitimately be any sign or magnitude), so
 * they pass through unchanged.
 */
export function resizeNode(
  root: EditorElementNode,
  nodeId: string,
  dimensions: ElementDimensions,
): EditorElementNode {
  if (root.id === nodeId) {
    if (!canResizeElement(root.tag)) return root;
    const constraints = getResizeConstraintsForTag();
    const safeDimensions: ElementDimensions = {
      preferredWidth: Math.max(constraints.minWidth, dimensions.preferredWidth),
      preferredHeight: Math.max(constraints.minHeight, dimensions.preferredHeight),
      offsetX: dimensions.offsetX,
      offsetY: dimensions.offsetY,
    };
    return { ...root, dimensions: safeDimensions };
  }

  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = resizeNode(child, nodeId, dimensions);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}

/**
 * One-shot Flow dimension edit (Checkpoint 5.7) — the Inspector's own
 * Width/Height fields, as opposed to resizeNode/resizeElement's
 * per-frame pointer-drag writes. Setting `dimensions` delegates straight
 * to resizeNode, so an Inspector-typed value gets the exact same
 * tag-based floor clamp a drag would (see resizeNode's own doc comment)
 * — there is no separate, weaker validation path for typed input.
 * `dimensions: undefined` clears the node back to natural Flow sizing on
 * BOTH axes at once: ElementDimensions stays deliberately atomic (see
 * this checkpoint's own report for the audit behind that decision), so
 * there is no way to represent "Auto width, explicit height" — Reset
 * Width and Reset Height are documented and tested to both perform this
 * same full clear, never a partial one.
 */
export function setElementDimensions(
  root: EditorElementNode,
  nodeId: string,
  dimensions: ElementDimensions | undefined,
): EditorElementNode {
  if (dimensions !== undefined) return resizeNode(root, nodeId, dimensions);

  if (root.id === nodeId) {
    if (root.dimensions === undefined) return root;
    return { ...root, dimensions: undefined };
  }

  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = setElementDimensions(child, nodeId, dimensions);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}

/**
 * Sets nodeId's literal text content (Checkpoint 1.3 — Canvas text
 * editing). Deliberately tag-agnostic: this is the same generic
 * "locate by id, update immutably, preserve everything else" shape as
 * every other command in this file, with no knowledge of Heading or
 * Paragraph specifically, so a future Button/Link/List Item label can
 * call this unchanged. `text` is always a plain string (an intentionally
 * emptied node commits `""`, never reverts to `undefined` — that value
 * means "not a text-bearing node at all," which editing a real
 * text-bearing node never changes it back to). No-ops (same reference
 * returned) when the text is already exactly this value, so committing
 * an editing session that didn't actually change anything never pushes
 * a spurious history entry.
 */
export function setElementText(
  root: EditorElementNode,
  nodeId: string,
  text: string,
): EditorElementNode {
  if (root.id === nodeId) {
    if (root.text === text) return root;
    return { ...root, text };
  }

  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = setElementText(child, nodeId, text);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}

/**
 * Changes nodeId's own semantic HTML tag in place — every other field
 * (text, styles, layout, dimensions, children, ids) is preserved
 * untouched by the `{...root, tag}` spread (Checkpoint 1.7 — the
 * Inspector's Heading Level control). Deliberately generic and
 * tag-agnostic, exactly like setElementText/setElementHref: this command
 * has no notion of "heading" at all and accepts any string, the same way
 * the document model itself is tag-based rather than a discriminated
 * union — restricting *which* tags are actually reachable through the UI
 * is the calling Inspector control's job (a fixed H1–H6 option set, never
 * free text), not this command's. No-ops (same reference) when the tag
 * is already exactly this, matching setElementText/setElementHref's own
 * no-op convention.
 */
export function setElementTag(
  root: EditorElementNode,
  nodeId: string,
  tag: string,
): EditorElementNode {
  if (root.id === nodeId) {
    if (root.tag === tag) return root;
    return { ...root, tag };
  }

  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = setElementTag(child, nodeId, tag);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}

/**
 * Sets (or clears, via `href: undefined`) nodeId's link destination
 * (Checkpoint 1.4). Same generic, tag-agnostic shape as setElementText —
 * this command has no knowledge of the `a` tag specifically, matching
 * this checkpoint's own instruction not to bake element-type assumptions
 * into the document-mutation layer. `undefined` clears an explicit
 * override back to getLinkHref's own safe default, the same "store
 * unconditionally, let the consuming layer resolve the effective value"
 * convention mediaFit/typography/etc. already use. No-ops (same
 * reference) when the value is already exactly this, so the Inspector's
 * own draft/commit field never pushes a spurious history entry for an
 * unchanged destination.
 */
export function setElementHref(
  root: EditorElementNode,
  nodeId: string,
  href: string | undefined,
): EditorElementNode {
  if (root.id === nodeId) {
    if (root.href === href) return root;
    return { ...root, href };
  }

  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = setElementHref(child, nodeId, href);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}

/**
 * Sets nodeId's native form-control type (Checkpoint 1.11 — the Form
 * Control Inspector's Type selector, deferred by Checkpoint 1.10 since
 * nothing could change it yet). Same generic, no-op-guarded shape as
 * every other one-field command here — but unlike setElementTag/
 * setElementHref (deliberately `string`, since `tag`/`href` are
 * themselves plain strings on the document), this one is typed as the
 * real InputType union: `inputType` is intentionally NOT a free-form
 * field at the document-model level (see types/input.ts's own top
 * comment) — accepting a bare string here would require an unsound
 * cast to satisfy EditorElementNode's own field type, not just an
 * unrestricted-but-honest one.
 */
export function setElementInputType(
  root: EditorElementNode,
  nodeId: string,
  inputType: InputType,
): EditorElementNode {
  if (root.id === nodeId) {
    if (root.inputType === inputType) return root;
    return { ...root, inputType };
  }

  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = setElementInputType(child, nodeId, inputType);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}

/**
 * Sets (or clears, via `value: undefined`) nodeId's authored/default form
 * value (Checkpoint 1.10) — same generic, tag-agnostic, no-op-guarded
 * shape as setElementHref. Deliberately NOT a live-runtime-state write:
 * this is the document's own authored value, committed only at a
 * deliberate edit-session boundary (see useNativeInputEditing), never
 * synchronized on every keystroke. No-ops (same reference) when the
 * value is already exactly this, matching setElementHref/setElementTag's
 * own no-op convention.
 */
export function setElementValue(
  root: EditorElementNode,
  nodeId: string,
  value: string | undefined,
): EditorElementNode {
  if (root.id === nodeId) {
    if (root.value === value) return root;
    return { ...root, value };
  }

  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = setElementValue(child, nodeId, value);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}

/**
 * Sets (or clears, via `checked: undefined`) nodeId's authored/default
 * checked state (Checkpoint 1.12 — checkbox/radio's Inspector Checked
 * toggle). Same generic, tag-agnostic, no-op-guarded shape as
 * setElementValue — deliberately NOT live-runtime-state: this is the
 * document's own authored checked state, changed only through this
 * command (Canvas clicks on checkbox/radio never call it — see
 * InputElement's own doc comment), never synchronized from a live
 * toggle. No-ops (same reference) when the value is already exactly
 * this, matching setElementValue/setElementTag's own no-op convention.
 */
export function setElementChecked(
  root: EditorElementNode,
  nodeId: string,
  checked: boolean | undefined,
): EditorElementNode {
  if (root.id === nodeId) {
    if (root.checked === checked) return root;
    return { ...root, checked };
  }

  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = setElementChecked(child, nodeId, checked);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}

/**
 * Sets (or clears, via `name: undefined`) nodeId's `name` attribute
 * (Checkpoint 1.10) — same generic, tag-agnostic, no-op-guarded shape as
 * setElementValue/setElementHref.
 */
export function setElementName(
  root: EditorElementNode,
  nodeId: string,
  name: string | undefined,
): EditorElementNode {
  if (root.id === nodeId) {
    if (root.name === name) return root;
    return { ...root, name };
  }

  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = setElementName(child, nodeId, name);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}

/**
 * Sets (or clears, via `placeholder: undefined`) nodeId's `placeholder`
 * attribute (Checkpoint 1.10) — same generic, tag-agnostic, no-op-guarded
 * shape as setElementValue/setElementHref.
 */
export function setElementPlaceholder(
  root: EditorElementNode,
  nodeId: string,
  placeholder: string | undefined,
): EditorElementNode {
  if (root.id === nodeId) {
    if (root.placeholder === placeholder) return root;
    return { ...root, placeholder };
  }

  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = setElementPlaceholder(child, nodeId, placeholder);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}

/**
 * Overrides (or clears, via `locked: undefined`) a node's own resize-
 * proportion-lock (Checkpoint 5.7 — the Inspector's Resize Proportions
 * control). Purely a document write; it never validates against the
 * node's tag, since every tag can meaningfully carry an override even if
 * only Free-child corner resizing currently reads it (see
 * useFreeChildResizeSession) — the same "store unconditionally, let the
 * consuming layer decide relevance" convention every other retained
 * per-node setting in this app already follows (e.g. mediaFit).
 */
export function setAspectRatioLocked(
  root: EditorElementNode,
  nodeId: string,
  locked: boolean | undefined,
): EditorElementNode {
  if (root.id === nodeId) {
    if (root.aspectRatioLocked === locked) return root;
    return { ...root, aspectRatioLocked: locked };
  }

  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = setAspectRatioLocked(child, nodeId, locked);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}

/**
 * Sets nodeId's number of <li> children (Checkpoint 1.12.1 — the List
 * Inspector's Items count), so a user doesn't need the creation menu just
 * to establish how many entries a list has. No-op-guarded (same reference)
 * both for a non-list tag and for an unchanged count, matching the
 * "strongest" pattern setElementChecked/setElementInputType established.
 * Growing appends fresh createListItemNode() entries (the exact same
 * factory/default-text convention the list's own starter items use);
 * shrinking trims only from the end via slice, so every surviving item
 * keeps its existing id/text/styles untouched — the whole subtree is never
 * rebuilt. Deliberately does not weaken Checkpoint 1.6's ul/ol -> li
 * containment: it only ever adds/removes ordinary <li> children through
 * this same document/store architecture, never a synthetic visual entry
 * outside the tree.
 */
export function setListItemCount(root: EditorElementNode, nodeId: string, count: number): EditorElementNode {
  if (root.id === nodeId) {
    if (root.tag !== "ul" && root.tag !== "ol") return root;

    const children = root.children ?? [];
    const clampedCount = Math.max(0, Math.floor(count));
    if (children.length === clampedCount) return root;

    if (clampedCount > children.length) {
      const additions = Array.from({ length: clampedCount - children.length }, () => createListItemNode());
      return { ...root, children: [...children, ...additions] };
    }

    return { ...root, children: children.slice(0, clampedCount) };
  }

  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = setListItemCount(child, nodeId, count);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}

/**
 * Sets selectId's number of <option> children (Checkpoint 1.13) — the
 * Select Inspector's Options count, the same "don't force the creation
 * menu just to establish how many entries exist" reasoning
 * setListItemCount already established for Lists. A deliberately
 * separate, structurally-parallel command rather than a shared/
 * generalized one — this codebase's existing near-identical one-field
 * commands (setElementName/setElementPlaceholder, etc.) are each their
 * own small function rather than prematurely unified, and this follows
 * that same precedent. No-op-guarded (same reference) both for a
 * non-select tag and for an unchanged count. Growing appends fresh
 * createOptionNode() entries; shrinking trims only from the end via
 * slice, so every surviving Option keeps its existing id/text/value/
 * selected/styles untouched. If the removed tail happens to include the
 * currently-selected Option, no explicit fix-up is needed or performed:
 * the selected Option is simply gone from the children array, and
 * getSelectedOptionValue naturally resolves to "none selected," letting
 * the native browser's own first-option default apply — the same
 * "unset renders the safe native default" convention already used
 * everywhere else in this app, and never an invalid/dangling reference
 * since nothing else stores an Option id independently.
 */
export function setOptionCount(root: EditorElementNode, selectId: string, count: number): EditorElementNode {
  if (root.id === selectId) {
    if (root.tag !== "select") return root;

    const children = root.children ?? [];
    const clampedCount = Math.max(0, Math.floor(count));
    if (children.length === clampedCount) return root;

    if (clampedCount > children.length) {
      const additions = Array.from({ length: clampedCount - children.length }, () => createOptionNode());
      return { ...root, children: [...children, ...additions] };
    }

    return { ...root, children: children.slice(0, clampedCount) };
  }

  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = setOptionCount(child, selectId, count);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}

/**
 * Sets which single Option child of selectId is authored selected
 * (Checkpoint 1.13) — the one parent-aware command every Selected-state
 * change must go through, rather than independently toggling an Option's
 * own `selected` field, since an independent per-node toggle could leave
 * two siblings both selected at once (the single-select invariant this
 * command exists to protect). Pass `optionId` to select exactly that
 * child and clear every sibling; pass `undefined` to clear the authored
 * selection entirely (native falls back to its own first-option
 * default). Rewrites every affected child in one pass, so the whole
 * change is one immutable subtree replacement — never an intermediate
 * state where two Options are briefly both selected or both unselected
 * mid-mutation. No-op-guarded (same reference) both for a non-select
 * target and when the requested selection already matches every child's
 * current state exactly (e.g. re-selecting the already-selected Option).
 * Clearing writes `selected: undefined` (fully unset), not an explicit
 * `false` — matching the "store unconditionally, no synthesized default"
 * convention `checked`/`value`/`href` already use, and keeping "no
 * Option selected" indistinguishable from "never touched," which is
 * exactly what it should mean.
 */
export function setSelectSelectedOption(
  root: EditorElementNode,
  selectId: string,
  optionId: string | undefined,
): EditorElementNode {
  if (root.id === selectId) {
    if (root.tag !== "select" || !root.children) return root;

    let changed = false;
    const children = root.children.map((child) => {
      const shouldBeSelected = child.id === optionId;
      const currentlySelected = child.selected === true;
      if (shouldBeSelected === currentlySelected) return child;
      changed = true;
      return { ...child, selected: shouldBeSelected ? true : undefined };
    });

    return changed ? { ...root, children } : root;
  }

  if (!root.children) return root;

  let changed = false;
  const children = root.children.map((child) => {
    const updatedChild = setSelectSelectedOption(child, selectId, optionId);
    if (updatedChild !== child) changed = true;
    return updatedChild;
  });

  return changed ? { ...root, children } : root;
}

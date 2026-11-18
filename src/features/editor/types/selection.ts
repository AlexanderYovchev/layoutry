/**
 * The editor's multi-selection model (Checkpoint 1.15.2) — replaces the
 * single `selectedElementId: string | null` this app used through
 * Checkpoint 1.15.1. `ids` holds every currently-selected node's own
 * editor id (never a node object — the document tree stays the only
 * source of truth for anything beyond "is this id selected"), each at
 * most once, in a deterministic (insertion) order. `primaryId` is the
 * most recently/actively selected member — used for the Inspector's
 * single-node-shaped concerns (summary title anchor, Free-geometry
 * fields, resize/drag targeting) and as the additive-selection anchor —
 * and is always either a member of `ids` or absent entirely; there is no
 * state where `primaryId` points at an id `ids` doesn't contain. An empty
 * `ids` array always means `primaryId` is absent too.
 *
 * Deliberately a plain data object, not stored inside `EditorElementNode`
 * or duplicated onto cloned nodes — selection is editor state, not
 * document state (see this checkpoint's own report, section B).
 */
export interface EditorSelection {
  ids: string[];
  primaryId?: string;
}

export const EMPTY_SELECTION: EditorSelection = { ids: [] };

/** The single-id selection shape every existing single-select call site (insert, move, undo/redo, duplicate, paste, ...) already wants — `null` clears entirely. */
export function selectionFromSingle(id: string | null): EditorSelection {
  return id ? { ids: [id], primaryId: id } : EMPTY_SELECTION;
}

export function isNodeSelected(selection: EditorSelection, id: string): boolean {
  return selection.ids.includes(id);
}

/**
 * Ctrl/Cmd+click semantics (Checkpoint 1.15.2, Part 9 of its own brief):
 * toggles membership. Removing the current primary reassigns it to the
 * new last-remaining member of `ids` (a documented, deterministic rule —
 * "most recently added remaining selection," which for this array-order
 * model is simply the new last element) rather than leaving it dangling
 * or silently picking the first.
 */
export function toggleSelectionId(selection: EditorSelection, id: string): EditorSelection {
  if (selection.ids.includes(id)) {
    const ids = selection.ids.filter((existingId) => existingId !== id);
    if (ids.length === 0) return EMPTY_SELECTION;
    const primaryId = selection.primaryId === id ? ids[ids.length - 1] : selection.primaryId;
    return { ids, primaryId };
  }
  return { ids: [...selection.ids, id], primaryId: id };
}

/**
 * Shift+click semantics on Canvas (Checkpoint 1.15.2, Part 10) — plain
 * additive selection, deliberately NOT a toggle: an already-selected id
 * stays selected (only its primary status may change), rather than being
 * removed the way Ctrl/Cmd+click would. Canvas has no natural linear
 * order to build a real "range" from (see this checkpoint's own report),
 * so this is the one, predictable Shift behavior there. The Structure
 * panel, which has a real row order, uses selectRange below instead
 * (BC-10.2; before that it also used this additive helper).
 */
export function addSelectionId(selection: EditorSelection, id: string): EditorSelection {
  if (selection.ids.includes(id)) return { ...selection, primaryId: id };
  return { ids: [...selection.ids, id], primaryId: id };
}

/** Structured/group selection (e.g. Table's "Select All Cells") — de-duplicates defensively even though every caller is expected to already pass unique ids. */
export function createSelection(ids: readonly string[], primaryId?: string): EditorSelection {
  const uniqueIds = Array.from(new Set(ids));
  if (uniqueIds.length === 0) return EMPTY_SELECTION;
  const resolvedPrimary = primaryId && uniqueIds.includes(primaryId) ? primaryId : uniqueIds[uniqueIds.length - 1];
  return { ids: uniqueIds, primaryId: resolvedPrimary };
}

/**
 * Drops any id no longer present in `existingIds` (Checkpoint 1.15.2,
 * Part 18 — "selection must automatically discard IDs that no longer
 * exist"). Deliberately a pure function applied at READ time by
 * useSelectedNodes, not a write-time patch threaded through every
 * document-mutating store action — every command that can shrink the
 * tree (delete, undo, redo, list/select/table count shrink, ...) already
 * gets this behavior for free, with zero changes to any of them, instead
 * of scattering an existence check through each one (the brief's own
 * explicit instruction). Returns the identical reference when nothing
 * was actually stale, so a component built on this never re-renders for
 * no reason.
 */
export function normalizeSelection(selection: EditorSelection, existingIds: ReadonlySet<string>): EditorSelection {
  const ids = selection.ids.filter((id) => existingIds.has(id));
  const primaryStillValid = selection.primaryId !== undefined && ids.includes(selection.primaryId);
  if (ids.length === selection.ids.length && primaryStillValid) return selection;
  if (ids.length === 0) return EMPTY_SELECTION;
  return { ids, primaryId: primaryStillValid ? selection.primaryId : ids[ids.length - 1] };
}

/**
 * Structure panel Shift+click range selection (BC-10.2). `orderedIds` is
 * the Structure panel's VISIBLE row order (collapsed descendants are not
 * in it, so they are never selected by a range); the range runs from the
 * anchor to `targetId` inclusive, in that order, across containers.
 *
 * The anchor is the last plainly clicked or Ctrl/Cmd-clicked row. It is
 * used only while it is still selected and visible; otherwise the primary
 * selection (if visible) is the anchor, else `targetId` itself. The anchor
 * is returned so repeated Shift+clicks keep it.
 *
 * `additive` (Ctrl/Cmd+Shift) adds the range to the existing selection;
 * otherwise the range replaces it. The clicked row becomes the primary.
 */
export function selectRange(
  selection: EditorSelection,
  anchorId: string | null,
  targetId: string,
  orderedIds: readonly string[],
  additive: boolean,
): { selection: EditorSelection; anchorId: string } {
  const targetIndex = orderedIds.indexOf(targetId);
  if (targetIndex === -1) return { selection, anchorId: anchorId ?? targetId };
  const usable = (id: string | null | undefined): id is string =>
    id !== null && id !== undefined && selection.ids.includes(id) && orderedIds.includes(id);
  const anchor = usable(anchorId) ? anchorId : usable(selection.primaryId) ? selection.primaryId : targetId;
  const anchorIndex = orderedIds.indexOf(anchor);
  const [from, to] = anchorIndex <= targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex];
  const range = orderedIds.slice(from, to + 1);
  const ids = additive ? [...selection.ids, ...range.filter((id) => !selection.ids.includes(id))] : range;
  return { selection: createSelection(ids, targetId), anchorId: anchor };
}

import { create } from "zustand";
import {
  insertNode,
  moveNode,
  removeNode,
  resizeNode,
  type InsertPosition,
} from "@/features/editor/commands/documentCommands";
import { fixtureDocument } from "@/features/editor/fixtureDocument";
import { cloneNodeWithFreshIds } from "@/features/editor/utils/cloneNodeWithFreshIds";
import { findNodeById, findParentId } from "@/features/editor/utils/findNodeById";
import { resolveDeletionFallbackSelection } from "@/features/editor/utils/resolveDeletionFallbackSelection";
import { resolveDestinationParent } from "@/features/editor/utils/resolveDestinationParent";
import type { EditorClipboard } from "@/features/editor/types/clipboard";
import type { DropZone } from "@/features/editor/utils/resolveDropZone";
import type { HistoryEntry } from "@/features/editor/types/history";
import type { ElementDimensions, EditorElementNode } from "@/features/editor/types/document";

interface EditorState {
  document: EditorElementNode;
  selectedElementId: string | null;
  clipboard: EditorClipboard | null;
  past: HistoryEntry[];
  future: HistoryEntry[];
  /** Non-null while a continuous interaction (currently: resize) is mid-drag — see beginResizeTransaction. */
  transactionSnapshot: HistoryEntry | null;

  selectElement: (id: string | null) => void;
  clearSelection: () => void;
  insertElement: (
    parentId: string,
    node: EditorElementNode,
    position?: InsertPosition,
  ) => void;
  moveElement: (nodeId: string, targetId: string, zone: DropZone) => void;
  resizeElement: (nodeId: string, dimensions: ElementDimensions) => void;
  beginResizeTransaction: () => void;
  commitResizeTransaction: () => void;
  cancelResizeTransaction: () => void;

  copySelection: () => void;
  cutSelection: () => void;
  pasteClipboard: () => void;
  duplicateSelection: () => void;
  deleteSelection: () => void;
  undo: () => void;
  redo: () => void;
}

/** Snapshot of the state a history entry needs, taken *before* a mutation is applied. */
function snapshot(state: EditorState): HistoryEntry {
  return { document: state.document, selectedElementId: state.selectedElementId };
}

/** Every one-shot (non-transactional) mutation pushes the pre-mutation snapshot and clears redo. */
function pushHistory(state: EditorState): Pick<EditorState, "past" | "future"> {
  return { past: [...state.past, snapshot(state)], future: [] };
}

/**
 * The currently selected node, unless there's no selection, the
 * selection is the document root (never a valid copy/cut/duplicate/
 * delete target — see elementCapabilities), or the id no longer resolves
 * in the document. Every clipboard command opens by checking this rather
 * than re-deriving the same three conditions, and returning the resolved
 * node means callers never need an `as` assertion to use it afterward.
 */
function eligibleSelectedNode(state: EditorState): EditorElementNode | undefined {
  if (!state.selectedElementId || state.selectedElementId === state.document.id) {
    return undefined;
  }
  return findNodeById(state.document, state.selectedElementId);
}

/**
 * The editor's single source of truth for the document tree, the current
 * selection, the clipboard, and undo/redo history. The Structure panel,
 * Canvas, and Inspector all read and write through this store, so
 * selecting a row here and selecting an element on the canvas are the
 * same action from the state's point of view — there is no separate
 * "structure selection" or "canvas selection" to keep in sync.
 *
 * History (Checkpoint 3.4.3): every discrete command below pushes one
 * past entry and clears future — plain, no special-casing per command.
 * Resize is the one continuous (multi-frame) interaction in this app, so
 * it's excluded from that per-call push and instead wrapped in an
 * explicit transaction (begin at pointer-down, commit at pointer-up) so
 * an entire drag becomes exactly one undo step, not one per animation
 * frame. Move is already a single onDragEnd call with no live document
 * mutation mid-drag, so it needs no transaction of its own.
 */
export const useEditorStore = create<EditorState>()((set) => ({
  document: fixtureDocument,
  selectedElementId: null,
  clipboard: null,
  past: [],
  future: [],
  transactionSnapshot: null,

  selectElement: (id) => set({ selectedElementId: id }),
  clearSelection: () => set({ selectedElementId: null }),

  // Insertion and selecting the newly inserted node are one atomic
  // update — every insertion method (click, drag) goes through this
  // single action so "select what you just inserted" can never drift
  // out of sync with "what got inserted."
  insertElement: (parentId, node, position) =>
    set((state) => ({
      ...pushHistory(state),
      document: insertNode(state.document, parentId, node, position),
      selectedElementId: node.id,
    })),

  // Same shape as insertElement: the move and re-selecting the moved
  // node are one atomic update, so selection can never lag behind (or
  // survive) a move that was actually rejected by moveNode's own
  // validation — if moveNode no-ops, selectedElementId simply gets
  // reset to the id it already was.
  moveElement: (nodeId, targetId, zone) =>
    set((state) => ({
      ...pushHistory(state),
      document: moveNode(state.document, nodeId, targetId, zone),
      selectedElementId: nodeId,
    })),

  // Resizing never changes selection — the resized node was already
  // selected (handles only render for the current selection) and stays
  // selected, unlike insertElement/moveElement which each select their
  // own target. History is handled by the transaction wrapping this
  // call (see beginResizeTransaction/commitResizeTransaction), not here —
  // this fires once per animation frame during a drag, so pushing history
  // on every call would flood the undo stack.
  resizeElement: (nodeId, dimensions) =>
    set((state) => ({
      document: resizeNode(state.document, nodeId, dimensions),
    })),

  beginResizeTransaction: () =>
    set((state) => (state.transactionSnapshot ? {} : { transactionSnapshot: snapshot(state) })),

  commitResizeTransaction: () =>
    set((state) => {
      if (!state.transactionSnapshot) return {};
      return { past: [...state.past, state.transactionSnapshot], future: [], transactionSnapshot: null };
    }),

  // Discards the in-progress transaction without recording it — used
  // when a resize drag is cancelled (Escape) rather than completed. The
  // caller is responsible for restoring state.document to the snapshot
  // itself before calling this, since cancellation needs to revert the
  // live document too, not just skip the history push.
  cancelResizeTransaction: () => set({ transactionSnapshot: null }),

  copySelection: () =>
    set((state) => {
      const node = eligibleSelectedNode(state);
      if (!node) return {};
      const sourceParentId = findParentId(state.document, node.id);
      return { clipboard: { operation: "copy", nodes: [node], sourceParentId } };
    }),

  cutSelection: () =>
    set((state) => {
      const node = eligibleSelectedNode(state);
      if (!node) return {};
      const sourceParentId = findParentId(state.document, node.id);
      const document = removeNode(state.document, node.id);
      return {
        ...pushHistory(state),
        document,
        selectedElementId: resolveDeletionFallbackSelection(sourceParentId, state.document.id),
        clipboard: { operation: "cut", nodes: [node], sourceParentId },
      };
    }),

  pasteClipboard: () =>
    set((state) => {
      const sourceNode = state.clipboard?.nodes[0];
      if (!sourceNode) return {};
      const destinationParentId = resolveDestinationParent(
        state.document,
        state.selectedElementId,
        state.clipboard?.sourceParentId,
      );
      const clone = cloneNodeWithFreshIds(sourceNode);
      return {
        ...pushHistory(state),
        document: insertNode(state.document, destinationParentId, clone),
        selectedElementId: clone.id,
      };
    }),

  duplicateSelection: () =>
    set((state) => {
      const node = eligibleSelectedNode(state);
      if (!node) return {};
      const parentId = findParentId(state.document, node.id);
      if (!parentId) return {};
      const clone = cloneNodeWithFreshIds(node);
      const document = insertNode(state.document, parentId, clone, {
        referenceId: node.id,
        placement: "after",
      });
      return { ...pushHistory(state), document, selectedElementId: clone.id };
    }),

  deleteSelection: () =>
    set((state) => {
      const node = eligibleSelectedNode(state);
      if (!node) return {};
      const parentId = findParentId(state.document, node.id);
      const document = removeNode(state.document, node.id);
      return {
        ...pushHistory(state),
        document,
        selectedElementId: resolveDeletionFallbackSelection(parentId, state.document.id),
      };
    }),

  undo: () =>
    set((state) => {
      if (state.past.length === 0) return {};
      const previous = state.past[state.past.length - 1];
      return {
        document: previous.document,
        selectedElementId: previous.selectedElementId,
        past: state.past.slice(0, -1),
        future: [snapshot(state), ...state.future],
      };
    }),

  redo: () =>
    set((state) => {
      if (state.future.length === 0) return {};
      const [next, ...rest] = state.future;
      return {
        document: next.document,
        selectedElementId: next.selectedElementId,
        past: [...state.past, snapshot(state)],
        future: rest,
      };
    }),
}));

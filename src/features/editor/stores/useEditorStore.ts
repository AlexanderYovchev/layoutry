import { create } from "zustand";
import {
  insertNode,
  moveNode,
  removeNode,
  resizeNode,
  setAspectRatioLocked as setAspectRatioLockedCommand,
  setElementDimensions as setElementDimensionsCommand,
  setElementText as setElementTextCommand,
  type InsertPosition,
} from "@/features/editor/commands/documentCommands";
import {
  applyFreeContainerChildGeometries,
  convertToFlowLayout,
  convertToFreeLayout,
  setChildResizePolicyForNode,
  setFreeChildGeometry as setFreeChildGeometryCommand,
  type FreeContainerSelfUpdate,
} from "@/features/editor/commands/layoutCommands";
import {
  setFlexChildSettings as setFlexChildSettingsCommand,
  setFlexContainerSettings as setFlexContainerSettingsCommand,
  setFlowDisplayMode as setFlowDisplayModeCommand,
  setGridChildSettings as setGridChildSettingsCommand,
  setGridContainerSettings as setGridContainerSettingsCommand,
} from "@/features/editor/commands/flowLayoutCommands";
import { setElementMargin as setElementMarginCommand, setElementPadding as setElementPaddingCommand } from "@/features/editor/commands/spacingCommands";
import { setMediaFitSettings as setMediaFitSettingsCommand } from "@/features/editor/commands/mediaFitCommands";
import { setTypographySettings as setTypographySettingsCommand } from "@/features/editor/commands/typographyCommands";
import { setBackgroundSettings as setBackgroundSettingsCommand } from "@/features/editor/commands/backgroundCommands";
import { setBorderSettings as setBorderSettingsCommand } from "@/features/editor/commands/borderCommands";
import { setBorderRadiusSettings as setBorderRadiusSettingsCommand } from "@/features/editor/commands/borderRadiusCommands";
import { setBoxShadowSettings as setBoxShadowSettingsCommand } from "@/features/editor/commands/boxShadowCommands";
import { setFilterSettings as setFilterSettingsCommand } from "@/features/editor/commands/filterCommands";
import { setDisplaySettings as setDisplaySettingsCommand } from "@/features/editor/commands/displayCommands";
import { setPositionSettings as setPositionSettingsCommand } from "@/features/editor/commands/positionCommands";
import { setAspectRatio as setAspectRatioCommand } from "@/features/editor/commands/aspectRatioCommands";
import { setSizeConstraints as setSizeConstraintsCommand } from "@/features/editor/commands/sizeConstraintsCommands";
import { clampGridChildPlacement } from "@/features/editor/utils/clampGridChildPlacement";
import { fixtureDocument } from "@/features/editor/fixtureDocument";
import { cloneNodeWithFreshIds } from "@/features/editor/utils/cloneNodeWithFreshIds";
import { findNodeById, findParentId } from "@/features/editor/utils/findNodeById";
import { resolveFreeDestinationPlacement } from "@/features/editor/utils/resolveFreeDestinationPlacement";
import { resolveDeletionFallbackSelection } from "@/features/editor/utils/resolveDeletionFallbackSelection";
import { resolveDestinationParent } from "@/features/editor/utils/resolveDestinationParent";
import { getGridContainerSettings } from "@/features/editor/types/flowLayout";
import type { EditorClipboard } from "@/features/editor/types/clipboard";
import type { DropZone } from "@/features/editor/utils/resolveDropZone";
import type { HistoryEntry } from "@/features/editor/types/history";
import type { ElementDimensions, EditorElementNode } from "@/features/editor/types/document";
import type { ChildResizePolicy, FreeLayoutGeometry } from "@/features/editor/types/layout";
import type {
  FlexChildSettings,
  FlexContainerSettings,
  FlowDisplayMode,
  GridChildSettings,
  GridContainerSettings,
} from "@/features/editor/types/flowLayout";
import type { EdgeValues } from "@/features/editor/types/spacing";
import type { MediaFitSettings } from "@/features/editor/types/mediaFit";
import type { TypographySettings } from "@/features/editor/types/typography";
import type { BackgroundSettings } from "@/features/editor/types/background";
import type { BorderSettings } from "@/features/editor/types/border";
import type { BorderRadiusSettings } from "@/features/editor/types/borderRadius";
import type { BoxShadowSettings } from "@/features/editor/types/boxShadow";
import type { FilterSettings } from "@/features/editor/types/filters";
import type { DisplaySettings } from "@/features/editor/types/display";
import type { PositionSettings } from "@/features/editor/types/position";
import type { AspectRatioValue } from "@/features/editor/types/aspectRatio";
import type { SizeConstraints } from "@/features/editor/types/sizeConstraints";

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

  /** One-shot Free-layout geometry edit (e.g. the Inspector's X/Y/Width/Height fields) — pushes its own history entry, same shape as resizeElement vs. a resize drag. */
  setFreeChildGeometry: (nodeId: string, geometry: FreeLayoutGeometry) => void;
  /** Per-frame Free-layout geometry write during a live drag/resize session — no history push; wrap in begin/commitResizeTransaction, same convention resize already established. */
  setFreeChildGeometryLive: (nodeId: string, geometry: FreeLayoutGeometry) => void;
  /** Per-frame atomic write of a Free container's own geometry plus its direct children's scaled/clamped geometries during a live parent-resize session — no history push. */
  applyFreeContainerChildGeometriesLive: (
    containerId: string,
    selfUpdate: FreeContainerSelfUpdate,
    childGeometries: Record<string, FreeLayoutGeometry>,
  ) => void;
  setChildResizePolicy: (containerId: string, policy: ChildResizePolicy) => void;
  /** Flow -> Free conversion — one atomic, one-history-entry write (see useConvertContainerToFreeLayout for the DOM measurement step that produces childGeometries and selfUpdate, the container's own measured size). */
  convertToFreeLayout: (
    containerId: string,
    childGeometries: Record<string, FreeLayoutGeometry>,
    selfUpdate?: FreeContainerSelfUpdate,
  ) => void;
  /** Free -> Flow conversion — one atomic, one-history-entry write. */
  convertToFlowLayout: (containerId: string) => void;

  /** Block/Flex/Grid — retains previously-set flex/grid sub-settings across switches (Checkpoint 3.5). */
  setFlowDisplayMode: (containerId: string, display: FlowDisplayMode) => void;
  setFlexContainerSettings: (containerId: string, settings: FlexContainerSettings) => void;
  setGridContainerSettings: (containerId: string, settings: GridContainerSettings) => void;
  /** Margin never affects Free content bounds — a plain field set, no side effects. */
  setElementMargin: (nodeId: string, margin: EdgeValues) => void;
  /** The containment-critical one: re-normalizes a Free container's direct children into its new (padding-adjusted) content bounds in the same atomic write — see spacingCommands.setElementPadding. */
  setElementPadding: (nodeId: string, padding: EdgeValues) => void;
  setFlexChildSettings: (nodeId: string, settings: FlexChildSettings) => void;
  /** Column/row start+span are clamped to the parent's current Grid track counts before being applied — see the implementation for why that happens here rather than in the pure command. */
  setGridChildSettings: (nodeId: string, settings: GridChildSettings) => void;
  /** A node's own object-fit/object-position for intrinsic media (Checkpoint 3.5.1, restructured in Checkpoint 5.6 — see types/mediaFit.ts's own doc comment). `undefined` clears it entirely (see withMediaFitField/withMediaFitPosition/clearMediaFitPosition). */
  setMediaFitSettings: (nodeId: string, settings: MediaFitSettings | undefined) => void;
  /** A node's own text styling (Checkpoint 4.2) — see resolveTypographyStyle. `undefined` clears it entirely (see withTypographyField). */
  setElementTypography: (nodeId: string, typography: TypographySettings | undefined) => void;
  /** A node's own background styling (Checkpoint 4.3) — see resolveBackgroundStyle. `undefined` clears it entirely (see withBackgroundField/withBackgroundSize). */
  setElementBackground: (nodeId: string, background: BackgroundSettings | undefined) => void;
  /** Per-frame background write during a live drag session (Checkpoint 4.3.1 — gradient stop dragging) — no history push; wrap in begin/commitTransaction, same convention setFreeChildGeometryLive already established. */
  setElementBackgroundLive: (nodeId: string, background: BackgroundSettings | undefined) => void;
  setElementBorder: (nodeId: string, border: BorderSettings | undefined) => void;
  setElementBorderRadius: (nodeId: string, borderRadius: BorderRadiusSettings | undefined) => void;
  /** This node's own box-shadow layer stack (Checkpoint 4.6) — see resolveBoxShadowStyle. `undefined` clears it entirely. */
  setElementBoxShadow: (nodeId: string, boxShadow: BoxShadowSettings | undefined) => void;
  /** Per-frame box-shadow write during a live drag-reorder session (Checkpoint 4.6) — no history push; wrap in begin/commitTransaction, the same convention setElementBackgroundLive established for gradient stop dragging. */
  setElementBoxShadowLive: (nodeId: string, boxShadow: BoxShadowSettings | undefined) => void;
  /** This node's own visual effects (Checkpoint 4.7) — see resolveFilterStyle. `undefined` clears it entirely. No continuous-drag variant: every filter field is a discrete numeric commit, like Typography, not a draggable gesture. */
  setElementFilters: (nodeId: string, filters: FilterSettings | undefined) => void;
  /** This node's own display/visibility/overflow/interaction settings (Checkpoint 4.8) — see resolveDisplayStyle. `undefined` clears it entirely. No continuous-drag variant: every field here is a discrete enum commit, like Filters, not a draggable gesture. */
  setElementDisplay: (nodeId: string, display: DisplaySettings | undefined) => void;
  /** This node's own CSS `position` (Checkpoint 5.1) — see resolvePositionStyle. `undefined` clears it entirely. No continuous-drag variant: a single enum commit, like Display. */
  setElementPosition: (nodeId: string, position: PositionSettings | undefined) => void;
  /** This node's own CSS `aspect-ratio` (Checkpoint 5.5) — see resolveAspectRatioStyle. `undefined` clears it entirely (distinct from an explicit `{ mode: "auto" }` — see types/aspectRatio.ts's own doc comment). No continuous-drag variant: a single preset/custom-value commit, like Position/Display. Not to be confused with the pre-existing `aspectRatioLocked` resize-interaction flag, which this action never touches. */
  setElementAspectRatio: (nodeId: string, aspectRatio: AspectRatioValue | undefined) => void;
  /** This node's own CSS min/max sizing constraints (Checkpoint 5.7) — see resolveSizeConstraintsStyle. `undefined` clears them entirely (see withSizeConstraintField). */
  setSizeConstraints: (nodeId: string, constraints: SizeConstraints | undefined) => void;
  /** One-shot Flow Width/Height edit (Checkpoint 5.7 — the Inspector's own Size section, as opposed to resizeElement's per-frame pointer-drag writes) — pushes its own single history entry. `undefined` clears both axes back to natural Flow sizing (ElementDimensions stays atomic — see setElementDimensions's own doc comment). */
  setElementDimensions: (nodeId: string, dimensions: ElementDimensions | undefined) => void;
  /** Overrides the tag-based default resize-proportion-lock behavior (Checkpoint 5.7 — see EditorElementNode.aspectRatioLocked's own doc comment, and getEffectiveAspectRatioLocked for how `undefined` resolves). Only meaningful for a Free child's corner resize handles today — see useFreeChildResizeSession. `undefined` clears the override and returns to the tag's own capability-derived default. */
  setAspectRatioLocked: (nodeId: string, locked: boolean | undefined) => void;
  /**
   * One-shot text-content edit (Checkpoint 1.3 — Canvas double-click text
   * editing). Pushes exactly one history entry per call, same shape as
   * every other one-shot command here; the Canvas editing session itself
   * (see useEditableText) is what guarantees this is called at most once
   * per edit — while the user types, nothing is written to the store at
   * all (native contentEditable owns the DOM until commit), so an
   * editing session is always one undo step, never one per keystroke.
   * Tag-agnostic — see setElementText's own doc comment.
   */
  setElementText: (nodeId: string, text: string) => void;

  /**
   * Generic continuous-interaction transaction (Checkpoint 4.3.1) — the
   * exact same shared `transactionSnapshot` mechanism begin/
   * commitResizeTransaction already established, exposed under a
   * domain-neutral name for any Inspector-driven continuous drag
   * (currently: gradient stop dragging — see InspectorGradientStopTrack)
   * that needs "one history entry for the whole gesture," not one per
   * pointer-move. Deliberately a separate pair of actions rather than
   * reusing the resize-named ones directly: those are Canvas-resize
   * entry points, and calling a function named beginResizeTransaction
   * from a Gradient Inspector control would misleadingly imply a resize
   * is happening. Both pairs read/write the same `transactionSnapshot`
   * slot and are safely mutually exclusive — only one continuous
   * interaction is ever active at a time in this single-selection editor.
   */
  beginTransaction: () => void;
  commitTransaction: () => void;
  cancelTransaction: () => void;

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

  setFreeChildGeometry: (nodeId, geometry) =>
    set((state) => ({
      ...pushHistory(state),
      document: setFreeChildGeometryCommand(state.document, nodeId, geometry),
    })),

  setFreeChildGeometryLive: (nodeId, geometry) =>
    set((state) => ({
      document: setFreeChildGeometryCommand(state.document, nodeId, geometry),
    })),

  applyFreeContainerChildGeometriesLive: (containerId, selfUpdate, childGeometries) =>
    set((state) => ({
      document: applyFreeContainerChildGeometries(state.document, containerId, selfUpdate, childGeometries),
    })),

  setChildResizePolicy: (containerId, policy) =>
    set((state) => ({
      ...pushHistory(state),
      document: setChildResizePolicyForNode(state.document, containerId, policy),
    })),

  convertToFreeLayout: (containerId, childGeometries, selfUpdate) =>
    set((state) => ({
      ...pushHistory(state),
      document: convertToFreeLayout(state.document, containerId, childGeometries, selfUpdate),
    })),

  convertToFlowLayout: (containerId) =>
    set((state) => ({
      ...pushHistory(state),
      document: convertToFlowLayout(state.document, containerId),
    })),

  setFlowDisplayMode: (containerId, display) =>
    set((state) => ({
      ...pushHistory(state),
      document: setFlowDisplayModeCommand(state.document, containerId, display),
    })),

  setFlexContainerSettings: (containerId, settings) =>
    set((state) => ({
      ...pushHistory(state),
      document: setFlexContainerSettingsCommand(state.document, containerId, settings),
    })),

  setGridContainerSettings: (containerId, settings) =>
    set((state) => ({
      ...pushHistory(state),
      document: setGridContainerSettingsCommand(state.document, containerId, settings),
    })),

  setElementMargin: (nodeId, margin) =>
    set((state) => ({
      ...pushHistory(state),
      document: setElementMarginCommand(state.document, nodeId, margin),
    })),

  setElementPadding: (nodeId, padding) =>
    set((state) => ({
      ...pushHistory(state),
      document: setElementPaddingCommand(state.document, nodeId, padding),
    })),

  setFlexChildSettings: (nodeId, settings) =>
    set((state) => ({
      ...pushHistory(state),
      document: setFlexChildSettingsCommand(state.document, nodeId, settings),
    })),

  // Grid track bounds are only cheaply known here (the parent is one
  // findParentId/findNodeById lookup away), so the clamp lives at this
  // boundary rather than inside the pure recursive command, which stays
  // a plain "set this field" — see setGridChildSettings on the store
  // interface.
  setGridChildSettings: (nodeId, settings) =>
    set((state) => {
      const parentId = findParentId(state.document, nodeId);
      const parent = parentId ? findNodeById(state.document, parentId) : undefined;
      const grid = parent ? getGridContainerSettings(parent) : undefined;

      const clamped: GridChildSettings = grid ? clampGridChildPlacement(settings, grid) : settings;

      return {
        ...pushHistory(state),
        document: setGridChildSettingsCommand(state.document, nodeId, clamped),
      };
    }),

  setMediaFitSettings: (nodeId, settings) =>
    set((state) => ({
      ...pushHistory(state),
      document: setMediaFitSettingsCommand(state.document, nodeId, settings),
    })),

  setElementTypography: (nodeId, typography) =>
    set((state) => ({
      ...pushHistory(state),
      document: setTypographySettingsCommand(state.document, nodeId, typography),
    })),

  setElementBackground: (nodeId, background) =>
    set((state) => ({
      ...pushHistory(state),
      document: setBackgroundSettingsCommand(state.document, nodeId, background),
    })),

  setElementBackgroundLive: (nodeId, background) =>
    set((state) => ({
      document: setBackgroundSettingsCommand(state.document, nodeId, background),
    })),

  setElementBorder: (nodeId, border) =>
    set((state) => ({
      ...pushHistory(state),
      document: setBorderSettingsCommand(state.document, nodeId, border),
    })),

  setElementBorderRadius: (nodeId, borderRadius) =>
    set((state) => ({
      ...pushHistory(state),
      document: setBorderRadiusSettingsCommand(state.document, nodeId, borderRadius),
    })),

  setElementBoxShadow: (nodeId, boxShadow) =>
    set((state) => ({
      ...pushHistory(state),
      document: setBoxShadowSettingsCommand(state.document, nodeId, boxShadow),
    })),

  setElementBoxShadowLive: (nodeId, boxShadow) =>
    set((state) => ({
      document: setBoxShadowSettingsCommand(state.document, nodeId, boxShadow),
    })),

  setElementFilters: (nodeId, filters) =>
    set((state) => ({
      ...pushHistory(state),
      document: setFilterSettingsCommand(state.document, nodeId, filters),
    })),

  setElementDisplay: (nodeId, display) =>
    set((state) => ({
      ...pushHistory(state),
      document: setDisplaySettingsCommand(state.document, nodeId, display),
    })),

  setElementPosition: (nodeId, position) =>
    set((state) => ({
      ...pushHistory(state),
      document: setPositionSettingsCommand(state.document, nodeId, position),
    })),

  setElementAspectRatio: (nodeId, aspectRatio) =>
    set((state) => ({
      ...pushHistory(state),
      document: setAspectRatioCommand(state.document, nodeId, aspectRatio),
    })),

  setSizeConstraints: (nodeId, constraints) =>
    set((state) => ({
      ...pushHistory(state),
      document: setSizeConstraintsCommand(state.document, nodeId, constraints),
    })),

  setElementDimensions: (nodeId, dimensions) =>
    set((state) => ({
      ...pushHistory(state),
      document: setElementDimensionsCommand(state.document, nodeId, dimensions),
    })),

  setAspectRatioLocked: (nodeId, locked) =>
    set((state) => ({
      ...pushHistory(state),
      document: setAspectRatioLockedCommand(state.document, nodeId, locked),
    })),

  setElementText: (nodeId, text) =>
    set((state) => ({
      ...pushHistory(state),
      document: setElementTextCommand(state.document, nodeId, text),
    })),

  beginTransaction: () =>
    set((state) => (state.transactionSnapshot ? {} : { transactionSnapshot: snapshot(state) })),

  commitTransaction: () =>
    set((state) => {
      if (!state.transactionSnapshot) return {};
      return { past: [...state.past, state.transactionSnapshot], future: [], transactionSnapshot: null };
    }),

  cancelTransaction: () => set({ transactionSnapshot: null }),

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
      const clone = resolveFreeDestinationPlacement(
        state.document,
        destinationParentId,
        cloneNodeWithFreshIds(sourceNode),
      );
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
      const clone = resolveFreeDestinationPlacement(state.document, parentId, cloneNodeWithFreshIds(node));
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

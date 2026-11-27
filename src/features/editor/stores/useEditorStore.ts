import { create } from "zustand";
import { canActivateInteractions } from "@/features/editor/rules/accessibilityAttributes";
import { withoutCopiedCurrentState, type PaginationControlRole } from "@/features/editor/types/pagination";
import {
  applySectionSettings,
  type SectionSettingsKey,
  type SectionSettingsValues,
} from "@/features/editor/commands/sectionSettingsCommands";
import {
  addPaginationPage as addPaginationPageCommand,
  normalizePaginationsAfterEdit,
  removePaginationPage as removePaginationPageCommand,
  setPaginationControlVisible as setPaginationControlVisibleCommand,
  setPaginationCurrentPage as setPaginationCurrentPageCommand,
  setPaginationPageHref as setPaginationPageHrefCommand,
  setPaginationPageLabel as setPaginationPageLabelCommand,
} from "@/features/editor/commands/paginationCommands";
import {
  insertNode,
  removeNode,
  resizeNode,
  setAspectRatioLocked as setAspectRatioLockedCommand,
  setElementAutoplay as setElementAutoplayCommand,
  setElementChecked as setElementCheckedCommand,
  setElementClassName as setElementClassNameCommand,
  setElementControls as setElementControlsCommand,
  setElementDimensions as setElementDimensionsCommand,
  setElementHref as setElementHrefCommand,
  setElementHtmlId as setElementHtmlIdCommand,
  setElementInputType as setElementInputTypeCommand,
  setElementLoop as setElementLoopCommand,
  setElementMuted as setElementMutedCommand,
  setElementName as setElementNameCommand,
  setElementPlaceholder as setElementPlaceholderCommand,
  setElementPoster as setElementPosterCommand,
  setElementSrc as setElementSrcCommand,
  setImageAltText as setImageAltTextCommand,
  setElementTag as setElementTagCommand,
  setElementText as setElementTextCommand,
  setElementTitle as setElementTitleCommand,
  setElementLockChildStyles as setElementLockChildStylesCommand,
  setElementValue as setElementValueCommand,
  setListItemCount as setListItemCountCommand,
  setOptionCount as setOptionCountCommand,
  setSelectSelectedOption as setSelectSelectedOptionCommand,
  type InsertPosition,
} from "@/features/editor/commands/documentCommands";
import {
  addInteraction as addInteractionCommand,
  removeInteraction as removeInteractionCommand,
  removeInteractionsForRemovedNodes,
  removeInteractionsTargeting,
  removeInteractionsWithMissingTargets,
  setInitialPreviewVisibility as setInitialPreviewVisibilityCommand,
  updateInteraction as updateInteractionCommand,
} from "@/features/editor/commands/interactionCommands";
import {
  setTableBodyRowCount as setTableBodyRowCountCommand,
  setTableCaptionEnabled as setTableCaptionEnabledCommand,
  setTableColumnCount as setTableColumnCountCommand,
  setTableFooterEnabled as setTableFooterEnabledCommand,
  setTableHeaderEnabled as setTableHeaderEnabledCommand,
} from "@/features/editor/commands/tableCommands";
import {
  createNavigationLink,
  getNavigationLinks,
  insertNavigationLink,
  MAX_NAVIGATION_LINKS,
  moveNavigationLink as moveNavigationLinkCommand,
  removeNavigationLink as removeNavigationLinkCommand,
  type NavigationLinkMoveDirection,
} from "@/features/editor/commands/navigationLinkCommands";
import {
  setElementProgressIndeterminate as setElementProgressIndeterminateCommand,
  setElementProgressMax as setElementProgressMaxCommand,
  setElementProgressValue as setElementProgressValueCommand,
} from "@/features/editor/commands/progressCommands";
import type { InputType } from "@/features/editor/types/input";
import {
  applyFreeContainerChildGeometries,
  convertToFlowLayout,
  convertToFreeLayout,
  setChildResizePolicyForNode,
  restoreFreeLayouts as restoreFreeLayoutsCommand,
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
import { setElementShape as setElementShapeCommand } from "@/features/editor/commands/shapeCommands";
import {
  setSvgFill as setSvgFillCommand,
  setSvgKind as setSvgKindCommand,
  setSvgStroke as setSvgStrokeCommand,
  setSvgStrokeWidth as setSvgStrokeWidthCommand,
  setSvgViewBox as setSvgViewBoxCommand,
} from "@/features/editor/commands/svgCommands";
import {
  addSvgObject as addSvgObjectCommand,
  generateSvgObjectId,
  materializeSvgStarterIntoScene,
  removeSvgObjects as removeSvgObjectsCommand,
  resizeSvgObject as resizeSvgObjectCommand,
  setSvgLineEndpoint as setSvgLineEndpointCommand,
  setSvgLineStart as setSvgLineStartCommand,
  setSvgObjectsFill as setSvgObjectsFillCommand,
  setSvgObjectsStroke as setSvgObjectsStrokeCommand,
  setSvgObjectsStrokeWidth as setSvgObjectsStrokeWidthCommand,
  translateSvgObjects as translateSvgObjectsCommand,
} from "@/features/editor/commands/svgSceneCommands";
import { resolveSvgObjectCreationStyle } from "@/features/editor/utils/svgObjectDefaults";
import { setBoxShadowSettings as setBoxShadowSettingsCommand } from "@/features/editor/commands/boxShadowCommands";
import { setFilterSettings as setFilterSettingsCommand } from "@/features/editor/commands/filterCommands";
import { setElementTransition as setElementTransitionCommand } from "@/features/editor/commands/transitionCommands";
import { setElementTransform as setElementTransformCommand } from "@/features/editor/commands/transformCommands";
import { setDisplaySettings as setDisplaySettingsCommand } from "@/features/editor/commands/displayCommands";
import { setPositionSettings as setPositionSettingsCommand } from "@/features/editor/commands/positionCommands";
import { setAspectRatio as setAspectRatioCommand } from "@/features/editor/commands/aspectRatioCommands";
import { setSizeConstraints as setSizeConstraintsCommand } from "@/features/editor/commands/sizeConstraintsCommands";
import {
  normalizeSelectionRoots,
  removeNodesByIds,
  setElementsAspectRatio as setElementsAspectRatioCommand,
  setElementsBackgroundField as setElementsBackgroundFieldCommand,
  setElementsBorderAllSidesField as setElementsBorderAllSidesFieldCommand,
  setElementsBorderRadiusAllCorners as setElementsBorderRadiusAllCornersCommand,
  setElementsDimensions as setElementsDimensionsCommand,
  setElementsDisplayField as setElementsDisplayFieldCommand,
  setElementsFilterField as setElementsFilterFieldCommand,
  setElementsMediaFitField as setElementsMediaFitFieldCommand,
  setElementsPositionField as setElementsPositionFieldCommand,
  setElementsShape as setElementsShapeCommand,
  setElementsTransition as setElementsTransitionCommand,
  setElementsTransitionField as setElementsTransitionFieldCommand,
  setElementsTransform as setElementsTransformCommand,
  setElementsTransformField as setElementsTransformFieldCommand,
  setElementsSizeConstraintField as setElementsSizeConstraintFieldCommand,
  setElementsSpacingAllSides as setElementsSpacingAllSidesCommand,
  setElementsSvgFill as setElementsSvgFillCommand,
  setElementsSvgKind as setElementsSvgKindCommand,
  setElementsSvgStroke as setElementsSvgStrokeCommand,
  setElementsSvgStrokeWidth as setElementsSvgStrokeWidthCommand,
  setElementsTypographyField as setElementsTypographyFieldCommand,
} from "@/features/editor/commands/bulkCommands";
import {
  addSelectionId,
  createSelection,
  EMPTY_SELECTION,
  selectionFromSingle,
  toggleSelectionId,
  selectRange as selectRangeOf,
  type EditorSelection,
} from "@/features/editor/types/selection";
import { describeStyleLockNotice, getReadableNodeName, getStyleProtection, type StyleProtectionResult } from "@/features/editor/rules/styleProtection";
import { applyStyleSnapshot, captureStyleSnapshot, isEmptyStyleSnapshot, STYLE_GROUP_KEYS, styleGroupLabel } from "@/features/editor/commands/styleClipboardCommands";
import type { StyleClipboard, StyleGroupKey } from "@/features/editor/types/styleClipboard";
import { documentFitsSaveLimit, subtreeHasEmbeddedData } from "@/features/editor/rules/documentSaveLimitGuard";
import { clampGridChildPlacement } from "@/features/editor/utils/clampGridChildPlacement";
import { fixtureDocument } from "@/features/editor/fixtureDocument";
import { cloneNodeWithFreshIds } from "@/features/editor/utils/cloneNodeWithFreshIds";
import { COUNTER_LIMIT_PASTE_NOTICE, copiedCounterContext, exceedsCounterDefinitionLimit, reconcilePastedCounters } from "@/features/editor/commands/counterReferenceCommands";
import { isStructurallyEqual } from "@/features/editor/utils/isStructurallyEqual";
import { collectNodeIds } from "@/features/editor/utils/collectNodeIds";
import { findNodeById, findParentId } from "@/features/editor/utils/findNodeById";
import { interruptActiveInteraction } from "@/features/editor/utils/activeInteraction";
import { resolveFreeDestinationPlacement } from "@/features/editor/utils/resolveFreeDestinationPlacement";
import { moveBatchRejectedMessage, moveRejectedMessage, planMove, type MoveOutcome } from "@/features/editor/commands/moveCommands";
import { planMultiMove } from "@/features/editor/commands/multiMoveCommands";
import { getElementDisplayName } from "@/features/editor/utils/elementDisplayName";
import { writeSnapPreference } from "@/features/editor/utils/snapPreference";
import { resolveDeletionFallbackSelection } from "@/features/editor/utils/resolveDeletionFallbackSelection";
import { resolveDestinationParent } from "@/features/editor/utils/resolveDestinationParent";
import { getGridContainerSettings } from "@/features/editor/types/flowLayout";
import type { EditorClipboard } from "@/features/editor/types/clipboard";
import { duplicateRootsInPlace, exceedsNavigationLinkLimit, existingSelectedIds, orderedSelectionRoots, pasteCopiesInto, type CopiesRejection } from "@/features/editor/commands/multiClipboardCommands";
import { withUniqueHtmlIdsForCopies } from "@/features/editor/utils/uniqueHtmlIdsForCopies";
import type { DropZone } from "@/features/editor/utils/resolveDropZone";
import type { HistoryEntry } from "@/features/editor/types/history";
import type { LiveGestureSlice } from "@/features/editor/types/liveGesture";
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
import type { CssLengthValue, TypographySettings } from "@/features/editor/types/typography";
import type { BackgroundSettings } from "@/features/editor/types/background";
import type { BorderSettings, BorderSideSettings } from "@/features/editor/types/border";
import type { BorderRadiusSettings } from "@/features/editor/types/borderRadius";
import type { ShapePreset } from "@/features/editor/types/shape";
import type { SvgPrimitiveKind, SvgViewBox } from "@/features/editor/types/svg";
import type { SvgDrawingTool, SvgDraft } from "@/features/editor/types/svgEditMode";
import type { ActiveSnapGuides, FreeInsertionPreview } from "@/features/editor/types/snap";
import { hasSvgScene } from "@/features/editor/types/svgScene";
import type { SvgPathCommand, SvgVectorObject, SvgVectorPoint } from "@/features/editor/types/svgScene";
import { isValidSvgPath, isValidSvgPolygon } from "@/features/editor/utils/svgObjectGeometry";
import type { SvgObjectBounds } from "@/features/editor/utils/svgObjectGeometry";
import type { BoxShadowSettings } from "@/features/editor/types/boxShadow";
import type { FilterSettings } from "@/features/editor/types/filters";
import type { TransitionSettings } from "@/features/editor/types/transition";
import type { TransformSettings } from "@/features/editor/types/transform";
import type { DisplaySettings } from "@/features/editor/types/display";
import type { PositionSettings } from "@/features/editor/types/position";
import type { AspectRatioValue } from "@/features/editor/types/aspectRatio";
import type { SizeConstraints } from "@/features/editor/types/sizeConstraints";
import { DEFAULT_EDITOR_MODE, type EditorMode } from "@/features/editor/types/editorMode";
import { getInteractions, type InteractionAction } from "@/features/editor/types/interactions";
import { getInitialPreviewVisibility, type InitialPreviewVisibility } from "@/features/editor/types/previewVisibility";

interface EditorState {
  document: EditorElementNode;
  /**
   * The editor's multi-selection state (Checkpoint 1.15.2 — see
   * types/selection.ts's own doc comment for the full model). This
   * field's own `ids` may contain a now-deleted id for one render (it's
   * only pruned lazily, at read time — see useSelectedNodes/
   * normalizeSelection), so nothing should read `selection` directly for
   * anything beyond "what did the user last ask to have selected"; every
   * consumer that needs "what's actually still selectable right now"
   * goes through useSelectedNodes instead.
   */
  selection: EditorSelection;
  /**
   * The Structure panel's range anchor (BC-10.2): the last row plainly
   * clicked or Ctrl/Cmd-clicked. Transient editor state, never saved; only
   * used while it is still selected (see selectRange in types/selection).
   */
  selectionAnchorId: string | null;
  /**
   * A requested multi-element delete waiting for confirmation (BC-10.2).
   * Captures the exact targets when requested; confirming revalidates
   * them. Never part of history or the saved document.
   */
  pendingDeletion: PendingDeletion | null;
  clipboard: EditorClipboard | null;
  /**
   * BC-11.2: the CSS clipboard — an authored-CSS snapshot from Copy CSS.
   * Independent of the element clipboard (copying one never replaces the
   * other); session-only like it: kept across project loads, never in
   * history, never saved.
   */
  styleClipboard: StyleClipboard | null;
  past: HistoryEntry[];
  future: HistoryEntry[];
  /** Non-null while a continuous interaction (currently: resize) is mid-drag — see beginResizeTransaction. */
  transactionSnapshot: HistoryEntry | null;
  /**
   * The transactionSnapshot of a transaction opened with
   * `beginTransaction({ mergeHistory: true })` (BC-01.3) — while it is the
   * SAME object as transactionSnapshot, pushHistory folds every one-shot
   * mutation into that open transaction instead of recording its own
   * entry. Compared by identity, so any path that clears or replaces
   * transactionSnapshot (commit, cancel, Preview, loading a project)
   * ends the merge automatically; a stale value here is inert.
   */
  historyMergeSnapshot: HistoryEntry | null;
  /**
   * BC-17.3 — the live geometry gesture (BC-17.1.3 Report 1 §8.11): which
   * nodes the open transaction is writing live geometry (or a gradient's
   * background layers) for, and which slice. The generated stylesheet keeps
   * compiling those nodes' COMMITTED state from `snapshot` while each node
   * paints its live slice inline. Valid only while `snapshot` is the SAME
   * object as transactionSnapshot (selectActiveLiveGesture), so committing,
   * cancelling, entering Preview or replacing the document ends it with no
   * explicit cleanup; a stale value is inert. Never saved or exported.
   */
  liveGesture: LiveGestureState | null;
  /**
   * The one transient, non-modal editor message currently visible
   * (Checkpoint 1.15.3 — e.g. a blocked-by-style-protection notice). Never
   * a queue: a new message always replaces whatever's showing (see
   * showEditorNotice). `id` increments only when the message text actually
   * changes, so a continuous stream of identical blocked-attempt notices
   * (e.g. dragging a locked node) never restarts EditorNoticeBanner's own
   * auto-dismiss timer — see showEditorNotice's own doc comment. Editor
   * state only, never touched by pushHistory/undo/redo.
   */
  editorNotice: { message: string; id: number } | null;
  /**
   * Increments every time replaceDocument loads a different document
   * (BC-07.2). Asynchronous work that started against one document (an
   * image upload being read and decoded) compares it before committing, so
   * it can never land in a project opened in the meantime.
   */
  documentSessionId: number;

  /**
   * SVG Edit Mode (Checkpoint 1.15.6) — the id of the one SVG document
   * node currently being edited, or null while no SVG is being edited.
   * Deliberately UI state, not document state (section 11 of this
   * checkpoint's own brief) — never touched by pushHistory/undo/redo,
   * and automatically cleared by this store's own svgEditMode
   * subscription (below the store definition) the moment global
   * selection moves elsewhere or this SVG is deleted, so it can never
   * point at a stale/nonexistent node.
   */
  svgEditingNodeId: string | null;
  /** SVG-local object selection (Checkpoint 1.15.6) — completely separate from the outer document's own `selection` above; a vector object id is never a valid EditorElementNode id and must never be mixed into that selection model. May transiently contain a stale id for one render after a delete/undo, exactly like `selection.ids` already tolerates — every consumer (Inspector, Canvas overlay) filters against the live scene when rendering, the same lazy-prune convention `selection` itself uses. */
  selectedSvgObjectIds: string[];
  primarySvgObjectId: string | null;
  /** The currently active drawing tool while SVG Edit Mode is open — "select" whenever edit mode is (re-)entered (section 56 of this checkpoint's own brief: the user explicitly chooses a drawing tool, never dropped into one). */
  activeSvgTool: SvgDrawingTool;
  /** An in-progress, uncommitted Polygon/Pen path — see types/svgEditMode.ts's own doc comment. Never enters document history; Escape/cancel discards it for free by simply clearing this field. */
  svgDraft: SvgDraft | null;

  /** Free-layout Snap on/off (Checkpoint 1.15.6.1.1) — pure editor/UI preference, never document content: never pushes history, never mutates any EditorElementNode, has zero effect on exported CSS (see types/snap.ts's own doc comment). Defaults true (beginner-friendly, matches this checkpoint's own recommended default). */
  snapEnabled: boolean;
  /** The currently-active snap guide(s) for whichever Free child is mid-drag, or null between drags — ephemeral, cleared on pointerup/cancel, never entered into history (see types/snap.ts). */
  activeSnapGuides: ActiveSnapGuides | null;
  /** BC-13.6: the live Resource Panel insertion preview over a Free container, or null — ephemeral, never in the document or history. */
  freeInsertionPreview: FreeInsertionPreview | null;

  /**
   * The document as it was last loaded or saved (PROJECT-1.1). Unsaved
   * changes are detected by reference: every committed edit produces a new
   * document object, and undo/redo restore the exact snapshot objects, so
   * `document !== persistedDocument` is precise through edit → save →
   * undo → redo with no hashing. See selectHasUnsavedChanges.
   */
  persistedDocument: EditorElementNode;

  /**
   * Design vs Preview (Checkpoint 1.15.6.8) — see types/editorMode.ts's
   * own doc comment. Editor UI state, exactly like svgEditingNodeId:
   * never touched by pushHistory/undo/redo, never duplicated, never
   * export data. Defaults to "design", today's existing behavior.
   */
  editorMode: EditorMode;
  /**
   * Ephemeral Preview-only visibility overrides (Checkpoint 1.15.6.8),
   * keyed by node id — `true` visible, `false` hidden; an id with no
   * entry renders exactly as authored (the default, unset state). Never
   * touched by pushHistory/undo/redo, never persisted, and always reset
   * to `{}` on every Preview entry/exit (see enterPreview/exitPreview) so
   * one session's runtime state never leaks into the next. Shadows
   * authored `flowLayout`/`display` at RENDER time only (see
   * DocumentNodeRenderer) — executeInteractionsForNode never mutates the
   * document itself.
   */
  runtimeVisibility: Record<string, boolean>;

  /** Selects exactly this one id, replacing any existing selection — the plain-click behavior, and every internal single-target action (insert/move/duplicate/paste/undo/redo) below. `selectOnly` is the same action under an explicit name for new multi-selection-aware call sites. */
  selectElement: (id: string | null) => void;
  selectOnly: (id: string) => void;
  /** Ctrl/Cmd+click — toggles one id's membership (Checkpoint 1.15.2, Part 9). */
  toggleSelection: (id: string) => void;
  /** Shift+click on Canvas — additive only, never a toggle (Checkpoint 1.15.2, Part 10). */
  addToSelection: (id: string) => void;
  /** Structured/group selection (e.g. Table's "Select All Cells", Structure's own future sibling-range) — replaces the whole selection at once. */
  setSelection: (ids: readonly string[], primaryId?: string) => void;
  clearSelection: () => void;
  insertElement: (
    parentId: string,
    node: EditorElementNode,
    position?: InsertPosition,
  ) => void;
  /**
   * Moves one element before/after a sibling or into a container (Canvas
   * drag, Structure keyboard reorder). BC-12.2: validated by planMove (the
   * shared rules); a move to where it already is changes nothing and
   * records no history; a refused move changes nothing and shows a notice
   * with the reason. One history entry; the moved element is selected.
   * BC-12.3.1: `keepSelection` (the Structure pointer drag) keeps every
   * other selected element selected and makes the moved one primary;
   * otherwise (Canvas drag, Alt+Arrow) the moved element is the only
   * selection, as before.
   */
  moveElement: (nodeId: string, targetId: string, zone: DropZone, options?: { keepSelection?: boolean; primaryId?: string }) => MoveOutcome;
  /**
   * BC-12.4: moves the minimal roots of `ids` (document order) together to
   * one destination — the Structure multi-drag. All or nothing through
   * planMultiMove (one history entry; a refusal changes nothing and shows a
   * notice; an identical result records nothing). Every selected element
   * stays selected; `primaryId` (the dragged row) becomes primary. One
   * root is exactly moveElement with keepSelection.
   */
  moveElements: (ids: readonly string[], targetId: string, zone: DropZone, primaryId: string) => MoveOutcome;
  resizeElement: (nodeId: string, dimensions: ElementDimensions) => void;
  beginResizeTransaction: () => void;
  commitResizeTransaction: () => void;
  cancelResizeTransaction: () => void;

  /** One-shot Free-layout geometry edit (e.g. the Inspector's X/Y/Width/Height fields) — pushes its own history entry, same shape as resizeElement vs. a resize drag. */
  setFreeChildGeometry: (nodeId: string, geometry: FreeLayoutGeometry) => void;
  /** Per-frame Free-layout geometry write during a live drag/resize session — no history push; wrap in begin/commitResizeTransaction, same convention resize already established. */
  setFreeChildGeometryLive: (nodeId: string, geometry: FreeLayoutGeometry) => void;
  /** BC-13.5: rolls back an uncommitted drag/resize — only the given nodes' freeLayout is put back (no history, no other change). */
  restoreFreeLayoutsLive: (originals: ReadonlyMap<string, FreeLayoutGeometry | undefined>) => void;
  /**
   * BC-13.5: the same node-scoped rollback applied to the history entries
   * pushed since index `fromIndex` (an external edit such as a deletion
   * recorded while a drag/resize was live), so undoing that edit can never
   * bring back the uncommitted geometry.
   */
  restoreFreeLayoutsInHistory: (originals: ReadonlyMap<string, FreeLayoutGeometry | undefined>, fromIndex: number) => void;
  /** Free-layout Snap on/off toggle (Checkpoint 1.15.6.1.1) — plain editor preference, no history, no document mutation. */
  setSnapEnabled: (enabled: boolean) => void;
  /** Sets/replaces the live snap guide(s) during an in-progress Free-child drag — no history, ephemeral (see types/snap.ts). */
  setActiveSnapGuides: (guides: ActiveSnapGuides | null) => void;
  setFreeInsertionPreview: (preview: FreeInsertionPreview | null) => void;

  /** Direct mode set — editor UI state, no history (Checkpoint 1.15.6.8). */
  setEditorMode: (mode: EditorMode) => void;
  /**
   * Enters Preview: switches mode, resets runtime visibility to empty
   * (deterministic start — section 15), and safely exits SVG Edit Mode
   * (Drawing Mode's own overlays/tools have no meaning once Canvas clicks
   * stop selecting). Selection itself is deliberately left untouched
   * (Part C, section 13's "least destructive" choice) — Preview simply
   * renders no selection chrome for it (see CanvasOverlay), so returning
   * to Design lands the user back where they were.
   */
  enterPreview: () => void;
  /** Exits Preview back to Design — resets runtime visibility (section 14) so a later Preview entry never inherits stale state; authored document and history are untouched by construction (neither is read nor written here). */
  exitPreview: () => void;

  /** Adds one new click interaction binding to nodeId (Checkpoint 1.15.6.8, Part G) — one history entry, never guarded by Parent Style Protection (this is semantic/behavioral data, not style — section 34). */
  addInteraction: (nodeId: string, binding: { trigger: "click"; action: InteractionAction; targetId: string }) => void;
  /** Patches one existing binding's action/target by its own id — one history entry, no-op if nothing actually changes. */
  updateInteraction: (nodeId: string, interactionId: string, patch: { action?: InteractionAction; targetId?: string }) => void;
  /** Removes one binding by its own id — one history entry, no-op if already gone. */
  removeInteraction: (nodeId: string, interactionId: string) => void;
  /**
   * Sets nodeId's own authored initial Preview visibility (Checkpoint
   * 1.15.6.8.1) — one history entry, true no-op detection, never guarded
   * by Parent Style Protection (behavior metadata, not CSS). `undefined`
   * clears back to the default "visible."
   */
  setInitialPreviewVisibility: (nodeId: string, value: InitialPreviewVisibility | undefined) => void;
  /**
   * Fires every one of nodeId's own bindings matching `trigger` (Preview
   * click execution) — mutates ONLY `runtimeVisibility`, never the
   * document, never history (Part E/section 21-25). Safely no-ops per
   * binding whose `targetId` no longer resolves in the document (missing-
   * target safety, section 25) — deletion cleanup should normally already
   * prevent this, but the executor stays defensive regardless.
   */
  executeInteractionsForNode: (nodeId: string, trigger: "click") => void;
  /**
   * Runtime-only dismissal (Checkpoint 1.15.6.8.3) — forces exactly one
   * target's `runtimeVisibility` to false. No history, no authored
   * mutation (never touches `initialPreviewVisibility`, `interactions`,
   * or any CSS field), safe no-op if already hidden. The counterpart to
   * executeInteractionsForNode's own "hide" branch for callers that have
   * a bare `targetId` with no originating trigger click of their own —
   * outside-click and Escape dismissal (see
   * utils/dismissibleTargets.ts's own findDismissibleRelationships,
   * which supplies that targetId).
   */
  dismissRuntimeTarget: (targetId: string) => void;
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
  /** Live (no-history) counterpart of setFlexContainerSettings — Checkpoint 1.15.6.1.1's Gap slider wraps a whole drag in beginTransaction()/commitTransaction() and calls this on every tick in between, matching setElementBoxShadowLive's exact shape. */
  setFlexContainerSettingsLive: (containerId: string, settings: FlexContainerSettings) => void;
  setGridContainerSettings: (containerId: string, settings: GridContainerSettings) => void;
  /** Live (no-history) counterpart of setGridContainerSettings — same reasoning as setFlexContainerSettingsLive. */
  setGridContainerSettingsLive: (containerId: string, settings: GridContainerSettings) => void;
  /** Margin never affects Free content bounds — a plain field set, no side effects. */
  setElementMargin: (nodeId: string, margin: EdgeValues | undefined) => void;
  /** The containment-critical one: re-normalizes a Free container's direct children into its new (padding-adjusted) content bounds in the same atomic write — see spacingCommands.setElementPadding. */
  setElementPadding: (nodeId: string, padding: EdgeValues | undefined) => void;
  /** `undefined` removes the record (BC-05.2 "Reset flex item"). */
  setFlexChildSettings: (nodeId: string, settings: FlexChildSettings | undefined) => void;
  /** Column/row start+span are clamped to the parent's current Grid track counts before being applied — see the implementation for why that happens here rather than in the pure command. */
  setGridChildSettings: (nodeId: string, settings: GridChildSettings | undefined) => void;
  /** A node's own object-fit/object-position for intrinsic media (Checkpoint 3.5.1, restructured in Checkpoint 5.6 — see types/mediaFit.ts's own doc comment). `undefined` clears it entirely (see withMediaFitField/withMediaFitPosition/clearMediaFitPosition). */
  setMediaFitSettings: (nodeId: string, settings: MediaFitSettings | undefined) => void;
  /** A node's own text styling (Checkpoint 4.2) — see resolveTypographyStyle. `undefined` clears it entirely (see withTypographyField). */
  setElementTypography: (nodeId: string, typography: TypographySettings | undefined) => void;
  /** A node's own background styling (Checkpoint 4.3) — see resolveBackgroundStyle. `undefined` clears it entirely (see withBackgroundField/withBackgroundSize). */
  setElementBackground: (nodeId: string, background: BackgroundSettings | undefined) => void;
  /** Per-frame background write during a live drag session (Checkpoint 4.3.1 — gradient stop dragging) — no history push; wrap in begin/commitTransaction, same convention setFreeChildGeometryLive already established. */
  setElementBackgroundLive: (nodeId: string, background: BackgroundSettings | undefined) => void;
  /**
   * BC-17.3.1: rolls back an uncommitted live background gesture (a
   * gradient-stop drag cancelled with Escape or a cancelled pointer) —
   * every node the open gesture wrote a background-image slice for gets its
   * background from the transaction snapshot back; nothing else changes.
   * Like restoreFreeLayoutsLive, an exact rollback reuses the snapshot's
   * document object, so nothing reads as unsaved. Call cancelTransaction
   * after it.
   */
  restoreLiveBackgrounds: () => void;
  setElementBorder: (nodeId: string, border: BorderSettings | undefined) => void;
  setElementBorderRadius: (nodeId: string, borderRadius: BorderRadiusSettings | undefined) => void;
  /** This node's own Advanced Container Shape preset (Checkpoint 1.15.4) — see resolveShapeStyle. `"none"` clears it back to a plain rectangle (see setElementShape's own doc comment); never mutates the independently-stored `borderRadius` field. */
  setElementShape: (nodeId: string, shape: ShapePreset) => void;
  /** SVG's own starter Primitive (Checkpoint 1.15.5) — vector CONTENT, not styling; deliberately NOT guarded by Parent Style Protection (see setSvgKind's own doc comment). */
  setSvgKind: (nodeId: string, kind: SvgPrimitiveKind) => void;
  /** SVG's own `viewBox` (Checkpoint 1.15.5) — vector content, like setSvgKind; never guarded. Resizing the element's ordinary layout box never touches this field. */
  setSvgViewBox: (nodeId: string, viewBox: SvgViewBox) => void;
  /** SVG's own `fill` presentation attribute (Checkpoint 1.15.5) — visual styling, guarded by Parent Style Protection exactly like every CSS command. */
  setSvgFill: (nodeId: string, fill: string | undefined) => void;
  /** SVG's own `stroke` presentation attribute (Checkpoint 1.15.5) — guarded like setSvgFill. `undefined` is the real "None" state and never touches svgStrokeWidth. */
  setSvgStroke: (nodeId: string, stroke: string | undefined) => void;
  /** SVG's own `stroke-width` presentation attribute (Checkpoint 1.15.5) — guarded like setSvgFill/setSvgStroke. */
  setSvgStrokeWidth: (nodeId: string, strokeWidth: number) => void;
  /** This node's own box-shadow layer stack (Checkpoint 4.6) — see resolveBoxShadowStyle. `undefined` clears it entirely. */
  setElementBoxShadow: (nodeId: string, boxShadow: BoxShadowSettings | undefined) => void;
  /** Per-frame box-shadow write during a live drag-reorder session (Checkpoint 4.6) — no history push; wrap in begin/commitTransaction, the same convention setElementBackgroundLive established for gradient stop dragging. */
  setElementBoxShadowLive: (nodeId: string, boxShadow: BoxShadowSettings | undefined) => void;
  /** This node's own visual effects (Checkpoint 4.7) — see resolveFilterStyle. `undefined` clears it entirely. No continuous-drag variant: every filter field is a discrete numeric commit, like Typography, not a draggable gesture. */
  setElementFilters: (nodeId: string, filters: FilterSettings | undefined) => void;
  /** Live (no-history) counterpart of setElementFilters — Checkpoint 1.15.6.1.1's Opacity slider wraps a whole drag in beginTransaction()/commitTransaction() and calls this on every tick in between, matching setElementBoxShadowLive's exact shape. */
  setElementFiltersLive: (nodeId: string, filters: FilterSettings | undefined) => void;
  /** This node's own CSS Transition (Checkpoint 1.15.6.14.1) — see resolveTransitionStyle. `undefined` clears it entirely. No Live/transaction variant: this checkpoint deliberately ships ordinary numeric Inspector fields, not sliders (see setElementTransition's own doc comment). */
  setElementTransition: (nodeId: string, transition: TransitionSettings | undefined) => void;
  /** This node's own CSS Transform (Checkpoint 1.15.6.14.3) — see resolveTransformStyle. `undefined` clears it entirely. No Live/transaction variant: ordinary numeric Inspector fields, not sliders, same as setElementTransition's own reasoning. */
  setElementTransform: (nodeId: string, transform: TransformSettings | undefined) => void;
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
   * One-shot link-destination edit (Checkpoint 1.4 — the Inspector's
   * Link section). Same one-history-entry-per-call shape as every other
   * one-shot command here; `undefined` clears an explicit override back
   * to the tag's own safe default (see types/link.ts's getLinkHref).
   * Tag-agnostic — see setElementHref's own doc comment.
   */
  setElementHref: (nodeId: string, href: string | undefined) => void;

  /**
   * Changes nodeId's own semantic HTML tag (Checkpoint 1.7 — the
   * Inspector's Heading Level control). Unlike setElementText/
   * setElementHref, this one guards against a no-op tag at the action
   * level (not just the command level) — see this action's own
   * definition for why: this checkpoint's own requirement ("no history
   * entry if tag is unchanged") is explicit, so it's enforced here
   * directly rather than relying on every future caller to self-guard
   * the way Inspector text/href fields already do.
   */
  setElementTag: (nodeId: string, tag: string) => void;

  /**
   * One-shot authored/default form-value edit (Checkpoint 1.10 —
   * useNativeInputEditing's commit boundary and the Form Control
   * Inspector's Default Value field). Guards against a no-op value at
   * the action level, the same stricter shape setElementTag already
   * established (not the older setElementText/setElementHref
   * convention) — this checkpoint's own history requirement ("unchanged
   * commit should not create unnecessary history") is explicit, so it's
   * enforced here directly.
   */
  setElementValue: (nodeId: string, value: string | undefined) => void;
  /** One-shot `name` attribute edit (Checkpoint 1.10 — the Form Control Inspector's Name field). Same action-level no-op guard as setElementValue. */
  setElementName: (nodeId: string, name: string | undefined) => void;
  /** One-shot `placeholder` attribute edit (Checkpoint 1.10 — the Form Control Inspector's Placeholder field). Same action-level no-op guard as setElementValue. */
  setElementPlaceholder: (nodeId: string, placeholder: string | undefined) => void;
  /** One-shot Input Type edit (Checkpoint 1.11 — the Form Control Inspector's Type selector). Same action-level no-op guard as setElementValue/setElementTag. */
  setElementInputType: (nodeId: string, inputType: InputType) => void;
  /** One-shot authored checked-state edit (Checkpoint 1.12 — the Form Control Inspector's Checked toggle for checkbox/radio). Same action-level no-op guard as setElementValue/setElementInputType. */
  setElementChecked: (nodeId: string, checked: boolean | undefined) => void;
  /** One-shot list item count edit (Checkpoint 1.12.1 — the List Inspector's Items field for ul/ol). Same action-level no-op guard as setElementValue/setElementChecked. */
  setListItemCount: (nodeId: string, count: number) => void;
  /** One-shot option count edit (Checkpoint 1.13 — the Select Inspector's Options field). Same action-level no-op guard as setListItemCount. */
  setOptionCount: (selectId: string, count: number) => void;
  /** One-shot single-select authored-selection change (Checkpoint 1.13 — the Option Inspector's Selected toggle). Rewrites the whole affected Select subtree in one call so at most one Option is ever selected; pass undefined to clear the authored selection entirely. Same action-level no-op guard as every other one-shot field command. */
  setSelectSelectedOption: (selectId: string, optionId: string | undefined) => void;
  /** One-shot table column-count edit (Checkpoint 1.14 — the Table Inspector's Columns field). Normalizes every row across thead/tbody/tfoot to the requested count. Same action-level no-op guard as every other one-shot count command. */
  setTableColumnCount: (tableId: string, count: number) => void;
  /** One-shot table body-row-count edit (Checkpoint 1.14 — the Table Inspector's Body Rows field). Header/Footer rows are untouched. */
  setTableBodyRowCount: (tableId: string, count: number) => void;
  /** One-shot table Header Row toggle (Checkpoint 1.14) — creates/removes the entire `<thead>` subtree in one step. */
  setTableHeaderEnabled: (tableId: string, enabled: boolean) => void;
  /** One-shot table Footer Row toggle (Checkpoint 1.14) — creates/removes the entire `<tfoot>` subtree in one step. */
  setTableFooterEnabled: (tableId: string, enabled: boolean) => void;
  /** Adds one "New link" (href "#") styled like the nav's last direct link, right after it (BC-06.2). Refused at MAX_NAVIGATION_LINKS links. One history entry; the selection is left as it is (normally the nav). */
  addNavigationLink: (navId: string) => void;
  /** Removes exactly this direct link of the nav, and every interaction that targeted it, as one history entry (BC-06.2). */
  removeNavigationLink: (navId: string, linkId: string) => void;
  /** Swaps this link with its neighbouring link (non-link children keep their slots). One history entry; no-op at either end (BC-06.2). */
  moveNavigationLink: (navId: string, linkId: string, direction: NavigationLinkMoveDirection) => void;
  /** Pagination management (BC-09.3, paginationCommands.ts). Each is one history entry, a no-op on anything but a marked Pagination, and keeps exactly one current page. */
  addPaginationPage: (navId: string) => void;
  /** Removes exactly this page (refused at one page) and every interaction that targeted it. */
  removePaginationPage: (navId: string, pageId: string) => void;
  setPaginationCurrentPage: (navId: string, pageId: string) => void;
  setPaginationPageLabel: (navId: string, pageId: string, label: string) => void;
  setPaginationPageHref: (navId: string, pageId: string, href: string) => void;
  /** Shows (inserts) or hides (removes) First, Previous, Next, Last or the ellipsis. */
  setPaginationControlVisible: (navId: string, role: PaginationControlRole, visible: boolean) => void;
  /** One-shot table Caption toggle (Checkpoint 1.15.6.12.2) — creates/removes the entire `<caption>` in one step, always as the table's first child. A new Table has no Caption by default; this is the only way one is created. */
  setTableCaptionEnabled: (tableId: string, enabled: boolean) => void;

  /** One-shot Progress Value edit (Checkpoint 1.15.6.12.4) — `undefined` enters indeterminate state directly; a defined value is clamped to `[0, effective Max]`. */
  setElementProgressValue: (nodeId: string, value: number | undefined) => void;
  /** One-shot Progress Max edit (Checkpoint 1.15.6.12.4) — clamped to a minimum of 1; atomically re-clamps a determinate Value that would otherwise exceed the new Max, in the same history step. */
  setElementProgressMax: (nodeId: string, max: number) => void;
  /** The Inspector's own Indeterminate toggle (Checkpoint 1.15.6.12.4) — ON clears Value entirely, OFF restores `effective Max / 2`. */
  setElementProgressIndeterminate: (nodeId: string, indeterminate: boolean) => void;

  /** One-shot media/embed source URL edit (Checkpoint 1.15 — Video's and Iframe's own Source URL field). Same action-level no-op guard as every other one-shot field command. */
  setElementSrc: (nodeId: string, src: string | undefined) => void;
  /** One-shot Image alt text edit (BC-07.2), stored in displayName; empty clears it. */
  setElementAltText: (nodeId: string, alt: string | undefined) => void;
  /** One-shot Video poster URL edit (Checkpoint 1.15). */
  setElementPoster: (nodeId: string, poster: string | undefined) => void;
  /** One-shot Video Controls toggle (Checkpoint 1.15). */
  setElementControls: (nodeId: string, controls: boolean | undefined) => void;
  /** One-shot Video Autoplay toggle (Checkpoint 1.15). */
  setElementAutoplay: (nodeId: string, autoplay: boolean | undefined) => void;
  /** One-shot Video Muted toggle (Checkpoint 1.15). */
  setElementMuted: (nodeId: string, muted: boolean | undefined) => void;
  /** One-shot Video Loop toggle (Checkpoint 1.15). */
  setElementLoop: (nodeId: string, loop: boolean | undefined) => void;
  /** One-shot accessible title edit (Checkpoint 1.15 — Iframe's own Title field). */
  setElementTitle: (nodeId: string, title: string | undefined) => void;
  /** One-shot authored HTML `id` edit (Checkpoint 1.15.1 — the Identity Inspector section). */
  setElementHtmlId: (nodeId: string, htmlId: string | undefined) => void;
  /** One-shot authored HTML `class` edit (Checkpoint 1.15.1 — the Identity Inspector section). */
  setElementClassName: (nodeId: string, className: string | undefined) => void;
  /**
   * One-shot "Lock child styles" toggle (Checkpoint 1.15.3 — the
   * Protection Inspector section). Editor-only protection metadata, never
   * itself subject to the style-protection guard — see
   * setElementLockChildStyles's own doc comment in documentCommands.ts.
   */
  setElementLockChildStyles: (nodeId: string, lockChildStyles: boolean | undefined) => void;

  /**
   * Shows one transient, non-modal editor notice (Checkpoint 1.15.3) —
   * replaces whatever message is currently visible rather than queuing
   * (see the `editorNotice` field's own doc comment). Every guarded style
   * mutation below calls this internally (via guardedStyleMutation/
   * guardedBulkStyleMutation) when a blocked attempt occurs; exposed as
   * its own action too for any future non-protection use.
   */
  showEditorNotice: (message: string) => void;
  dismissEditorNotice: () => void;

  /**
   * Bulk CSS commands (Checkpoint 1.15.2) — the multi-selection Inspector's
   * own write path. Each applies ONE field to every targeted node's OWN
   * existing settings (never a single shared object stamped onto all of
   * them — see bulkCommands.ts's own doc comments), in a single document
   * traversal, as one atomic mutation and (via the shared no-op-guarded
   * wrapper every action below uses) at most one history entry — never
   * one entry per targeted node.
   */
  setElementsTypographyField: <K extends keyof TypographySettings>(ids: readonly string[], field: K, value: TypographySettings[K]) => void;
  /**
   * BC-10.4: one single-selection section's whole settings written to every
   * element in `ids` (sectionSettingsCommands), for a multi-selection whose
   * elements share that section's authored settings. All-or-nothing: if any
   * element is style-protected, nothing changes (the usual notice). One
   * history entry; `live` writes none (a gesture inside begin/commitTransaction).
   */
  setElementsSettings: <K extends SectionSettingsKey>(
    ids: readonly string[],
    key: K,
    value: SectionSettingsValues[K],
    options?: { live?: boolean },
  ) => void;
  setElementsBackgroundField: <K extends Exclude<keyof BackgroundSettings, "size" | "customSize" | "gradient">>(
    ids: readonly string[],
    field: K,
    value: BackgroundSettings[K],
  ) => void;
  /** "All Sides" bulk Border mode (Checkpoint 1.15.2) — per-individual-side bulk editing is deferred, see this checkpoint's report. */
  setElementsBorderAllSidesField: <K extends keyof BorderSideSettings>(ids: readonly string[], field: K, value: BorderSideSettings[K]) => void;
  setElementsBorderRadiusAllCorners: (ids: readonly string[], value: CssLengthValue | undefined) => void;
  /** Bulk Advanced Container Shape (Checkpoint 1.15.4) — one atomic, one-history-entry commit across every targeted node; see setElementsShape's own doc comment. */
  setElementsShape: (ids: readonly string[], shape: ShapePreset) => void;
  /** Bulk SVG Primitive (Checkpoint 1.15.5) — vector content, never guarded by Parent Style Protection; see setElementsSvgKind's own doc comment. */
  setElementsSvgKind: (ids: readonly string[], kind: SvgPrimitiveKind) => void;
  /** Bulk SVG Fill (Checkpoint 1.15.5) — visual styling, atomic and guarded exactly like every other bulk CSS command. */
  setElementsSvgFill: (ids: readonly string[], fill: string | undefined) => void;
  /** Bulk SVG Stroke (Checkpoint 1.15.5) — guarded like setElementsSvgFill. */
  setElementsSvgStroke: (ids: readonly string[], stroke: string | undefined) => void;
  /** Bulk SVG Stroke Width (Checkpoint 1.15.5) — guarded like setElementsSvgFill/setElementsSvgStroke. */
  setElementsSvgStrokeWidth: (ids: readonly string[], strokeWidth: number) => void;
  setElementsDisplayField: <K extends keyof DisplaySettings>(ids: readonly string[], field: K, value: DisplaySettings[K]) => void;
  setElementsFilterField: <K extends keyof FilterSettings>(ids: readonly string[], field: K, value: FilterSettings[K]) => void;
  setElementsTransitionField: <K extends keyof TransitionSettings>(ids: readonly string[], field: K, value: TransitionSettings[K]) => void;
  /** Bulk whole-value Transition overwrite/clear (Checkpoint 1.15.6.14.1) — one atomic, one-history-entry commit; see setElementsTransition's own doc comment. */
  setElementsTransition: (ids: readonly string[], transition: TransitionSettings | undefined) => void;
  setElementsTransformField: <K extends keyof TransformSettings>(ids: readonly string[], field: K, value: TransformSettings[K]) => void;
  /** Bulk whole-value Transform overwrite/clear (Checkpoint 1.15.6.14.3) — one atomic, one-history-entry commit; see setElementsTransform's own doc comment. */
  setElementsTransform: (ids: readonly string[], transform: TransformSettings | undefined) => void;
  setElementsPositionField: <K extends keyof PositionSettings>(ids: readonly string[], field: K, value: PositionSettings[K]) => void;
  setElementsMediaFitField: <K extends keyof MediaFitSettings>(ids: readonly string[], field: K, value: MediaFitSettings[K]) => void;
  setElementsSizeConstraintField: <K extends keyof SizeConstraints>(ids: readonly string[], field: K, value: SizeConstraints[K]) => void;
  setElementsSpacingAllSides: (ids: readonly string[], box: "margin" | "padding", value: number) => void;
  setElementsAspectRatio: (ids: readonly string[], aspectRatio: AspectRatioValue | undefined) => void;
  setElementsDimensions: (ids: readonly string[], dimensions: ElementDimensions | undefined) => void;

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
   *
   * `mergeHistory` (BC-01.3 — live Inspector numeric editing): the
   * caller writes through the ordinary one-shot setters instead of
   * dedicated *Live variants, and pushHistory folds those writes into
   * this transaction. commitTransaction then records one entry — or
   * none at all if the document ended structurally unchanged, restoring
   * the exact snapshot document so the project stays clean. A no-op if a
   * transaction is already open (it never joins someone else's).
   */
  beginTransaction: (options?: { mergeHistory?: boolean }) => void;
  /**
   * Runs `write` as the open merging transaction's own write (BC-01.6):
   * one-shot mutations inside it fold into the transaction. Any other
   * one-shot mutation while it is open closes it first (see pushHistory).
   */
  mergeTransactionWrite: (write: () => void) => void;
  commitTransaction: () => void;
  cancelTransaction: () => void;

  /**
   * Enters SVG Edit Mode for `svgNodeId` (Checkpoint 1.15.6, section 9 of
   * its own brief) — resets tool/selection/draft to their defaults
   * (Select tool, nothing selected, no draft) and, if this SVG is still
   * in 1.15.5's legacy/simple mode, materializes its one starter
   * primitive into an equivalent scene object first (one real document
   * mutation, one history entry — see materializeSvgStarterIntoScene's
   * own doc comment). A no-op for the materialization step (but still
   * enters edit mode) if a scene already exists.
   */
  enterSvgEditMode: (svgNodeId: string) => void;
  /** Exits SVG Edit Mode — pure UI-state reset, never touches document/history. */
  exitSvgEditMode: () => void;
  setActiveSvgTool: (tool: SvgDrawingTool) => void;
  selectSvgObjectOnly: (objectId: string) => void;
  toggleSvgObjectSelection: (objectId: string) => void;
  addSvgObjectToSelection: (objectId: string) => void;
  clearSvgObjectSelection: () => void;
  /** Starts a Polygon/Pen draft with one point — see types/svgEditMode.ts's own doc comment. */
  startSvgDraft: (tool: "polygon" | "pen", point: SvgVectorPoint) => void;
  addSvgDraftPoint: (point: SvgVectorPoint) => void;
  /** Validates and commits the current draft as a real vector object (one history entry), then returns to the Select tool with the new object selected (section 56 of this checkpoint's own brief) — a no-op (UI state unchanged, no document mutation) if the draft doesn't meet its own minimum (3+ points for a polygon, an M plus at least one L for a pen path). */
  commitSvgDraft: () => void;
  /** Discards the in-progress draft with zero history — the Escape-cancel path. */
  cancelSvgDraft: () => void;

  /** Vector CONTENT — unguarded by Parent Style Protection (see commands/svgSceneCommands.ts's own doc comment). One history entry, no-op-safe. */
  addSvgObject: (svgNodeId: string, object: SvgVectorObject) => void;
  /** Per-frame variant used ONLY by the Rectangle/Ellipse/Line drawing sessions: appends the new object with no history push, wrapped in begin/commitTransaction so the ENTIRE drag (from the object not existing at all to its final drawn geometry) becomes exactly one history entry — see canvas/hooks/useSvgShapeDrawingSession.ts's own doc comment. */
  addSvgObjectLive: (svgNodeId: string, object: SvgVectorObject) => void;
  /** Deletes every one of the given vector object ids and clears them from SVG-local selection in the same commit — the Delete-key path inside SVG Edit Mode (never the outer document's own deleteSelection). Vector content, unguarded, one history entry, no-op-safe for an already-stale id. */
  removeSvgObjects: (svgNodeId: string, objectIds: readonly string[]) => void;
  /** One-shot translate (vector content, unguarded) — one history entry. */
  translateSvgObjects: (svgNodeId: string, objectIds: readonly string[], dx: number, dy: number) => void;
  /** Per-frame translate during a live Select-tool move drag — no history push; wrap in begin/commitTransaction, the same convention every other continuous drag in this store already established. */
  translateSvgObjectsLive: (svgNodeId: string, objectIds: readonly string[], dx: number, dy: number) => void;
  /** One-shot resize (Rectangle/Ellipse only — see resizeSvgObject's own doc comment) — one history entry. */
  resizeSvgObject: (svgNodeId: string, objectId: string, bounds: SvgObjectBounds) => void;
  /** Per-frame resize during a live Select-tool resize drag — no history push; wrap in begin/commitTransaction. */
  resizeSvgObjectLive: (svgNodeId: string, objectId: string, bounds: SvgObjectBounds) => void;
  /** Per-frame Line endpoint write during drawing or post-creation endpoint editing — no history push; wrap in begin/commitTransaction. */
  setSvgLineEndpointLive: (svgNodeId: string, objectId: string, x2: number, y2: number) => void;
  /** One-shot Line second-endpoint write — the Vector Inspector's own X2/Y2 fields. One history entry. */
  setSvgLineEndpoint: (svgNodeId: string, objectId: string, x2: number, y2: number) => void;
  /** One-shot Line first-endpoint write — the Vector Inspector's own X1/Y1 fields. One history entry. */
  setSvgLineStart: (svgNodeId: string, objectId: string, x1: number, y1: number) => void;
  /**
   * Vector STYLING (Checkpoint 1.15.6, section 33/34 of its own brief) —
   * guarded by Parent Style Protection exactly like every other CSS
   * command, checked against the OWNING SVG's own ancestor chain
   * (`svgNodeId`, never a vector object id — vector ids are not part of
   * the HTML ancestor tree). Every targeted object shares the same one
   * owning SVG, so this is a single protection check, not a per-object
   * bulk scan — if that SVG is protected, the WHOLE styling mutation is
   * blocked atomically, matching every other bulk CSS command's own
   * atomicity guarantee.
   */
  setSvgObjectsFill: (svgNodeId: string, objectIds: readonly string[], fill: string | undefined) => void;
  setSvgObjectsStroke: (svgNodeId: string, objectIds: readonly string[], stroke: string | undefined) => void;
  setSvgObjectsStrokeWidth: (svgNodeId: string, objectIds: readonly string[], strokeWidth: number) => void;

  /**
   * One selected element: copies it, as before. Two or more (BC-10.5): copies
   * the minimal set of selected subtrees (a selected child of a selected
   * parent is inside the parent's copy), in document order. No document or
   * history change.
   */
  copySelection: () => void;
  /**
   * One selected element: cut at once, as before. Two or more (BC-10.5): opens
   * the same confirmation as a multi-delete (pendingDeletion, kind "cut");
   * nothing is removed and the clipboard is untouched until it is confirmed.
   */
  cutSelection: () => void;
  /**
   * One clipboard element: as before. Several (BC-10.5): all of them, as fresh
   * copies, into ONE destination (the single-paste destination rule), in
   * order; rejected as a whole with a notice if that container can't accept
   * every one. One history entry; the copies become the selection.
   */
  pasteClipboard: () => void;
  /**
   * One selected element: as before. Two or more (BC-10.5): each selected
   * subtree is duplicated right after its original, in its own parent. All or
   * nothing, one history entry; the copies become the selection.
   */
  duplicateSelection: () => void;
  /**
   * Copy CSS (BC-11.2): the PRIMARY selected element's authored CSS, every
   * group it authored, as a deep-cloned snapshot in styleClipboard. No
   * document or history change. A source with no CSS of its own clears the
   * CSS clipboard (so an older snapshot is never pasted by surprise), with
   * a notice.
   */
  copyStyle: () => void;
  /**
   * Paste CSS (BC-11.2): merges the snapshot into every selected element
   * (valid ids only), each group only where that element supports it
   * (skipped groups are named in one notice). All or nothing: a style lock
   * on any of them, or any invalid write, changes nothing. One history
   * entry; none for a no-op.
   */
  pasteStyle: () => void;
  /**
   * BC-11.3 — Copy one Inspector section's CSS: as copyStyle, for one CSS
   * group only, and only if the primary element offers that section. The
   * snapshot replaces the CSS clipboard (one shared clipboard).
   */
  copyStyleSection: (group: StyleGroupKey) => void;
  /**
   * BC-11.3 — Paste one Inspector section's CSS: as pasteStyle, filtered to
   * one CSS group. A clipboard without that group changes nothing (a
   * notice says so): other groups are never reinterpreted as this one.
   */
  pasteStyleSection: (group: StyleGroupKey) => void;
  /**
   * Deletes the whole selection IMMEDIATELY (roots only, interactions
   * cleaned, one history entry). Programmatic; user-facing commands use
   * requestDeleteSelection, which asks first for 2+ elements (BC-10.2).
   */
  deleteSelection: () => void;
  /**
   * The user-facing Delete (keyboard, Edit menu): one selected element is
   * deleted at once, exactly as before; two or more open the confirmation
   * (pendingDeletion) and change nothing yet. Ignored while a confirmation
   * is already open.
   */
  requestDeleteSelection: () => void;
  /**
   * Deletes the captured targets, only if the selection still holds exactly
   * them and they all still exist; otherwise nothing is deleted and a
   * notice says why. Closes the confirmation either way.
   */
  confirmPendingDeletion: () => void;
  /** Closes the confirmation; the document, history and selection are untouched. */
  cancelPendingDeletion: () => void;
  /** Structure panel Shift+click (BC-10.2): selects the visible range from the anchor to targetId; additive (Ctrl/Cmd+Shift) keeps the existing selection. */
  selectRange: (targetId: string, visibleIds: readonly string[], additive: boolean) => void;
  undo: () => void;
  redo: () => void;

  /**
   * Replaces the whole authored document in one atomic update — the only
   * way a loaded or new project enters the editor (PROJECT-1.1). Takes an
   * ALREADY VALIDATED document (see parseProjectFile): a failed load never
   * calls this, so it leaves the current document untouched. Resets every
   * piece of session state that refers to the old document — selection,
   * undo/redo history, in-progress transactions, notices, Preview runtime
   * state, SVG editing and snap guides — and returns to Design mode. The
   * clipboard and the Snap preference are app-level and survive. The new
   * document becomes the saved baseline (no unsaved changes).
   */
  replaceDocument: (document: EditorElementNode) => void;
  /** Records `document` as saved. Pass the exact object that was serialized, so edits made while a save was in flight still count as unsaved. */
  markDocumentPersisted: (document: EditorElementNode) => void;
}

/** BC-17.3: the live geometry gesture of the open transaction (see EditorState.liveGesture). */
export interface LiveGestureState {
  /** The transaction this gesture belongs to; its document holds the committed geometry. */
  snapshot: HistoryEntry;
  /** Node id → the slice the gesture writes live. */
  slices: Readonly<Record<string, LiveGestureSlice>>;
}

/** The live gesture, only while its own transaction is the open one. */
export function selectActiveLiveGesture(state: Pick<EditorState, "liveGesture" | "transactionSnapshot">): LiveGestureState | null {
  const gesture = state.liveGesture;
  return gesture !== null && state.transactionSnapshot !== null && gesture.snapshot === state.transactionSnapshot ? gesture : null;
}

/** The slice a node is painting live right now, or undefined. */
export function selectLiveGestureSlice(state: Pick<EditorState, "liveGesture" | "transactionSnapshot">, nodeId: string): LiveGestureSlice | undefined {
  return selectActiveLiveGesture(state)?.slices[nodeId];
}

/**
 * Records that a live write inside the open transaction is a geometry
 * gesture on these nodes. Outside a transaction (a one-shot write) there
 * is nothing to record. Returns no change when every slice is already
 * recorded, so per-frame writes don't churn the state.
 */
function recordLiveGesture(state: EditorState, entries: readonly (readonly [string, LiveGestureSlice])[]): Partial<EditorState> {
  const snapshot = state.transactionSnapshot;
  if (!snapshot || entries.length === 0) return {};
  const current = selectActiveLiveGesture(state);
  if (current && entries.every(([id, slice]) => current.slices[id] === slice)) return {};
  const slices: Record<string, LiveGestureSlice> = { ...(current?.slices ?? {}) };
  for (const [id, slice] of entries) slices[id] = slice;
  return { liveGesture: { snapshot, slices } };
}

/** Whether the authored document differs from the last loaded/saved one. Ignores selection, Preview, panels and other session state. */
export function selectHasUnsavedChanges(state: Pick<EditorState, "document" | "persistedDocument">): boolean {
  return state.document !== state.persistedDocument;
}

/** Snapshot of the state a history entry needs, taken *before* a mutation is applied. */
function snapshot(state: EditorState): HistoryEntry {
  return { document: state.document, selection: state.selection };
}

/**
 * > 0 only while mergeTransactionWrite runs the owning edit's own write —
 * module state, not store state, because it never outlives that one
 * synchronous call and nothing renders from it.
 */
let mergedWriteDepth = 0;

/** Every one-shot (non-transactional) mutation pushes the pre-mutation snapshot and clears redo. */
function pushHistory(state: EditorState): Pick<EditorState, "past" | "future"> & Partial<Pick<EditorState, "transactionSnapshot" | "historyMergeSnapshot">> {
  const open = state.transactionSnapshot;
  if (open !== null && open === state.historyMergeSnapshot) {
    // The owning edit's own write: the pre-transaction snapshot already
    // stands for it; commitTransaction records it once.
    if (mergedWriteDepth > 0) return { past: state.past, future: state.future };
    // A mutation from anywhere else (BC-01.6, D1) must never be folded into
    // that edit's undo step, nor be undone by the edit's own Escape/revert
    // restoring its pre-edit snapshot. So it closes the edit first — its
    // own entry, unless it changed nothing — then records itself.
    const editEntry = isStructurallyEqual(state.document, open.document) ? [] : [open];
    return { past: [...state.past, ...editEntry, snapshot(state)], future: [], transactionSnapshot: null, historyMergeSnapshot: null };
  }
  return { past: [...state.past, snapshot(state)], future: [] };
}

/**
 * Commits a one-shot structural edit that may have removed nodes (a count
 * decrease, a Table toggle, a Navigation link removal): interactions that
 * targeted a removed node are removed in the SAME write, exactly as Delete
 * does (BC-06.2, BC06-D1), so the document never holds a dangling target
 * and stays saveable. If a removed node was selected, the selection falls
 * back to `fallbackSelectionId`. One history entry; `{}` for a no-op.
 */
function commitStructuralEdit(state: EditorState, edited: EditorElementNode, fallbackSelectionId: string): Partial<EditorState> {
  if (edited === state.document) return {};
  const document = removeInteractionsForRemovedNodes(state.document, edited);
  const selectionIsStale = state.selection.ids.some((id) => !findNodeById(document, id));
  return {
    ...pushHistory(state),
    document,
    ...(selectionIsStale ? { selection: selectionFromSingle(fallbackSelectionId) } : {}),
  };
}

/**
 * BC-09.3: after a generic structural edit (insert, move, delete, cut,
 * paste, duplicate, a link's href), every marked Pagination the edit
 * touched is brought back to its invariants (one current page, boundary
 * controls in sync) in the SAME write, so Undo restores both together.
 * If that removed a node (an ellipsis left with one page), interactions
 * targeting it are removed too.
 */
function withPaginationInvariants(
  before: EditorElementNode,
  after: EditorElementNode,
  options?: { preferredCurrentId?: string; ordinaryLookIds?: ReadonlySet<string> },
): EditorElementNode {
  const normalized = normalizePaginationsAfterEdit(before, after, options);
  return normalized === after ? after : removeInteractionsForRemovedNodes(after, normalized);
}

/** The document with `nodeId` no longer marked aria-current (BC-09.5, a current page moved out of its Pagination). */
function setElementAriaCurrentRemoved(root: EditorElementNode, nodeId: string): EditorElementNode {
  if (root.id === nodeId) return withoutCopiedCurrentState(root);
  if (!root.children) return root;
  let changed = false;
  const children = root.children.map((child) => {
    const next = setElementAriaCurrentRemoved(child, nodeId);
    if (next !== child) changed = true;
    return next;
  });
  return changed ? { ...root, children } : root;
}

function isMergingHistory(state: Pick<EditorState, "transactionSnapshot" | "historyMergeSnapshot">): boolean {
  return state.transactionSnapshot !== null && state.transactionSnapshot === state.historyMergeSnapshot;
}

/**
 * The single central enforcement point for Parent Style Protection
 * (Checkpoint 1.15.3) — every style-mutating store action below (Typography,
 * Background, Border, Size, Spacing, Position, Media Fit, Filters, Display,
 * Flex/Grid child settings, a container's own Flow display/gap/justify
 * settings, Free-layout geometry, and per-frame resize) is wrapped in this
 * rather than each independently re-deriving "is this node currently
 * locked." A protected target makes NO document change and pushes NO
 * history entry — only a transient notice, so a blocked attempt behaves
 * exactly like it never happened except for that one visible explanation
 * (sections 14-16, 37-39). This is deliberately the STORE layer, not the
 * Inspector layer: it runs the same way whether the mutation came from an
 * Inspector field, a resize/Free-drag session, or a future caller neither
 * of those know about (section 14's own explicit "disabled controls are
 * not enough" requirement).
 */
function guardedStyleMutation(
  state: EditorState,
  nodeId: string,
  mutate: (document: EditorElementNode) => EditorElementNode,
): Partial<EditorState> {
  const protection = getStyleProtection(state.document, nodeId);
  if (protection.protected) {
    return nextEditorNoticeState(state, describeStyleLockNotice([protection], false));
  }

  const document = mutate(state.document);
  if (document === state.document) return {};
  return { ...pushHistory(state), document };
}

/**
 * The bulk counterpart to guardedStyleMutation (sections 17-18) — checks
 * EVERY targeted id before mutating anything. If any target is protected,
 * the entire bulk mutation is blocked atomically: nothing changes for the
 * unprotected targets either, matching the existing "one bulk action = one
 * coherent result" philosophy Checkpoint 1.15.2 already established for
 * no-op detection. One notice either names the single shared locking
 * ancestor or, if the blocked targets are protected by different
 * ancestors, shows one generic message (never one notice per target).
 */
function guardedBulkStyleMutation(
  state: EditorState,
  ids: readonly string[],
  mutate: (document: EditorElementNode) => EditorElementNode,
): Partial<EditorState> {
  const protections: StyleProtectionResult[] = ids.map((id) => getStyleProtection(state.document, id));
  if (protections.some((result) => result.protected)) {
    return nextEditorNoticeState(state, describeStyleLockNotice(protections, true));
  }

  const document = mutate(state.document);
  if (document === state.document) return {};
  return { ...pushHistory(state), document };
}

/**
 * Replaces the visible editorNotice with `message`, but returns `{}`
 * (skips the state write entirely) when that exact message is already
 * showing — this is what keeps a continuous stream of identical
 * blocked-attempt notices (e.g. a live Free-drag on a locked node
 * committing every animation frame) from spamming re-renders or
 * restarting EditorNoticeBanner's own auto-dismiss timer (section 23).
 */
/**
 * Paste and Duplicate refuse a copy of embedded image data that would make
 * the project too large to save (BC-07.2): no document change, no history,
 * this notice instead. Checked only when the copy carries inline data.
 */
export const COPY_TOO_LARGE_NOTICE = "This copy would make the project too large to save. Remove unused images, or use an image URL instead of an uploaded image.";

function nextEditorNoticeState(state: EditorState, message: string): Partial<EditorState> {
  if (state.editorNotice?.message === message) return {};
  return { editorNotice: { message, id: (state.editorNotice?.id ?? 0) + 1 } };
}

/**
 * The current PRIMARY selected node, unless there's no selection, the
 * primary is the document root (never a valid copy/cut/duplicate/delete
 * target — see elementCapabilities), or the id no longer resolves in the
 * document. Every clipboard/duplicate command opens by checking this
 * rather than re-deriving the same three conditions — all four remain
 * deliberately single-target, primary-only operations in this checkpoint
 * (Checkpoint 1.15.2 explicitly scoped multi-node Copy/Cut/Paste/
 * Duplicate out — see this checkpoint's own report, section M); Delete is
 * the one clipboard-family command with a genuine multi-selection path
 * (see deleteSelection below).
 */
/**
 * Every id inside each of `rootIds`' own subtree, unioned together —
 * computed BEFORE removal (while the nodes still resolve in the current
 * document), so removeInteractionsTargeting knows exactly which targetIds
 * just disappeared, including nodes nested arbitrarily deep inside a
 * deleted subtree (Checkpoint 1.15.6.8, Part H, section 37), not just the
 * root ids themselves.
 */
/** What a delete of these selected ids would remove (BC-10.2), counted on the actual tree. */
export interface PendingDeletion {
  /** What confirming does (BC-10.5): delete, or cut (delete + put the removed subtrees on the clipboard). */
  kind: "delete" | "cut";
  /** The selected ids that exist (never the document root), in selection order. */
  selectedIds: string[];
  /** Selected ids that aren't inside another selected element: each subtree is removed once. */
  rootIds: string[];
  /** Every element removed, each counted once (selected ones included). */
  totalCount: number;
  /** Elements removed only because an ancestor is removed (not themselves selected). */
  nestedCount: number;
}

function planDeletion(document: EditorElementNode, ids: readonly string[], kind: PendingDeletion["kind"] = "delete"): PendingDeletion {
  const selectedIds = ids.filter((id) => id !== document.id && findNodeById(document, id) !== undefined);
  const rootIds = normalizeSelectionRoots(document, selectedIds);
  const totalCount = collectDeletedIds(document, rootIds).size;
  return { kind, selectedIds, rootIds, totalCount, nestedCount: totalCount - selectedIds.length };
}

const STALE_DELETION_NOTICE = "The selection changed before you confirmed, so nothing was deleted.";
const STALE_CUT_NOTICE = "The selection changed before you confirmed, so nothing was cut.";
/** BC-10.5: a multi-paste whose destination can't take every copied element. */
export const MULTI_PASTE_REJECTED_NOTICE = "These elements can't all go in the selected container, so nothing was pasted. Select a container that accepts them.";
/** BC-10.5: a multi-duplicate that can't place every copy. */
export const MULTI_DUPLICATE_REJECTED_NOTICE = "These elements can't all be duplicated where they are, so nothing was duplicated.";
/** BC-10.5.1: copies going into a Free container whose arrangement doesn't fit there at their sizes. */
export const FREE_GROUP_PASTE_REJECTED_NOTICE = "These elements don't fit in this container at their size and arrangement, so nothing was pasted.";
export const FREE_GROUP_DUPLICATE_REJECTED_NOTICE = "The copies don't fit in their container at their size and arrangement, so nothing was duplicated.";
/** BC-12.4: a multi-move took a form control out of the Label that names it (allowed, D9). */
export const MOVED_GROUP_OUT_OF_LABEL_NOTICE = "A moved form control left its label, so that label no longer names it.";

/** BC-12.2: a form control moved out of the Label that names it (allowed, D9; the label no longer names it). */
export function movedOutOfLabelNotice(name: string): string {
  return `${name} moved out of its label, so that label no longer names it.`;
}

/** BC-10.5.1: a paste or duplicate that would give a navigation bar more than MAX_NAVIGATION_LINKS links (BC-06). */
export const NAVIGATION_LINK_LIMIT_PASTE_NOTICE = `A navigation bar can have at most ${MAX_NAVIGATION_LINKS} links, so nothing was pasted.`;
export const NAVIGATION_LINK_LIMIT_DUPLICATE_NOTICE = `A navigation bar can have at most ${MAX_NAVIGATION_LINKS} links, so nothing was duplicated.`;

/** BC-11.2 Copy/Paste CSS feedback. */
export const STYLE_COPY_NO_SOURCE_NOTICE = "Select an element to copy its CSS.";
export const styleCopiedNotice = (name: string) => `CSS copied from ${name}.`;
export const styleCopyEmptyNotice = (name: string) => `${name} has no CSS settings of its own, so nothing was copied.`;
export const STYLE_PASTE_EMPTY_CLIPBOARD_NOTICE = "Copy CSS from an element first.";
export const STYLE_PASTE_NO_DESTINATION_NOTICE = "Select the elements to paste CSS onto.";
export const STYLE_PASTE_NOTHING_COMPATIBLE_NOTICE = "No compatible CSS settings to paste.";
export const STYLE_PASTE_UNCHANGED_NOTICE = "The selected elements already have these CSS settings.";
export const STYLE_PASTE_FREE_SIZE_NOTICE = "The copied size doesn't fit inside a Free container it would apply to, so nothing was pasted.";
export const STYLE_PASTE_INVALID_NOTICE = "These CSS settings can't be applied here, so nothing was pasted.";
export const stylePastedWithSkipsNotice = (labels: readonly string[]) => `CSS pasted. Skipped: ${labels.join(", ")}.`;
/** BC-11.3 section-level feedback. */
export const styleSectionCopiedNotice = (label: string, name: string) => `${label} CSS copied from ${name}.`;
export const styleSectionCopyEmptyNotice = (label: string, name: string) => `${name} has no ${label} CSS of its own, so nothing was copied.`;
export const styleSectionMissingNotice = (label: string) => `The copied CSS has no ${label} settings to paste.`;

/**
 * The one Paste CSS write (BC-11.2), for the whole snapshot (global) or one
 * Inspector section's group (BC-11.3): valid destinations only; a style
 * lock on any of them blocks all; merged where supported, skips named;
 * refused whole on an invalid write or the save limit; one history entry,
 * none for a no-op.
 */
function pasteStyleIntoSelection(state: EditorState, clipboard: StyleClipboard, groups: readonly StyleGroupKey[]): Partial<EditorState> {
  if (state.pendingDeletion) return {};
  const ids = existingSelectedIds(state.document, state.selection.ids);
  if (ids.length === 0) return nextEditorNoticeState(state, STYLE_PASTE_NO_DESTINATION_NOTICE);
  // BC-10 contract: a style lock on any destination blocks the whole paste.
  const protections = ids.map((id) => getStyleProtection(state.document, id));
  if (protections.some((result) => result.protected)) return nextEditorNoticeState(state, describeStyleLockNotice(protections, ids.length > 1));
  const result = applyStyleSnapshot(state.document, ids, clipboard.groups, groups);
  if (result.status === "nothing-compatible") return nextEditorNoticeState(state, STYLE_PASTE_NOTHING_COMPATIBLE_NOTICE);
  if (result.status === "unchanged") return nextEditorNoticeState(state, STYLE_PASTE_UNCHANGED_NOTICE);
  if (result.status === "invalid") return nextEditorNoticeState(state, result.reason === "free-size" ? STYLE_PASTE_FREE_SIZE_NOTICE : STYLE_PASTE_INVALID_NOTICE);
  // A copied uploaded background image on several elements must still fit the save limit (BC-07.2).
  const image = groups.includes("background") ? clipboard.groups.background?.image : undefined;
  if (image !== undefined && /^\s*data:/i.test(image) && !documentFitsSaveLimit(result.document)) return nextEditorNoticeState(state, COPY_TOO_LARGE_NOTICE);
  const notice = result.skipped.length > 0 ? nextEditorNoticeState(state, stylePastedWithSkipsNotice(result.skipped)) : {};
  return { ...pushHistory(state), document: result.document, ...notice };
}

/** BC-11.3: whether "Copy <section> CSS" would copy something: a valid primary that offers the section and authored values in it. */
export function canCopyStyleSection(state: Pick<EditorState, "document" | "selection">, group: StyleGroupKey): boolean {
  const id = state.selection.primaryId;
  const source = id && id !== state.document.id ? findNodeById(state.document, id) : undefined;
  return source !== undefined && !isEmptyStyleSnapshot(captureStyleSnapshot(state.document, source, [group], { onlyOffered: true }));
}

/** BC-11.3: whether "Paste <section> CSS" could apply something: the CSS clipboard has this group and at least one selected element supports it. */
export function canPasteStyleSection(state: Pick<EditorState, "document" | "selection" | "styleClipboard">, group: StyleGroupKey): boolean {
  const clipboard = state.styleClipboard;
  if (!clipboard || clipboard.groups[group] === undefined) return false;
  const ids = existingSelectedIds(state.document, state.selection.ids);
  return ids.length > 0 && applyStyleSnapshot(state.document, ids, clipboard.groups, [group]).status !== "nothing-compatible";
}

const PASTE_REJECTION_NOTICES: Record<CopiesRejection, string> = {
  destination: MULTI_PASTE_REJECTED_NOTICE,
  "free-bounds": FREE_GROUP_PASTE_REJECTED_NOTICE,
  "navigation-links": NAVIGATION_LINK_LIMIT_PASTE_NOTICE,
};
const DUPLICATE_REJECTION_NOTICES: Record<CopiesRejection, string> = {
  destination: MULTI_DUPLICATE_REJECTED_NOTICE,
  "free-bounds": FREE_GROUP_DUPLICATE_REJECTED_NOTICE,
  "navigation-links": NAVIGATION_LINK_LIMIT_DUPLICATE_NOTICE,
};

/** Each root's parent, aligned with `roots` (BC-10.5.1, see EditorClipboard.sourceParentIds). */
function multiClipboard(state: Pick<EditorState, "document" | "documentSessionId">, operation: EditorClipboard["operation"], roots: EditorElementNode[]): EditorClipboard {
  const sourceParentIds = roots.map((root) => findParentId(state.document, root.id));
  return { operation, nodes: roots, sourceParentId: sourceParentIds[0] ?? null, sourceParentIds, ...counterContextFor(state, roots) };
}

/** BC-17.2: the counter definitions the copied roots reference, with the session document token (counterReferenceCommands). */
function counterContextFor(state: Pick<EditorState, "document" | "documentSessionId">, roots: readonly EditorElementNode[]): Pick<EditorClipboard, "counterContext"> {
  const context = copiedCounterContext(state.document, roots, state.documentSessionId);
  return context.counters.length > 0 ? { counterContext: context } : {};
}

/**
 * A confirmed multi-cut (BC-10.5): exactly the confirmed delete, and the
 * removed subtrees (as they were just before removal, in document order)
 * become the clipboard in the SAME write — only when the removal happened,
 * so a failed cut never replaces the clipboard and nothing disappears that
 * can't be pasted.
 */
function cutNodesById(state: EditorState, ids: readonly string[]): Partial<EditorState> {
  const roots = orderedSelectionRoots(state.document, ids);
  if (roots.length === 0) return {};
  const removed = deleteNodesById(state, ids);
  if (!removed.document) return {};
  return { ...removed, clipboard: multiClipboard(state, "cut", roots) };
}

/**
 * The one deletion write (shared by deleteSelection and a confirmed
 * request): roots only, so a selected parent and child are removed once;
 * interactions targeting anything removed are removed in the same write;
 * Pagination invariants hold; one history entry.
 */
function deleteNodesById(state: EditorState, ids: readonly string[]): Partial<EditorState> {
  const roots = normalizeSelectionRoots(state.document, ids.filter((id) => id !== state.document.id));
  if (roots.length === 0) return {};
  const parentId = findParentId(state.document, roots[0]);
  const deletedIds = collectDeletedIds(state.document, roots);
  const afterRemoval = removeNodesByIds(state.document, new Set(roots));
  if (afterRemoval === state.document) return {};
  const document = withPaginationInvariants(state.document, removeInteractionsTargeting(afterRemoval, deletedIds));
  const fallback = resolveDeletionFallbackSelection(parentId, state.document.id);
  return {
    ...pushHistory(state),
    document,
    selection: selectionFromSingle(fallback),
    selectionAnchorId: fallback,
  };
}

function collectDeletedIds(document: EditorElementNode, rootIds: readonly string[]): Set<string> {
  const ids = new Set<string>();
  for (const rootId of rootIds) {
    const node = findNodeById(document, rootId);
    if (!node) continue;
    for (const id of collectNodeIds(node)) ids.add(id);
  }
  return ids;
}

/**
 * One document traversal on Preview entry (Checkpoint 1.15.6.8.1, section
 * 34's own explicit "prefer one traversal, don't rescan on every render/
 * click" requirement) — seeds the ephemeral runtimeVisibility slice from
 * every node's own authored `initialPreviewVisibility`. Only nodes
 * explicitly authored "hidden" get an entry at all (section 33's own
 * "avoid unnecessarily populating runtime state for every node" — an
 * absent entry already means visible, so there is nothing to gain by
 * also writing `true` for every other node).
 */
function buildInitialRuntimeVisibility(document: EditorElementNode): Record<string, boolean> {
  const visibility: Record<string, boolean> = {};
  function visit(node: EditorElementNode) {
    if (getInitialPreviewVisibility(node) === "hidden") visibility[node.id] = false;
    node.children?.forEach(visit);
  }
  visit(document);
  return visibility;
}

/**
 * Multi-paste (BC-10.5): fresh copies of every clipboard root, cloned as one
 * set, into the one destination the single paste would use. Bindings aimed
 * at elements deleted since the copy are dropped, as for one element.
 */
function pasteMany(state: EditorState, clipboard: EditorClipboard): Partial<EditorState> {
  const destinationParentId = resolveDestinationParent(state.document, state.selection.primaryId ?? null, clipboard.sourceParentId);
  const result = pasteCopiesInto(state.document, destinationParentId, clipboard.nodes, {
    sourceParentIds: clipboard.sourceParentIds,
    cut: clipboard.operation === "cut",
  });
  if (!result.ok) return nextEditorNoticeState(state, PASTE_REJECTION_NOTICES[result.reason]);
  const inserted = reconcilePastedCounters(result.document, result.rootIds, clipboard.counterContext, state.documentSessionId);
  if (exceedsCounterDefinitionLimit(inserted)) return nextEditorNoticeState(state, COUNTER_LIMIT_PASTE_NOTICE);
  return commitCopies(state, inserted, result.rootIds, result.formerCurrentPageIds, true, result.keptCurrentPageId);
}

/** Multi-duplicate (BC-10.5): each selected subtree's copy right after its original. */
function duplicateMany(state: EditorState): Partial<EditorState> {
  const roots = orderedSelectionRoots(state.document, state.selection.ids);
  const result = duplicateRootsInPlace(state.document, roots);
  if (!result.ok) return nextEditorNoticeState(state, DUPLICATE_REJECTION_NOTICES[result.reason]);
  return commitCopies(state, result.document, result.rootIds, result.formerCurrentPageIds, false);
}

function commitCopies(
  state: EditorState,
  inserted: EditorElementNode,
  rootIds: readonly string[],
  formerCurrentPageIds: ReadonlySet<string>,
  dropMissingTargets: boolean,
  keptCurrentPageId?: string,
): Partial<EditorState> {
  const document = withPaginationInvariants(state.document, dropMissingTargets ? removeInteractionsWithMissingTargets(inserted) : inserted, {
    ...(formerCurrentPageIds.size > 0 ? { ordinaryLookIds: formerCurrentPageIds } : {}),
    ...(keptCurrentPageId ? { preferredCurrentId: keptCurrentPageId } : {}),
  });
  const hasEmbeddedData = rootIds.some((id) => {
    const node = findNodeById(document, id);
    return node !== undefined && subtreeHasEmbeddedData(node);
  });
  if (hasEmbeddedData && !documentFitsSaveLimit(document)) return nextEditorNoticeState(state, COPY_TOO_LARGE_NOTICE);
  const primaryId = rootIds[rootIds.length - 1];
  return { ...pushHistory(state), document, selection: createSelection(rootIds, primaryId), selectionAnchorId: primaryId };
}

/** BC-13.5.1: a selection a clipboard/duplicate/delete command would actually act on (an existing, non-root element). */
function hasActionableSelection(state: EditorState): boolean {
  return state.selection.ids.some((id) => id !== state.document.id && findNodeById(state.document, id) !== undefined);
}

/**
 * BC-13.5.1 (Option B): a recognized command that is about to run ends a
 * live Free drag/resize first — rolled back, no history — so it reads and
 * changes committed geometry only. A disabled/ineligible command (nothing
 * to undo, nothing selected…) leaves the interaction alone.
 */
function interruptBeforeCommand(eligible: boolean): void {
  if (eligible) interruptActiveInteraction();
}

function eligibleSelectedNode(state: EditorState): EditorElementNode | undefined {
  const id = state.selection.primaryId;
  if (!id || id === state.document.id) {
    return undefined;
  }
  return findNodeById(state.document, id);
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
export const useEditorStore = create<EditorState>()((set, get) => ({
  document: fixtureDocument,
  selection: EMPTY_SELECTION,
  selectionAnchorId: null,
  pendingDeletion: null,
  clipboard: null,
  styleClipboard: null,
  past: [],
  future: [],
  transactionSnapshot: null,
  historyMergeSnapshot: null,
  liveGesture: null,
  editorNotice: null,
  documentSessionId: 0,
  editorMode: DEFAULT_EDITOR_MODE,
  runtimeVisibility: {},
  svgEditingNodeId: null,
  selectedSvgObjectIds: [],
  primarySvgObjectId: null,
  activeSvgTool: "select",
  svgDraft: null,
  snapEnabled: true,
  activeSnapGuides: null,
  freeInsertionPreview: null,
  persistedDocument: fixtureDocument,

  selectElement: (id) => set({ selection: selectionFromSingle(id), selectionAnchorId: id }),
  selectOnly: (id) => set({ selection: selectionFromSingle(id), selectionAnchorId: id }),
  toggleSelection: (id) => set((state) => ({ selection: toggleSelectionId(state.selection, id), selectionAnchorId: id })),
  addToSelection: (id) => set((state) => ({ selection: addSelectionId(state.selection, id), selectionAnchorId: id })),
  setSelection: (ids, primaryId) =>
    set(() => {
      const selection = createSelection(ids, primaryId);
      return { selection, selectionAnchorId: selection.primaryId ?? null };
    }),
  clearSelection: () => set({ selection: EMPTY_SELECTION, selectionAnchorId: null }),
  selectRange: (targetId, visibleIds, additive) =>
    set((state) => {
      const result = selectRangeOf(state.selection, state.selectionAnchorId, targetId, visibleIds, additive);
      return { selection: result.selection, selectionAnchorId: result.anchorId };
    }),

  // Insertion and selecting the newly inserted node are one atomic
  // update — every insertion method (click, drag) goes through this
  // single action so "select what you just inserted" can never drift
  // out of sync with "what got inserted." insertNode is itself
  // self-validating (Checkpoint 1.6 — see its own doc comment) and
  // returns the same document reference when the target legitimately
  // rejects the new node's tag (e.g. a List Item aimed at a plain
  // Container); this action must recognize that no-op rather than
  // blindly pushing a spurious history entry and selecting a node id
  // that was never actually inserted into the tree — a real bug this
  // checkpoint's own constrained-nesting rejections newly made reachable
  // (insertNode could never reject anything before Checkpoint 1.6).
  insertElement: (parentId, node, position) =>
    set((state) => {
      const document = withPaginationInvariants(state.document, insertNode(state.document, parentId, node, position));
      if (document === state.document) return {};
      return { ...pushHistory(state), document, selection: selectionFromSingle(node.id) };
    }),

  // BC-12.2: planMove (commands/moveCommands.ts) is the one rule set for
  // every move (Canvas drag, Structure keyboard): structural and component
  // rules, no-op detection, Free/Grid geometry on entry. The store only adds
  // the Pagination invariants and the single history entry.
  moveElement: (nodeId, targetId, zone, options) => {
    let outcome: MoveOutcome = { status: "unchanged" };
    set((state) => {
      const plan = planMove(state.document, nodeId, targetId, zone);
      if (plan.status === "unchanged") return {};
      if (plan.status === "rejected") {
        outcome = plan;
        const node = findNodeById(state.document, nodeId);
        return nextEditorNoticeState(state, moveRejectedMessage(node ? getElementDisplayName(node) : "The element", plan.reason));
      }
      const moved = plan.document;
      // BC-09.5: a current page dragged out of its Pagination is no longer
      // its current page (exactly like a pasted copy), so it can never
      // replace another Pagination's current page; it takes that
      // Pagination's ordinary look. Its old Pagination promotes a new one.
      const leftItsParent = findNodeById(state.document, nodeId)?.ariaCurrent === "page" && findParentId(state.document, nodeId) !== findParentId(moved, nodeId);
      const document = leftItsParent
        ? withPaginationInvariants(state.document, setElementAriaCurrentRemoved(moved, nodeId), { ordinaryLookIds: new Set([nodeId]) })
        : withPaginationInvariants(state.document, moved);
      outcome = { status: "moved", leftLabel: plan.leftLabel };
      const movedNode = findNodeById(document, nodeId);
      const notice = plan.leftLabel && movedNode ? nextEditorNoticeState(state, movedOutOfLabelNotice(getElementDisplayName(movedNode))) : {};
      const primaryId = options?.primaryId ?? nodeId;
      const selection = options?.keepSelection
        ? createSelection([...state.selection.ids, nodeId].filter((id) => findNodeById(document, id) !== undefined), primaryId)
        : selectionFromSingle(nodeId);
      return { ...pushHistory(state), ...notice, document, selection };
    });
    return outcome;
  },

  moveElements: (ids, targetId, zone, primaryId) => {
    const roots = orderedSelectionRoots(get().document, ids);
    if (roots.length === 1) return get().moveElement(roots[0].id, targetId, zone, { keepSelection: true, primaryId });
    let outcome: MoveOutcome = { status: "unchanged" };
    set((state) => {
      const plan = planMultiMove(state.document, ids, targetId, zone);
      if (plan.status === "unchanged") return {};
      if (plan.status === "rejected") {
        outcome = plan;
        return nextEditorNoticeState(state, moveBatchRejectedMessage(roots.length, plan.reason));
      }
      const document = withPaginationInvariants(state.document, plan.document, { ordinaryLookIds: plan.formerCurrentPageIds });
      outcome = { status: "moved", leftLabel: plan.leftLabel };
      const notice = plan.leftLabel ? nextEditorNoticeState(state, MOVED_GROUP_OUT_OF_LABEL_NOTICE) : {};
      const selection = createSelection([...state.selection.ids, ...plan.rootIds].filter((id) => findNodeById(document, id) !== undefined), primaryId);
      return { ...pushHistory(state), ...notice, document, selection };
    });
    return outcome;
  },

  // Resizing never changes selection — the resized node was already
  // selected (handles only render for the current selection) and stays
  // selected, unlike insertElement/moveElement which each select their
  // own target. History is handled by the transaction wrapping this
  // call (see beginResizeTransaction/commitResizeTransaction), not here —
  // this fires once per animation frame during a drag, so pushing history
  // on every call would flood the undo stack.
  // Guarded (Checkpoint 1.15.3): resize handles are already hidden
  // entirely for a protected node's selection (see CanvasOverlay), and
  // useResizeSession/useFreeChildResizeSession also refuse to even begin a
  // transaction for one (section 28's "hide, don't merely disable"
  // preference) — this store-level check is the section-29 defense-in-
  // depth backstop for any path that reaches this action directly. No
  // history push of its own either way (see the comment above), so a
  // blocked call is a true no-op: document simply keeps its current
  // reference.
  resizeElement: (nodeId, dimensions) =>
    set((state) => {
      if (getStyleProtection(state.document, nodeId).protected) return {};
      return { document: resizeNode(state.document, nodeId, dimensions), ...recordLiveGesture(state, [[nodeId, "flow-size"]]) };
    }),

  beginResizeTransaction: () =>
    set((state) => (state.transactionSnapshot ? {} : { transactionSnapshot: snapshot(state) })),

  commitResizeTransaction: () =>
    set((state) => {
      if (!state.transactionSnapshot) return {};
      return { past: [...state.past, state.transactionSnapshot], future: [], transactionSnapshot: null, historyMergeSnapshot: null, liveGesture: null };
    }),

  // Discards the in-progress transaction without recording it — used
  // when a resize drag is cancelled (Escape) rather than completed. The
  // caller is responsible for restoring state.document to the snapshot
  // itself before calling this, since cancellation needs to revert the
  // live document too, not just skip the history push.
  cancelResizeTransaction: () => set({ transactionSnapshot: null, historyMergeSnapshot: null, liveGesture: null }),

  // Free-layout movement authors CSS position (section 30) — guarded the
  // same way every other one-shot style command is.
  setFreeChildGeometry: (nodeId, geometry) =>
    set((state) => guardedStyleMutation(state, nodeId, (document) => setFreeChildGeometryCommand(document, nodeId, geometry))),

  setFreeChildGeometryLive: (nodeId, geometry) =>
    set((state) => {
      const protection = getStyleProtection(state.document, nodeId);
      if (protection.protected) return nextEditorNoticeState(state, describeStyleLockNotice([protection], false));
      return { document: setFreeChildGeometryCommand(state.document, nodeId, geometry), ...recordLiveGesture(state, [[nodeId, "free-geometry"]]) };
    }),

  restoreFreeLayoutsLive: (originals) =>
    set((state) => {
      const restored = restoreFreeLayoutsCommand(state.document, originals);
      // BC-13.5.1: rolled back to exactly the state the interaction started
      // from → that very document object, so nothing reads as changed (the
      // unsaved-changes check compares document identity).
      const open = state.transactionSnapshot;
      const document = open && isStructurallyEqual(restored, open.document) ? open.document : restored;
      return document === state.document ? {} : { document };
    }),

  restoreFreeLayoutsInHistory: (originals, fromIndex) =>
    set((state) => {
      let changed = false;
      const past = state.past.map((entry, index) => {
        if (index < fromIndex) return entry;
        const document = restoreFreeLayoutsCommand(entry.document, originals);
        if (document === entry.document) return entry;
        changed = true;
        return { ...entry, document };
      });
      return changed ? { past } : {};
    }),

  // BC-13.3 (D11): remembered globally (snapPreference), never in the document or history.
  setSnapEnabled: (enabled) => {
    writeSnapPreference(enabled);
    set({ snapEnabled: enabled });
  },
  setActiveSnapGuides: (guides) => set({ activeSnapGuides: guides }),
  setFreeInsertionPreview: (preview) => set({ freeInsertionPreview: preview }),

  setEditorMode: (mode) => set({ editorMode: mode }),

  enterPreview: () => {
    interruptBeforeCommand(get().editorMode !== "preview");
    set((state) => ({
      editorMode: "preview",
      runtimeVisibility: buildInitialRuntimeVisibility(state.document),
      svgEditingNodeId: null,
      selectedSvgObjectIds: [],
      primarySvgObjectId: null,
      activeSvgTool: "select",
      svgDraft: null,
      transactionSnapshot: null,
      historyMergeSnapshot: null,
      // A delete confirmation never survives into Preview (BC-10.2).
      pendingDeletion: null,
    }));
  },

  exitPreview: () => set({ editorMode: "design", runtimeVisibility: {} }),

  addInteraction: (nodeId, binding) =>
    set((state) => {
      const document = addInteractionCommand(state.document, nodeId, binding);
      if (document === state.document) return {};
      return { ...pushHistory(state), document };
    }),

  updateInteraction: (nodeId, interactionId, patch) =>
    set((state) => {
      const document = updateInteractionCommand(state.document, nodeId, interactionId, patch);
      if (document === state.document) return {};
      return { ...pushHistory(state), document };
    }),

  removeInteraction: (nodeId, interactionId) =>
    set((state) => {
      const document = removeInteractionCommand(state.document, nodeId, interactionId);
      if (document === state.document) return {};
      return { ...pushHistory(state), document };
    }),

  setInitialPreviewVisibility: (nodeId, value) =>
    set((state) => {
      const document = setInitialPreviewVisibilityCommand(state.document, nodeId, value);
      if (document === state.document) return {};
      return { ...pushHistory(state), document };
    }),

  // Preview click execution — mutates ONLY runtimeVisibility, never the
  // document, never history (Part E). `existingIds` is recomputed from
  // the CURRENT document on every call rather than cached, so a binding
  // whose target was deleted after the binding itself was authored (an
  // edge case deletion cleanup should already prevent, but the executor
  // stays defensive regardless — section 25) is silently skipped, never
  // throwing or corrupting runtimeVisibility.
  executeInteractionsForNode: (nodeId, trigger) =>
    set((state) => {
      const node = findNodeById(state.document, nodeId);
      // A disabled control, and a Pagination current page or ellipsis, never run their interactions (BC-09.2.1, BC-09.3).
      const parentId = node ? findParentId(state.document, nodeId) : null;
      if (!node || !canActivateInteractions(node, parentId ? findNodeById(state.document, parentId) : undefined)) return {};
      const bindings = getInteractions(node).filter((binding) => binding.trigger === trigger);
      if (bindings.length === 0) return {};

      const existingIds = collectNodeIds(state.document);
      let nextVisibility = state.runtimeVisibility;
      for (const binding of bindings) {
        if (!existingIds.has(binding.targetId)) continue;
        const currentlyVisible = nextVisibility[binding.targetId] ?? true;
        const nextVisible =
          binding.action === "show" ? true : binding.action === "hide" ? false : !currentlyVisible;
        if (nextVisible === currentlyVisible) continue;
        if (nextVisibility === state.runtimeVisibility) nextVisibility = { ...state.runtimeVisibility };
        nextVisibility[binding.targetId] = nextVisible;
      }
      if (nextVisibility === state.runtimeVisibility) return {};
      return { runtimeVisibility: nextVisibility };
    }),

  dismissRuntimeTarget: (targetId) =>
    set((state) => {
      if (state.runtimeVisibility[targetId] === false) return {};
      return { runtimeVisibility: { ...state.runtimeVisibility, [targetId]: false } };
    }),

  // Guarded on containerId itself (Checkpoint 1.15.3 closure fix) — a
  // container's own proportional-scale resize rewrites its direct
  // children's freeLayout as a coupled side effect of the container's own
  // size change, exactly like convertToFreeLayout/convertToFlowLayout
  // below; the container's own protection status is what governs the
  // whole write. Reachable in the UI only once useResizeSession/
  // useFreeChildResizeSession's own pointer-down pre-check has already
  // passed for this same id, but guarded here too so a direct store call
  // is never unsafe (section 7). No pushHistory here (mirrors
  // resizeElement/setFreeChildGeometryLive) — this fires once per
  // animation frame under an already-open begin/commitResizeTransaction.
  applyFreeContainerChildGeometriesLive: (containerId, selfUpdate, childGeometries) =>
    set((state) => {
      const protection = getStyleProtection(state.document, containerId);
      if (protection.protected) return nextEditorNoticeState(state, describeStyleLockNotice([protection], false));
      return {
        document: applyFreeContainerChildGeometries(state.document, containerId, selfUpdate, childGeometries),
        ...recordLiveGesture(state, [
          ...(selfUpdate.freeLayout ? [[containerId, "free-geometry"] as const] : selfUpdate.dimensions ? [[containerId, "flow-size"] as const] : []),
          ...Object.keys(childGeometries).map((id) => [id, "free-geometry"] as const),
        ]),
      };
    }),

  setChildResizePolicy: (containerId, policy) =>
    set((state) =>
      guardedStyleMutation(state, containerId, (document) => setChildResizePolicyForNode(document, containerId, policy)),
    ),

  // Guarded on containerId itself (Checkpoint 1.15.3 closure fix, sections
  // 3/9/10) — Flow<->Free conversion authors the container's own
  // layoutMode/dimensions/freeLayout AND rewrites its direct children's
  // freeLayout/dimensions as a single coupled write (see
  // layoutCommands.ts's own doc comments), but that child rewrite is
  // intrinsic bookkeeping for the container's own mode switch, not an
  // independent per-child style edit — exactly like
  // setFlexContainerSettings/setGridContainerSettings are guarded only on
  // the container's own id even though they visually affect children. So
  // the container's own protection status (is *it* protected by some
  // ancestor) is what governs the whole atomic write: a lock owner
  // remains free to convert itself (its own lock never protects itself),
  // while a protected descendant's conversion is blocked outright with no
  // document change and no history entry.
  convertToFreeLayout: (containerId, childGeometries, selfUpdate) =>
    set((state) =>
      guardedStyleMutation(state, containerId, (document) =>
        convertToFreeLayout(document, containerId, childGeometries, selfUpdate),
      ),
    ),

  convertToFlowLayout: (containerId) =>
    set((state) =>
      guardedStyleMutation(state, containerId, (document) => convertToFlowLayout(document, containerId)),
    ),

  // Display/gap/justify/align/grid-template are authored CSS on the
  // container itself — guarded like every other style command. A locked
  // container remains free to edit these on ITSELF (the guard checks
  // ANCESTORS of containerId, never containerId's own lock — section 33),
  // but a container that is itself protected by some ancestor further up
  // stays blocked here too, exactly like any other style field on it.
  setFlowDisplayMode: (containerId, display) =>
    set((state) => guardedStyleMutation(state, containerId, (document) => setFlowDisplayModeCommand(document, containerId, display))),

  setFlexContainerSettings: (containerId, settings) =>
    set((state) =>
      guardedStyleMutation(state, containerId, (document) => setFlexContainerSettingsCommand(document, containerId, settings)),
    ),

  setFlexContainerSettingsLive: (containerId, settings) =>
    set((state) => {
      const protection = getStyleProtection(state.document, containerId);
      if (protection.protected) return nextEditorNoticeState(state, describeStyleLockNotice([protection], false));
      return { document: setFlexContainerSettingsCommand(state.document, containerId, settings) };
    }),

  setGridContainerSettings: (containerId, settings) =>
    set((state) =>
      guardedStyleMutation(state, containerId, (document) => setGridContainerSettingsCommand(document, containerId, settings)),
    ),

  setGridContainerSettingsLive: (containerId, settings) =>
    set((state) => {
      const protection = getStyleProtection(state.document, containerId);
      if (protection.protected) return nextEditorNoticeState(state, describeStyleLockNotice([protection], false));
      return { document: setGridContainerSettingsCommand(state.document, containerId, settings) };
    }),

  setElementMargin: (nodeId, margin) =>
    set((state) => guardedStyleMutation(state, nodeId, (document) => setElementMarginCommand(document, nodeId, margin))),

  setElementPadding: (nodeId, padding) =>
    set((state) => guardedStyleMutation(state, nodeId, (document) => setElementPaddingCommand(document, nodeId, padding))),

  setFlexChildSettings: (nodeId, settings) =>
    set((state) => guardedStyleMutation(state, nodeId, (document) => setFlexChildSettingsCommand(document, nodeId, settings))),

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

      const clamped: GridChildSettings | undefined = settings && grid ? clampGridChildPlacement(settings, grid) : settings;

      return guardedStyleMutation(state, nodeId, (document) => setGridChildSettingsCommand(document, nodeId, clamped));
    }),

  setMediaFitSettings: (nodeId, settings) =>
    set((state) => guardedStyleMutation(state, nodeId, (document) => setMediaFitSettingsCommand(document, nodeId, settings))),

  setElementTypography: (nodeId, typography) =>
    set((state) => guardedStyleMutation(state, nodeId, (document) => setTypographySettingsCommand(document, nodeId, typography))),

  setElementBackground: (nodeId, background) =>
    set((state) => guardedStyleMutation(state, nodeId, (document) => setBackgroundSettingsCommand(document, nodeId, background))),

  setElementBackgroundLive: (nodeId, background) =>
    set((state) => {
      const protection = getStyleProtection(state.document, nodeId);
      if (protection.protected) return nextEditorNoticeState(state, describeStyleLockNotice([protection], false));
      return { document: setBackgroundSettingsCommand(state.document, nodeId, background), ...recordLiveGesture(state, [[nodeId, "background-image"]]) };
    }),

  restoreLiveBackgrounds: () =>
    set((state) => {
      const gesture = selectActiveLiveGesture(state);
      const open = state.transactionSnapshot;
      if (!gesture || !open) return {};
      let document = state.document;
      for (const [nodeId, slice] of Object.entries(gesture.slices)) {
        if (slice !== "background-image" || !findNodeById(document, nodeId)) continue;
        document = setBackgroundSettingsCommand(document, nodeId, findNodeById(open.document, nodeId)?.background);
      }
      if (isStructurallyEqual(document, open.document)) document = open.document;
      return document === state.document ? {} : { document };
    }),

  setElementBorder: (nodeId, border) =>
    set((state) => guardedStyleMutation(state, nodeId, (document) => setBorderSettingsCommand(document, nodeId, border))),

  setElementBorderRadius: (nodeId, borderRadius) =>
    set((state) =>
      guardedStyleMutation(state, nodeId, (document) => setBorderRadiusSettingsCommand(document, nodeId, borderRadius)),
    ),
  setElementShape: (nodeId, shape) =>
    set((state) => guardedStyleMutation(state, nodeId, (document) => setElementShapeCommand(document, nodeId, shape))),

  // Primitive/ViewBox are vector CONTENT (Checkpoint 1.15.5, section 36
  // of this checkpoint's own brief) — deliberately unguarded, the plain
  // no-op-detecting pattern every semantic/content command (setElementTag,
  // setElementHtmlId, ...) already uses, never guardedStyleMutation.
  setSvgKind: (nodeId, kind) =>
    set((state) => {
      const document = setSvgKindCommand(state.document, nodeId, kind);
      if (document === state.document) return {};
      return { ...pushHistory(state), document };
    }),
  setSvgViewBox: (nodeId, viewBox) =>
    set((state) => {
      const document = setSvgViewBoxCommand(state.document, nodeId, viewBox);
      if (document === state.document) return {};
      return { ...pushHistory(state), document };
    }),

  // Fill/Stroke/Stroke Width are visual STYLING — guarded exactly like
  // every other CSS command, so a protected SVG descendant blocks these
  // (no document change, no history, existing notice) while its own
  // Primitive/ViewBox above stay unaffected.
  setSvgFill: (nodeId, fill) =>
    set((state) => guardedStyleMutation(state, nodeId, (document) => setSvgFillCommand(document, nodeId, fill))),
  setSvgStroke: (nodeId, stroke) =>
    set((state) => guardedStyleMutation(state, nodeId, (document) => setSvgStrokeCommand(document, nodeId, stroke))),
  setSvgStrokeWidth: (nodeId, strokeWidth) =>
    set((state) =>
      guardedStyleMutation(state, nodeId, (document) => setSvgStrokeWidthCommand(document, nodeId, strokeWidth)),
    ),

  setElementBoxShadow: (nodeId, boxShadow) =>
    set((state) => guardedStyleMutation(state, nodeId, (document) => setBoxShadowSettingsCommand(document, nodeId, boxShadow))),

  setElementBoxShadowLive: (nodeId, boxShadow) =>
    set((state) => {
      const protection = getStyleProtection(state.document, nodeId);
      if (protection.protected) return nextEditorNoticeState(state, describeStyleLockNotice([protection], false));
      return { document: setBoxShadowSettingsCommand(state.document, nodeId, boxShadow) };
    }),

  setElementFilters: (nodeId, filters) =>
    set((state) => guardedStyleMutation(state, nodeId, (document) => setFilterSettingsCommand(document, nodeId, filters))),

  setElementTransition: (nodeId, transition) =>
    set((state) => guardedStyleMutation(state, nodeId, (document) => setElementTransitionCommand(document, nodeId, transition))),

  setElementTransform: (nodeId, transform) =>
    set((state) => guardedStyleMutation(state, nodeId, (document) => setElementTransformCommand(document, nodeId, transform))),

  setElementFiltersLive: (nodeId, filters) =>
    set((state) => {
      const protection = getStyleProtection(state.document, nodeId);
      if (protection.protected) return nextEditorNoticeState(state, describeStyleLockNotice([protection], false));
      return { document: setFilterSettingsCommand(state.document, nodeId, filters) };
    }),

  setElementDisplay: (nodeId, display) =>
    set((state) => guardedStyleMutation(state, nodeId, (document) => setDisplaySettingsCommand(document, nodeId, display))),

  setElementPosition: (nodeId, position) =>
    set((state) => guardedStyleMutation(state, nodeId, (document) => setPositionSettingsCommand(document, nodeId, position))),

  setElementAspectRatio: (nodeId, aspectRatio) =>
    set((state) => guardedStyleMutation(state, nodeId, (document) => setAspectRatioCommand(document, nodeId, aspectRatio))),

  setSizeConstraints: (nodeId, constraints) =>
    set((state) => guardedStyleMutation(state, nodeId, (document) => setSizeConstraintsCommand(document, nodeId, constraints))),

  setElementDimensions: (nodeId, dimensions) =>
    set((state) => guardedStyleMutation(state, nodeId, (document) => setElementDimensionsCommand(document, nodeId, dimensions))),

  setAspectRatioLocked: (nodeId, locked) =>
    set((state) => guardedStyleMutation(state, nodeId, (document) => setAspectRatioLockedCommand(document, nodeId, locked))),

  setElementText: (nodeId, text) =>
    set((state) => ({
      ...pushHistory(state),
      document: setElementTextCommand(state.document, nodeId, text),
    })),

  setElementHref: (nodeId, href) =>
    set((state) => ({
      ...pushHistory(state),
      document: withPaginationInvariants(state.document, setElementHrefCommand(state.document, nodeId, href)),
    })),

  setElementTag: (nodeId, tag) =>
    set((state) => {
      const document = setElementTagCommand(state.document, nodeId, tag);
      if (document === state.document) return {};
      return { ...pushHistory(state), document };
    }),

  setElementValue: (nodeId, value) =>
    set((state) => {
      const document = setElementValueCommand(state.document, nodeId, value);
      if (document === state.document) return {};
      return { ...pushHistory(state), document };
    }),

  setElementName: (nodeId, name) =>
    set((state) => {
      const document = setElementNameCommand(state.document, nodeId, name);
      if (document === state.document) return {};
      return { ...pushHistory(state), document };
    }),

  setElementPlaceholder: (nodeId, placeholder) =>
    set((state) => {
      const document = setElementPlaceholderCommand(state.document, nodeId, placeholder);
      if (document === state.document) return {};
      return { ...pushHistory(state), document };
    }),

  setElementInputType: (nodeId, inputType) =>
    set((state) => {
      const document = setElementInputTypeCommand(state.document, nodeId, inputType);
      if (document === state.document) return {};
      return { ...pushHistory(state), document };
    }),

  setElementChecked: (nodeId, checked) =>
    set((state) => {
      const document = setElementCheckedCommand(state.document, nodeId, checked);
      if (document === state.document) return {};
      return { ...pushHistory(state), document };
    }),

  setListItemCount: (nodeId, count) =>
    set((state) => commitStructuralEdit(state, setListItemCountCommand(state.document, nodeId, count), nodeId)),

  setOptionCount: (selectId, count) =>
    set((state) => commitStructuralEdit(state, setOptionCountCommand(state.document, selectId, count), selectId)),

  setSelectSelectedOption: (selectId, optionId) =>
    set((state) => {
      const document = setSelectSelectedOptionCommand(state.document, selectId, optionId);
      if (document === state.document) return {};
      return { ...pushHistory(state), document };
    }),

  setTableColumnCount: (tableId, count) =>
    set((state) => commitStructuralEdit(state, setTableColumnCountCommand(state.document, tableId, count), tableId)),

  setTableBodyRowCount: (tableId, count) =>
    set((state) => commitStructuralEdit(state, setTableBodyRowCountCommand(state.document, tableId, count), tableId)),

  setTableHeaderEnabled: (tableId, enabled) =>
    set((state) => commitStructuralEdit(state, setTableHeaderEnabledCommand(state.document, tableId, enabled), tableId)),

  setTableFooterEnabled: (tableId, enabled) =>
    set((state) => commitStructuralEdit(state, setTableFooterEnabledCommand(state.document, tableId, enabled), tableId)),

  setTableCaptionEnabled: (tableId, enabled) =>
    set((state) => commitStructuralEdit(state, setTableCaptionEnabledCommand(state.document, tableId, enabled), tableId)),

  addNavigationLink: (navId) =>
    set((state) => {
      const nav = findNodeById(state.document, navId);
      if (!nav) return {};
      const links = getNavigationLinks(nav);
      const link = resolveFreeDestinationPlacement(state.document, navId, createNavigationLink(links[links.length - 1]));
      const document = insertNavigationLink(state.document, navId, link);
      if (document === state.document) return {};
      return { ...pushHistory(state), document };
    }),

  removeNavigationLink: (navId, linkId) =>
    set((state) => commitStructuralEdit(state, removeNavigationLinkCommand(state.document, navId, linkId), navId)),

  moveNavigationLink: (navId, linkId, direction) =>
    set((state) => {
      const document = moveNavigationLinkCommand(state.document, navId, linkId, direction);
      if (document === state.document) return {};
      return { ...pushHistory(state), document };
    }),

  addPaginationPage: (navId) =>
    set((state) =>
      commitStructuralEdit(state, addPaginationPageCommand(state.document, navId, (page) => resolveFreeDestinationPlacement(state.document, navId, page)), navId),
    ),

  removePaginationPage: (navId, pageId) =>
    set((state) => commitStructuralEdit(state, removePaginationPageCommand(state.document, navId, pageId), navId)),

  setPaginationCurrentPage: (navId, pageId) =>
    set((state) => commitStructuralEdit(state, setPaginationCurrentPageCommand(state.document, navId, pageId), navId)),

  setPaginationPageLabel: (navId, pageId, label) =>
    set((state) => commitStructuralEdit(state, setPaginationPageLabelCommand(state.document, navId, pageId, label), navId)),

  setPaginationPageHref: (navId, pageId, href) =>
    set((state) => commitStructuralEdit(state, setPaginationPageHrefCommand(state.document, navId, pageId, href), navId)),

  setPaginationControlVisible: (navId, role, visible) =>
    set((state) => commitStructuralEdit(state, setPaginationControlVisibleCommand(state.document, navId, role, visible), navId)),

  setElementProgressValue: (nodeId, value) =>
    set((state) => {
      const document = setElementProgressValueCommand(state.document, nodeId, value);
      if (document === state.document) return {};
      return { ...pushHistory(state), document };
    }),

  setElementProgressMax: (nodeId, max) =>
    set((state) => {
      const document = setElementProgressMaxCommand(state.document, nodeId, max);
      if (document === state.document) return {};
      return { ...pushHistory(state), document };
    }),

  setElementProgressIndeterminate: (nodeId, indeterminate) =>
    set((state) => {
      const document = setElementProgressIndeterminateCommand(state.document, nodeId, indeterminate);
      if (document === state.document) return {};
      return { ...pushHistory(state), document };
    }),

  setElementSrc: (nodeId, src) =>
    set((state) => {
      const document = setElementSrcCommand(state.document, nodeId, src);
      if (document === state.document) return {};
      return { ...pushHistory(state), document };
    }),

  setElementAltText: (nodeId, alt) =>
    set((state) => {
      const document = setImageAltTextCommand(state.document, nodeId, alt);
      if (document === state.document) return {};
      return { ...pushHistory(state), document };
    }),

  setElementPoster: (nodeId, poster) =>
    set((state) => {
      const document = setElementPosterCommand(state.document, nodeId, poster);
      if (document === state.document) return {};
      return { ...pushHistory(state), document };
    }),

  setElementControls: (nodeId, controls) =>
    set((state) => {
      const document = setElementControlsCommand(state.document, nodeId, controls);
      if (document === state.document) return {};
      return { ...pushHistory(state), document };
    }),

  setElementAutoplay: (nodeId, autoplay) =>
    set((state) => {
      const document = setElementAutoplayCommand(state.document, nodeId, autoplay);
      if (document === state.document) return {};
      return { ...pushHistory(state), document };
    }),

  setElementMuted: (nodeId, muted) =>
    set((state) => {
      const document = setElementMutedCommand(state.document, nodeId, muted);
      if (document === state.document) return {};
      return { ...pushHistory(state), document };
    }),

  setElementLoop: (nodeId, loop) =>
    set((state) => {
      const document = setElementLoopCommand(state.document, nodeId, loop);
      if (document === state.document) return {};
      return { ...pushHistory(state), document };
    }),

  setElementTitle: (nodeId, title) =>
    set((state) => {
      const document = setElementTitleCommand(state.document, nodeId, title);
      if (document === state.document) return {};
      return { ...pushHistory(state), document };
    }),

  setElementHtmlId: (nodeId, htmlId) =>
    set((state) => {
      const document = setElementHtmlIdCommand(state.document, nodeId, htmlId);
      if (document === state.document) return {};
      return { ...pushHistory(state), document };
    }),

  setElementClassName: (nodeId, className) =>
    set((state) => {
      const document = setElementClassNameCommand(state.document, nodeId, className);
      if (document === state.document) return {};
      return { ...pushHistory(state), document };
    }),

  // Deliberately NOT run through guardedStyleMutation — editor-only
  // protection metadata, never itself subject to the guard it defines
  // (see setElementLockChildStyles's own doc comment in
  // documentCommands.ts and section 5 of this checkpoint's report).
  setElementLockChildStyles: (nodeId, lockChildStyles) =>
    set((state) => {
      const document = setElementLockChildStylesCommand(state.document, nodeId, lockChildStyles);
      if (document === state.document) return {};
      return { ...pushHistory(state), document };
    }),

  showEditorNotice: (message) => set((state) => nextEditorNoticeState(state, message)),
  dismissEditorNotice: () => set({ editorNotice: null }),

  beginTransaction: (options) =>
    set((state) => {
      if (state.transactionSnapshot) return {};
      const transactionSnapshot = snapshot(state);
      return { transactionSnapshot, historyMergeSnapshot: options?.mergeHistory ? transactionSnapshot : null };
    }),

  commitTransaction: () =>
    set((state) => {
      if (!state.transactionSnapshot) return {};
      if (isMergingHistory(state) && isStructurallyEqual(state.document, state.transactionSnapshot.document)) {
        return { document: state.transactionSnapshot.document, transactionSnapshot: null, historyMergeSnapshot: null, liveGesture: null };
      }
      return { past: [...state.past, state.transactionSnapshot], future: [], transactionSnapshot: null, historyMergeSnapshot: null, liveGesture: null };
    }),

  cancelTransaction: () => set({ transactionSnapshot: null, historyMergeSnapshot: null, liveGesture: null }),

  mergeTransactionWrite: (write) => {
    mergedWriteDepth++;
    try {
      write();
    } finally {
      mergedWriteDepth--;
    }
  },

  enterSvgEditMode: (svgNodeId) =>
    set((state) => {
      const node = findNodeById(state.document, svgNodeId);
      if (!node || node.tag !== "svg") return {};

      const document = hasSvgScene(node) ? state.document : materializeSvgStarterIntoScene(state.document, svgNodeId);
      const materialized = document !== state.document;

      return {
        ...(materialized ? pushHistory(state) : {}),
        document,
        // Always makes the SVG the sole primary selection, regardless of
        // what was selected beforehand — this is what keeps entering edit
        // mode self-consistent with this store's own svgEditMode
        // subscription (below the store definition), which immediately
        // exits edit mode again the moment `selection.primaryId` isn't
        // exactly this SVG. Entering edit mode via any path (Inspector
        // button, future double-click) always ends with the SVG selected.
        selection: selectionFromSingle(svgNodeId),
        svgEditingNodeId: svgNodeId,
        selectedSvgObjectIds: [],
        primarySvgObjectId: null,
        activeSvgTool: "select",
        svgDraft: null,
      };
    }),

  exitSvgEditMode: () =>
    set({ svgEditingNodeId: null, selectedSvgObjectIds: [], primarySvgObjectId: null, activeSvgTool: "select", svgDraft: null }),

  // Switching tools mid-Polygon/Pen cancels that in-progress draft
  // (section 20/56 of this checkpoint's own brief) — a half-built shape
  // left over from the PREVIOUS tool would otherwise silently persist as
  // dead UI state.
  setActiveSvgTool: (tool) => set({ activeSvgTool: tool, svgDraft: null }),

  selectSvgObjectOnly: (objectId) => set({ selectedSvgObjectIds: [objectId], primarySvgObjectId: objectId }),

  toggleSvgObjectSelection: (objectId) =>
    set((state) => {
      const alreadySelected = state.selectedSvgObjectIds.includes(objectId);
      const nextIds = alreadySelected
        ? state.selectedSvgObjectIds.filter((id) => id !== objectId)
        : [...state.selectedSvgObjectIds, objectId];
      const nextPrimary = alreadySelected
        ? state.primarySvgObjectId === objectId
          ? (nextIds[nextIds.length - 1] ?? null)
          : state.primarySvgObjectId
        : objectId;
      return { selectedSvgObjectIds: nextIds, primarySvgObjectId: nextPrimary };
    }),

  addSvgObjectToSelection: (objectId) =>
    set((state) =>
      state.selectedSvgObjectIds.includes(objectId)
        ? { primarySvgObjectId: objectId }
        : { selectedSvgObjectIds: [...state.selectedSvgObjectIds, objectId], primarySvgObjectId: objectId },
    ),

  clearSvgObjectSelection: () => set({ selectedSvgObjectIds: [], primarySvgObjectId: null }),

  startSvgDraft: (tool, point) => set({ svgDraft: { tool, points: [point] } }),

  addSvgDraftPoint: (point) =>
    set((state) => (state.svgDraft ? { svgDraft: { ...state.svgDraft, points: [...state.svgDraft.points, point] } } : {})),

  commitSvgDraft: () =>
    set((state) => {
      const draft = state.svgDraft;
      const svgNodeId = state.svgEditingNodeId;
      if (!draft || !svgNodeId) return {};

      const svgNode = findNodeById(state.document, svgNodeId);
      if (!svgNode) return { svgDraft: null };

      if (draft.tool === "polygon") {
        if (!isValidSvgPolygon(draft.points)) return {};
        const object: SvgVectorObject = {
          id: generateSvgObjectId("polygon"),
          type: "polygon",
          points: draft.points,
          ...resolveSvgObjectCreationStyle(svgNode, "polygon"),
        };
        return {
          ...pushHistory(state),
          document: addSvgObjectCommand(state.document, svgNodeId, object),
          svgDraft: null,
          activeSvgTool: "select",
          selectedSvgObjectIds: [object.id],
          primarySvgObjectId: object.id,
        };
      }

      const commands: SvgPathCommand[] = draft.points.map((point, index) => ({
        kind: index === 0 ? "M" : "L",
        x: point.x,
        y: point.y,
      }));
      if (!isValidSvgPath(commands)) return {};
      const object: SvgVectorObject = {
        id: generateSvgObjectId("path"),
        type: "path",
        commands,
        ...resolveSvgObjectCreationStyle(svgNode, "path"),
      };
      return {
        ...pushHistory(state),
        document: addSvgObjectCommand(state.document, svgNodeId, object),
        svgDraft: null,
        activeSvgTool: "select",
        selectedSvgObjectIds: [object.id],
        primarySvgObjectId: object.id,
      };
    }),

  cancelSvgDraft: () => set({ svgDraft: null }),

  addSvgObject: (svgNodeId, object) =>
    set((state) => {
      const document = addSvgObjectCommand(state.document, svgNodeId, object);
      if (document === state.document) return {};
      return { ...pushHistory(state), document };
    }),

  addSvgObjectLive: (svgNodeId, object) => set((state) => ({ document: addSvgObjectCommand(state.document, svgNodeId, object) })),

  removeSvgObjects: (svgNodeId, objectIds) =>
    set((state) => {
      const document = removeSvgObjectsCommand(state.document, svgNodeId, new Set(objectIds));
      const idSet = new Set(objectIds);
      const remainingSelection = state.selectedSvgObjectIds.filter((id) => !idSet.has(id));
      if (document === state.document) {
        if (remainingSelection.length === state.selectedSvgObjectIds.length) return {};
        return {
          selectedSvgObjectIds: remainingSelection,
          primarySvgObjectId: idSet.has(state.primarySvgObjectId ?? "") ? (remainingSelection[remainingSelection.length - 1] ?? null) : state.primarySvgObjectId,
        };
      }
      return {
        ...pushHistory(state),
        document,
        selectedSvgObjectIds: remainingSelection,
        primarySvgObjectId: remainingSelection[remainingSelection.length - 1] ?? null,
      };
    }),

  translateSvgObjects: (svgNodeId, objectIds, dx, dy) =>
    set((state) => {
      const document = translateSvgObjectsCommand(state.document, svgNodeId, new Set(objectIds), dx, dy);
      if (document === state.document) return {};
      return { ...pushHistory(state), document };
    }),

  // Vector content, unguarded — no history push (mirrors resizeElement/
  // setFreeChildGeometryLive's identical per-frame-write shape); wrap in
  // begin/commitTransaction so the whole drag becomes one history entry.
  translateSvgObjectsLive: (svgNodeId, objectIds, dx, dy) =>
    set((state) => ({ document: translateSvgObjectsCommand(state.document, svgNodeId, new Set(objectIds), dx, dy) })),

  resizeSvgObject: (svgNodeId, objectId, bounds) =>
    set((state) => {
      const document = resizeSvgObjectCommand(state.document, svgNodeId, objectId, bounds);
      if (document === state.document) return {};
      return { ...pushHistory(state), document };
    }),

  resizeSvgObjectLive: (svgNodeId, objectId, bounds) =>
    set((state) => ({ document: resizeSvgObjectCommand(state.document, svgNodeId, objectId, bounds) })),

  setSvgLineEndpointLive: (svgNodeId, objectId, x2, y2) =>
    set((state) => ({ document: setSvgLineEndpointCommand(state.document, svgNodeId, objectId, x2, y2) })),

  setSvgLineEndpoint: (svgNodeId, objectId, x2, y2) =>
    set((state) => {
      const document = setSvgLineEndpointCommand(state.document, svgNodeId, objectId, x2, y2);
      if (document === state.document) return {};
      return { ...pushHistory(state), document };
    }),

  setSvgLineStart: (svgNodeId, objectId, x1, y1) =>
    set((state) => {
      const document = setSvgLineStartCommand(state.document, svgNodeId, objectId, x1, y1);
      if (document === state.document) return {};
      return { ...pushHistory(state), document };
    }),

  setSvgObjectsFill: (svgNodeId, objectIds, fill) =>
    set((state) => guardedStyleMutation(state, svgNodeId, (document) => setSvgObjectsFillCommand(document, svgNodeId, new Set(objectIds), fill))),

  setSvgObjectsStroke: (svgNodeId, objectIds, stroke) =>
    set((state) => guardedStyleMutation(state, svgNodeId, (document) => setSvgObjectsStrokeCommand(document, svgNodeId, new Set(objectIds), stroke))),

  setSvgObjectsStrokeWidth: (svgNodeId, objectIds, strokeWidth) =>
    set((state) =>
      guardedStyleMutation(state, svgNodeId, (document) => setSvgObjectsStrokeWidthCommand(document, svgNodeId, new Set(objectIds), strokeWidth)),
    ),

  copySelection: () => {
    interruptBeforeCommand(hasActionableSelection(get()));
    set((state) => {
      if (existingSelectedIds(state.document, state.selection.ids).length > 1) {
        const roots = orderedSelectionRoots(state.document, state.selection.ids);
        return { clipboard: multiClipboard(state, "copy", roots) };
      }
      const node = eligibleSelectedNode(state);
      if (!node) return {};
      const sourceParentId = findParentId(state.document, node.id);
      return { clipboard: { operation: "copy", nodes: [node], sourceParentId, ...counterContextFor(state, [node]) } };
    });
  },

  cutSelection: () => {
    interruptBeforeCommand(!get().pendingDeletion && hasActionableSelection(get()));
    set((state) => {
      if (state.pendingDeletion) return {};
      // Two or more selected elements: confirm first, like a multi-delete.
      if (existingSelectedIds(state.document, state.selection.ids).length > 1) return { pendingDeletion: planDeletion(state.document, state.selection.ids, "cut") };
      const node = eligibleSelectedNode(state);
      if (!node) return {};
      const sourceParentId = findParentId(state.document, node.id);
      const deletedIds = collectNodeIds(node);
      const afterRemoval = removeNode(state.document, node.id);
      const document = withPaginationInvariants(state.document, removeInteractionsTargeting(afterRemoval, deletedIds));
      return {
        ...pushHistory(state),
        document,
        selection: selectionFromSingle(resolveDeletionFallbackSelection(sourceParentId, state.document.id)),
        clipboard: { operation: "cut", nodes: [node], sourceParentId, ...counterContextFor(state, [node]) },
      };
    });
  },

  pasteClipboard: () => {
    interruptBeforeCommand(!get().pendingDeletion && (get().clipboard?.nodes.length ?? 0) > 0);
    set((state) => {
      if (state.pendingDeletion) return {};
      if (state.clipboard && state.clipboard.nodes.length > 1) return pasteMany(state, state.clipboard);
      const sourceNode = state.clipboard?.nodes[0];
      if (!sourceNode) return {};
      const destinationParentId = resolveDestinationParent(
        state.document,
        state.selection.primaryId ?? null,
        state.clipboard?.sourceParentId,
      );
      // BC-09.3: a cut current page pasted back into the Pagination it was
      // cut from is moved, so it stays the current page; any other paste of
      // a current page is an ordinary page (state and look).
      const wasCurrentPage = sourceNode.ariaCurrent === "page";
      const movesCurrentPage = wasCurrentPage && state.clipboard?.operation === "cut" && destinationParentId === state.clipboard.sourceParentId;
      // BC-10.5.1: the copy's authored HTML id is made unique (kept if free).
      const [fresh] = withUniqueHtmlIdsForCopies(state.document, [cloneNodeWithFreshIds(sourceNode)]);
      const clone = resolveFreeDestinationPlacement(
        state.document,
        destinationParentId,
        movesCurrentPage ? fresh : withoutCopiedCurrentState(fresh),
      );
      // A pasted trigger may still point at a target deleted since the
      // copy; that binding is removed, as deleting the target would have.
      // BC-17.2: pasted counter references always resolve (same document: kept; foreign: mapped by name or created).
      const document = reconcilePastedCounters(
        withPaginationInvariants(
          state.document,
          removeInteractionsWithMissingTargets(insertNode(state.document, destinationParentId, clone)),
          movesCurrentPage ? { preferredCurrentId: clone.id } : wasCurrentPage ? { ordinaryLookIds: new Set([clone.id]) } : undefined,
        ),
        [clone.id],
        state.clipboard?.counterContext,
        state.documentSessionId,
      );
      if (exceedsCounterDefinitionLimit(document)) return nextEditorNoticeState(state, COUNTER_LIMIT_PASTE_NOTICE);
      if (exceedsNavigationLinkLimit(state.document, document)) return nextEditorNoticeState(state, NAVIGATION_LINK_LIMIT_PASTE_NOTICE);
      if (subtreeHasEmbeddedData(clone) && !documentFitsSaveLimit(document)) return nextEditorNoticeState(state, COPY_TOO_LARGE_NOTICE);
      return {
        ...pushHistory(state),
        document,
        selection: selectionFromSingle(clone.id),
      };
    });
  },

  duplicateSelection: () => {
    interruptBeforeCommand(!get().pendingDeletion && hasActionableSelection(get()));
    set((state) => {
      if (state.pendingDeletion) return {};
      if (existingSelectedIds(state.document, state.selection.ids).length > 1) return duplicateMany(state);
      const node = eligibleSelectedNode(state);
      if (!node) return {};
      const parentId = findParentId(state.document, node.id);
      if (!parentId) return {};
      const [fresh] = withUniqueHtmlIdsForCopies(state.document, [cloneNodeWithFreshIds(node)]);
      const clone = resolveFreeDestinationPlacement(state.document, parentId, withoutCopiedCurrentState(fresh));
      const document = withPaginationInvariants(
        state.document,
        insertNode(state.document, parentId, clone, { referenceId: node.id, placement: "after" }),
        node.ariaCurrent === "page" ? { ordinaryLookIds: new Set([clone.id]) } : undefined,
      );
      if (exceedsNavigationLinkLimit(state.document, document)) return nextEditorNoticeState(state, NAVIGATION_LINK_LIMIT_DUPLICATE_NOTICE);
      if (subtreeHasEmbeddedData(clone) && !documentFitsSaveLimit(document)) return nextEditorNoticeState(state, COPY_TOO_LARGE_NOTICE);
      return { ...pushHistory(state), document, selection: selectionFromSingle(clone.id) };
    });
  },

  copyStyle: () => {
    interruptBeforeCommand(eligibleSelectedNode(get()) !== undefined);
    set((state) => {
      const source = eligibleSelectedNode(state);
      if (!source) return nextEditorNoticeState(state, STYLE_COPY_NO_SOURCE_NOTICE);
      const name = getReadableNodeName(source);
      // BC-11.4: only groups the source offers in its own Inspector — never a
      // stale value it no longer shows (a Flex item setting left from an
      // earlier Flex parent, Position on a Free child), which would paste
      // styles the user can't see on the source.
      const groups = captureStyleSnapshot(state.document, source, STYLE_GROUP_KEYS, { onlyOffered: true });
      if (isEmptyStyleSnapshot(groups)) return { ...nextEditorNoticeState(state, styleCopyEmptyNotice(name)), styleClipboard: null };
      return { ...nextEditorNoticeState(state, styleCopiedNotice(name)), styleClipboard: { version: 1, sourceName: name, groups } };
    });
  },

  pasteStyle: () => {
    interruptBeforeCommand(get().styleClipboard !== null && hasActionableSelection(get()));
    set((state) => {
      if (!state.styleClipboard) return nextEditorNoticeState(state, STYLE_PASTE_EMPTY_CLIPBOARD_NOTICE);
      return pasteStyleIntoSelection(state, state.styleClipboard, STYLE_GROUP_KEYS);
    });
  },

  copyStyleSection: (group) =>
    set((state) => {
      const source = eligibleSelectedNode(state);
      if (!source) return nextEditorNoticeState(state, STYLE_COPY_NO_SOURCE_NOTICE);
      const name = getReadableNodeName(source);
      const label = styleGroupLabel(group);
      const groups = captureStyleSnapshot(state.document, source, [group], { onlyOffered: true });
      // Like a global copy of an element with no CSS: never leave an older snapshot to be pasted by surprise.
      if (isEmptyStyleSnapshot(groups)) return { ...nextEditorNoticeState(state, styleSectionCopyEmptyNotice(label, name)), styleClipboard: null };
      return { ...nextEditorNoticeState(state, styleSectionCopiedNotice(label, name)), styleClipboard: { version: 1, sourceName: name, groups } };
    }),

  pasteStyleSection: (group) =>
    set((state) => {
      const clipboard = state.styleClipboard;
      if (!clipboard) return nextEditorNoticeState(state, STYLE_PASTE_EMPTY_CLIPBOARD_NOTICE);
      // Explicit group filtering: nothing from another group is reinterpreted as this one.
      if (clipboard.groups[group] === undefined) return nextEditorNoticeState(state, styleSectionMissingNotice(styleGroupLabel(group)));
      return pasteStyleIntoSelection(state, clipboard, [group]);
    }),

  // Multi-selection-aware (Checkpoint 1.15.2, Part 16): normalizes to
  // top-level selection roots first (dropping any selected id that is
  // itself a descendant of another selected id), so "Container plus its
  // own selected Paragraph child" deletes Container exactly once rather
  // than attempting a second, now-dangling removal of the Paragraph — see
  // normalizeSelectionRoots/removeNodesByIds's own doc comments. This same
  // path handles an ordinary single-node delete too (roots.length === 1
  // degenerates to the pre-1.15.2 behavior exactly), so there is no
  // separate single-selection code path to keep in sync.
  deleteSelection: () => {
    interruptBeforeCommand(hasActionableSelection(get()));
    set((state) => deleteNodesById(state, state.selection.ids));
  },

  requestDeleteSelection: () => {
    interruptBeforeCommand(!get().pendingDeletion && hasActionableSelection(get()));
    set((state) => {
      if (state.pendingDeletion) return {};
      const plan = planDeletion(state.document, state.selection.ids);
      if (plan.selectedIds.length === 0) return {};
      if (plan.selectedIds.length === 1) return deleteNodesById(state, plan.selectedIds);
      return { pendingDeletion: plan };
    });
  },

  confirmPendingDeletion: () => {
    interruptBeforeCommand(get().pendingDeletion !== null);
    set((state) => {
      const pending = state.pendingDeletion;
      if (!pending) return {};
      // The exact targets the user confirmed: the selection must still be
      // exactly them, and every one must still exist. Never retargeted.
      const current = planDeletion(state.document, state.selection.ids);
      const unchanged =
        current.selectedIds.length === pending.selectedIds.length &&
        pending.selectedIds.every((id) => current.selectedIds.includes(id)) &&
        current.totalCount === pending.totalCount;
      const cut = pending.kind === "cut";
      if (!unchanged) return { ...nextEditorNoticeState(state, cut ? STALE_CUT_NOTICE : STALE_DELETION_NOTICE), pendingDeletion: null };
      return { ...(cut ? cutNodesById(state, pending.selectedIds) : deleteNodesById(state, pending.selectedIds)), pendingDeletion: null };
    });
  },

  cancelPendingDeletion: () => set((state) => (state.pendingDeletion ? { pendingDeletion: null } : {})),

  // Every bulk command below is guarded atomically (Checkpoint 1.15.3,
  // sections 17-18): if ANY targeted id is style-protected, the WHOLE bulk
  // mutation is blocked — none of the unprotected targets change either —
  // matching guardedBulkStyleMutation's own doc comment.
  setElementsSettings: (ids, key, value, options) =>
    set((state) => {
      if (!options?.live) return guardedBulkStyleMutation(state, ids, (document) => applySectionSettings(document, ids, key, value));
      const protections = ids.map((id) => getStyleProtection(state.document, id));
      if (protections.some((result) => result.protected)) return nextEditorNoticeState(state, describeStyleLockNotice(protections, true));
      const document = applySectionSettings(state.document, ids, key, value);
      return document === state.document ? {} : { document };
    }),

  setElementsTypographyField: (ids, field, value) =>
    set((state) =>
      guardedBulkStyleMutation(state, ids, (document) => setElementsTypographyFieldCommand(document, new Set(ids), field, value)),
    ),
  setElementsBackgroundField: (ids, field, value) =>
    set((state) =>
      guardedBulkStyleMutation(state, ids, (document) => setElementsBackgroundFieldCommand(document, new Set(ids), field, value)),
    ),
  setElementsBorderAllSidesField: (ids, field, value) =>
    set((state) =>
      guardedBulkStyleMutation(state, ids, (document) =>
        setElementsBorderAllSidesFieldCommand(document, new Set(ids), field, value),
      ),
    ),
  setElementsBorderRadiusAllCorners: (ids, value) =>
    set((state) =>
      guardedBulkStyleMutation(state, ids, (document) => setElementsBorderRadiusAllCornersCommand(document, new Set(ids), value)),
    ),
  setElementsShape: (ids, shape) =>
    set((state) => guardedBulkStyleMutation(state, ids, (document) => setElementsShapeCommand(document, new Set(ids), shape))),

  // Bulk Primitive is vector CONTENT (see setSvgKind's own doc comment
  // above) — unguarded, same plain no-op-detecting shape every unguarded
  // single-node content command already uses, generalized to a bulk id
  // set rather than wrapped in guardedBulkStyleMutation.
  setElementsSvgKind: (ids, kind) =>
    set((state) => {
      const document = setElementsSvgKindCommand(state.document, new Set(ids), kind);
      if (document === state.document) return {};
      return { ...pushHistory(state), document };
    }),
  setElementsSvgFill: (ids, fill) =>
    set((state) =>
      guardedBulkStyleMutation(state, ids, (document) => setElementsSvgFillCommand(document, new Set(ids), fill)),
    ),
  setElementsSvgStroke: (ids, stroke) =>
    set((state) =>
      guardedBulkStyleMutation(state, ids, (document) => setElementsSvgStrokeCommand(document, new Set(ids), stroke)),
    ),
  setElementsSvgStrokeWidth: (ids, strokeWidth) =>
    set((state) =>
      guardedBulkStyleMutation(state, ids, (document) =>
        setElementsSvgStrokeWidthCommand(document, new Set(ids), strokeWidth),
      ),
    ),

  setElementsDisplayField: (ids, field, value) =>
    set((state) =>
      guardedBulkStyleMutation(state, ids, (document) => setElementsDisplayFieldCommand(document, new Set(ids), field, value)),
    ),
  setElementsTransitionField: (ids, field, value) =>
    set((state) =>
      guardedBulkStyleMutation(state, ids, (document) => setElementsTransitionFieldCommand(document, new Set(ids), field, value)),
    ),

  setElementsTransition: (ids, transition) =>
    set((state) =>
      guardedBulkStyleMutation(state, ids, (document) => setElementsTransitionCommand(document, new Set(ids), transition)),
    ),

  setElementsTransformField: (ids, field, value) =>
    set((state) =>
      guardedBulkStyleMutation(state, ids, (document) => setElementsTransformFieldCommand(document, new Set(ids), field, value)),
    ),

  setElementsTransform: (ids, transform) =>
    set((state) =>
      guardedBulkStyleMutation(state, ids, (document) => setElementsTransformCommand(document, new Set(ids), transform)),
    ),

  setElementsFilterField: (ids, field, value) =>
    set((state) =>
      guardedBulkStyleMutation(state, ids, (document) => setElementsFilterFieldCommand(document, new Set(ids), field, value)),
    ),
  setElementsPositionField: (ids, field, value) =>
    set((state) =>
      guardedBulkStyleMutation(state, ids, (document) => setElementsPositionFieldCommand(document, new Set(ids), field, value)),
    ),
  setElementsMediaFitField: (ids, field, value) =>
    set((state) =>
      guardedBulkStyleMutation(state, ids, (document) => setElementsMediaFitFieldCommand(document, new Set(ids), field, value)),
    ),
  setElementsSizeConstraintField: (ids, field, value) =>
    set((state) =>
      guardedBulkStyleMutation(state, ids, (document) =>
        setElementsSizeConstraintFieldCommand(document, new Set(ids), field, value),
      ),
    ),
  setElementsSpacingAllSides: (ids, box, value) =>
    set((state) =>
      guardedBulkStyleMutation(state, ids, (document) => setElementsSpacingAllSidesCommand(document, new Set(ids), box, value)),
    ),
  setElementsAspectRatio: (ids, aspectRatio) =>
    set((state) =>
      guardedBulkStyleMutation(state, ids, (document) => setElementsAspectRatioCommand(document, new Set(ids), aspectRatio)),
    ),
  setElementsDimensions: (ids, dimensions) =>
    set((state) => guardedBulkStyleMutation(state, ids, (document) => setElementsDimensionsCommand(document, new Set(ids), dimensions))),

  undo: () => {
    interruptBeforeCommand(get().past.length > 0);
    set((state) => {
      if (state.past.length === 0) return {};
      const previous = state.past[state.past.length - 1];
      return {
        document: previous.document,
        selection: previous.selection,
        past: state.past.slice(0, -1),
        future: [snapshot(state), ...state.future],
      };
    });
  },

  redo: () => {
    interruptBeforeCommand(get().future.length > 0);
    set((state) => {
      if (state.future.length === 0) return {};
      const [next, ...rest] = state.future;
      return {
        document: next.document,
        selection: next.selection,
        past: [...state.past, snapshot(state)],
        future: rest,
      };
    });
  },

  replaceDocument: (document) => {
    interruptBeforeCommand(true);
    set((state) => ({
      document,
      documentSessionId: state.documentSessionId + 1,
      persistedDocument: document,
      selection: EMPTY_SELECTION,
      selectionAnchorId: null,
      pendingDeletion: null,
      past: [],
      future: [],
      transactionSnapshot: null,
      historyMergeSnapshot: null,
      liveGesture: null,
      editorNotice: null,
      editorMode: DEFAULT_EDITOR_MODE,
      runtimeVisibility: {},
      svgEditingNodeId: null,
      selectedSvgObjectIds: [],
      primarySvgObjectId: null,
      activeSvgTool: "select",
      svgDraft: null,
      activeSnapGuides: null,
      freeInsertionPreview: null,
    }));
  },

  markDocumentPersisted: (document) => set({ persistedDocument: document }),
}));

/**
 * SVG Edit Mode's own lifecycle guard (Checkpoint 1.15.6, sections 11/37/
 * 71 of its own brief) — a single centralized Zustand subscription rather
 * than patching every one of the dozen-plus places `selection`/`document`
 * can change (the six direct selection actions, insert/move/delete/
 * duplicate/paste, undo/redo, ...). Exits SVG Edit Mode the moment either
 * becomes true: the outer document selection is no longer exactly the
 * edited SVG itself (covers "changing outer selection exits mode," since
 * every selection-changing action already funnels through `selection`),
 * or that SVG node no longer exists in the document at all (covers
 * "deleting outer SVG cleans mode state," including the rarer path of an
 * Undo/Redo landing on a document where it was never inserted). Reading
 * `useEditorStore.getState()` inside the listener (rather than closing
 * over the `state`/`prevState` the subscription callback already
 * receives) keeps this resilient to whatever else a future action might
 * also change in the same `set` call.
 */
useEditorStore.subscribe((state) => {
  const editingId = state.svgEditingNodeId;
  if (!editingId) return;
  const stillPrimary = state.selection.primaryId === editingId;
  const stillExists = findNodeById(state.document, editingId) !== undefined;
  if (!stillPrimary || !stillExists) {
    useEditorStore.getState().exitSvgEditMode();
  }
});

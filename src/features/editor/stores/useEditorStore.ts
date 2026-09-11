import { create } from "zustand";
import {
  insertNode,
  moveNode,
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
  setTableBodyRowCount as setTableBodyRowCountCommand,
  setTableColumnCount as setTableColumnCountCommand,
  setTableFooterEnabled as setTableFooterEnabledCommand,
  setTableHeaderEnabled as setTableHeaderEnabledCommand,
} from "@/features/editor/commands/tableCommands";
import type { InputType } from "@/features/editor/types/input";
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
  setElementsSizeConstraintField as setElementsSizeConstraintFieldCommand,
  setElementsSpacingAllSides as setElementsSpacingAllSidesCommand,
  setElementsTypographyField as setElementsTypographyFieldCommand,
} from "@/features/editor/commands/bulkCommands";
import {
  addSelectionId,
  createSelection,
  EMPTY_SELECTION,
  selectionFromSingle,
  toggleSelectionId,
  type EditorSelection,
} from "@/features/editor/types/selection";
import { describeStyleLockNotice, getStyleProtection, type StyleProtectionResult } from "@/features/editor/rules/styleProtection";
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
import type { CssLengthValue, TypographySettings } from "@/features/editor/types/typography";
import type { BackgroundSettings } from "@/features/editor/types/background";
import type { BorderSettings, BorderSideSettings } from "@/features/editor/types/border";
import type { BorderRadiusSettings } from "@/features/editor/types/borderRadius";
import type { BoxShadowSettings } from "@/features/editor/types/boxShadow";
import type { FilterSettings } from "@/features/editor/types/filters";
import type { DisplaySettings } from "@/features/editor/types/display";
import type { PositionSettings } from "@/features/editor/types/position";
import type { AspectRatioValue } from "@/features/editor/types/aspectRatio";
import type { SizeConstraints } from "@/features/editor/types/sizeConstraints";

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
  clipboard: EditorClipboard | null;
  past: HistoryEntry[];
  future: HistoryEntry[];
  /** Non-null while a continuous interaction (currently: resize) is mid-drag — see beginResizeTransaction. */
  transactionSnapshot: HistoryEntry | null;
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

  /** One-shot media/embed source URL edit (Checkpoint 1.15 — Video's and Iframe's own Source URL field). Same action-level no-op guard as every other one-shot field command. */
  setElementSrc: (nodeId: string, src: string | undefined) => void;
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
  setElementsBackgroundField: <K extends Exclude<keyof BackgroundSettings, "size" | "customSize" | "gradient">>(
    ids: readonly string[],
    field: K,
    value: BackgroundSettings[K],
  ) => void;
  /** "All Sides" bulk Border mode (Checkpoint 1.15.2) — per-individual-side bulk editing is deferred, see this checkpoint's report. */
  setElementsBorderAllSidesField: <K extends keyof BorderSideSettings>(ids: readonly string[], field: K, value: BorderSideSettings[K]) => void;
  setElementsBorderRadiusAllCorners: (ids: readonly string[], value: CssLengthValue | undefined) => void;
  setElementsDisplayField: <K extends keyof DisplaySettings>(ids: readonly string[], field: K, value: DisplaySettings[K]) => void;
  setElementsFilterField: <K extends keyof FilterSettings>(ids: readonly string[], field: K, value: FilterSettings[K]) => void;
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
  return { document: state.document, selection: state.selection };
}

/** Every one-shot (non-transactional) mutation pushes the pre-mutation snapshot and clears redo. */
function pushHistory(state: EditorState): Pick<EditorState, "past" | "future"> {
  return { past: [...state.past, snapshot(state)], future: [] };
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
export const useEditorStore = create<EditorState>()((set) => ({
  document: fixtureDocument,
  selection: EMPTY_SELECTION,
  clipboard: null,
  past: [],
  future: [],
  transactionSnapshot: null,
  editorNotice: null,

  selectElement: (id) => set({ selection: selectionFromSingle(id) }),
  selectOnly: (id) => set({ selection: selectionFromSingle(id) }),
  toggleSelection: (id) => set((state) => ({ selection: toggleSelectionId(state.selection, id) })),
  addToSelection: (id) => set((state) => ({ selection: addSelectionId(state.selection, id) })),
  setSelection: (ids, primaryId) => set({ selection: createSelection(ids, primaryId) }),
  clearSelection: () => set({ selection: EMPTY_SELECTION }),

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
      const document = insertNode(state.document, parentId, node, position);
      if (document === state.document) return {};
      return { ...pushHistory(state), document, selection: selectionFromSingle(node.id) };
    }),

  // Same shape as insertElement, and the same no-op guard: moveNode
  // already gates through isValidMoveTarget (which useMoveElement also
  // checks before ever calling this action), but this action must not
  // trust that double-gating alone — a rejected move must not push a
  // spurious no-diff history entry either.
  moveElement: (nodeId, targetId, zone) =>
    set((state) => {
      const document = moveNode(state.document, nodeId, targetId, zone);
      if (document === state.document) return {};
      return { ...pushHistory(state), document, selection: selectionFromSingle(nodeId) };
    }),

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
      return { document: resizeNode(state.document, nodeId, dimensions) };
    }),

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

  // Free-layout movement authors CSS position (section 30) — guarded the
  // same way every other one-shot style command is.
  setFreeChildGeometry: (nodeId, geometry) =>
    set((state) => guardedStyleMutation(state, nodeId, (document) => setFreeChildGeometryCommand(document, nodeId, geometry))),

  setFreeChildGeometryLive: (nodeId, geometry) =>
    set((state) => {
      const protection = getStyleProtection(state.document, nodeId);
      if (protection.protected) return nextEditorNoticeState(state, describeStyleLockNotice([protection], false));
      return { document: setFreeChildGeometryCommand(state.document, nodeId, geometry) };
    }),

  applyFreeContainerChildGeometriesLive: (containerId, selfUpdate, childGeometries) =>
    set((state) => ({
      document: applyFreeContainerChildGeometries(state.document, containerId, selfUpdate, childGeometries),
    })),

  setChildResizePolicy: (containerId, policy) =>
    set((state) =>
      guardedStyleMutation(state, containerId, (document) => setChildResizePolicyForNode(document, containerId, policy)),
    ),

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

  setGridContainerSettings: (containerId, settings) =>
    set((state) =>
      guardedStyleMutation(state, containerId, (document) => setGridContainerSettingsCommand(document, containerId, settings)),
    ),

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

      const clamped: GridChildSettings = grid ? clampGridChildPlacement(settings, grid) : settings;

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
      return { document: setBackgroundSettingsCommand(state.document, nodeId, background) };
    }),

  setElementBorder: (nodeId, border) =>
    set((state) => guardedStyleMutation(state, nodeId, (document) => setBorderSettingsCommand(document, nodeId, border))),

  setElementBorderRadius: (nodeId, borderRadius) =>
    set((state) =>
      guardedStyleMutation(state, nodeId, (document) => setBorderRadiusSettingsCommand(document, nodeId, borderRadius)),
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
      document: setElementHrefCommand(state.document, nodeId, href),
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
    set((state) => {
      const document = setListItemCountCommand(state.document, nodeId, count);
      if (document === state.document) return {};
      return { ...pushHistory(state), document };
    }),

  setOptionCount: (selectId, count) =>
    set((state) => {
      const document = setOptionCountCommand(state.document, selectId, count);
      if (document === state.document) return {};
      return { ...pushHistory(state), document };
    }),

  setSelectSelectedOption: (selectId, optionId) =>
    set((state) => {
      const document = setSelectSelectedOptionCommand(state.document, selectId, optionId);
      if (document === state.document) return {};
      return { ...pushHistory(state), document };
    }),

  setTableColumnCount: (tableId, count) =>
    set((state) => {
      const document = setTableColumnCountCommand(state.document, tableId, count);
      if (document === state.document) return {};
      return { ...pushHistory(state), document };
    }),

  setTableBodyRowCount: (tableId, count) =>
    set((state) => {
      const document = setTableBodyRowCountCommand(state.document, tableId, count);
      if (document === state.document) return {};
      return { ...pushHistory(state), document };
    }),

  setTableHeaderEnabled: (tableId, enabled) =>
    set((state) => {
      const document = setTableHeaderEnabledCommand(state.document, tableId, enabled);
      if (document === state.document) return {};
      return { ...pushHistory(state), document };
    }),

  setTableFooterEnabled: (tableId, enabled) =>
    set((state) => {
      const document = setTableFooterEnabledCommand(state.document, tableId, enabled);
      if (document === state.document) return {};
      return { ...pushHistory(state), document };
    }),

  setElementSrc: (nodeId, src) =>
    set((state) => {
      const document = setElementSrcCommand(state.document, nodeId, src);
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
        selection: selectionFromSingle(resolveDeletionFallbackSelection(sourceParentId, state.document.id)),
        clipboard: { operation: "cut", nodes: [node], sourceParentId },
      };
    }),

  pasteClipboard: () =>
    set((state) => {
      const sourceNode = state.clipboard?.nodes[0];
      if (!sourceNode) return {};
      const destinationParentId = resolveDestinationParent(
        state.document,
        state.selection.primaryId ?? null,
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
        selection: selectionFromSingle(clone.id),
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
      return { ...pushHistory(state), document, selection: selectionFromSingle(clone.id) };
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
  deleteSelection: () =>
    set((state) => {
      const roots = normalizeSelectionRoots(state.document, state.selection.ids);
      if (roots.length === 0) return {};
      const parentId = findParentId(state.document, roots[0]);
      const document = removeNodesByIds(state.document, new Set(roots));
      if (document === state.document) return {};
      return {
        ...pushHistory(state),
        document,
        selection: selectionFromSingle(resolveDeletionFallbackSelection(parentId, state.document.id)),
      };
    }),

  // Every bulk command below is guarded atomically (Checkpoint 1.15.3,
  // sections 17-18): if ANY targeted id is style-protected, the WHOLE bulk
  // mutation is blocked — none of the unprotected targets change either —
  // matching guardedBulkStyleMutation's own doc comment.
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
  setElementsDisplayField: (ids, field, value) =>
    set((state) =>
      guardedBulkStyleMutation(state, ids, (document) => setElementsDisplayFieldCommand(document, new Set(ids), field, value)),
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

  undo: () =>
    set((state) => {
      if (state.past.length === 0) return {};
      const previous = state.past[state.past.length - 1];
      return {
        document: previous.document,
        selection: previous.selection,
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
        selection: next.selection,
        past: [...state.past, snapshot(state)],
        future: rest,
      };
    }),
}));

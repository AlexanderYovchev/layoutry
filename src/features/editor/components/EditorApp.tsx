"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { AppShell } from "@/components/layout/AppShell";
import type { EditMenuCommands, FileMenuCommands } from "@/components/layout/applicationMenus";
import type { ProjectIdentityInfo } from "@/components/layout/ProjectIdentity";
import type { CatalogCardPlaceholder } from "@/components/layout/creationToolbarCategories";
import { DocumentCanvas } from "@/features/canvas/components/DocumentCanvas";
import { CanvasControlStrip } from "@/features/canvas/components/CanvasControlStrip";
import {
  cancelFreeInsertion,
  finishFreeInsertion,
  isFreeInsertionScrolling,
  setFreeInsertionDestination,
  startFreeInsertion,
} from "@/features/canvas/utils/freeInsertionSession";
import { useSnapPreferenceHydration } from "@/features/editor/hooks/useSnapPreferenceHydration";
import { EditorNoticeBanner } from "@/features/editor/components/EditorNoticeBanner";
import { MultiDeleteConfirmDialog } from "@/features/editor/components/MultiDeleteConfirmDialog";
import { StructurePanel } from "@/features/editor/components/structure/StructurePanel";
import { InspectorContent } from "@/features/inspector/components/InspectorContent";
import { createElementNode, isInsertableElementType } from "@/features/editor/factories/elementFactories";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { useEditorKeyboardShortcuts } from "@/features/editor/hooks/useEditorKeyboardShortcuts";
import { useInsertElement } from "@/features/editor/hooks/useInsertElement";
import { useMoveElement } from "@/features/editor/hooks/useMoveElement";
import { resolveDragEndInsertion } from "@/features/editor/utils/resolveDragEndInsertion";
import { resolveDragEndMove } from "@/features/editor/utils/resolveDragEndMove";
import { resolveInsertionParent } from "@/features/editor/utils/resolveInsertionParent";
import { findAncestorChain } from "@/features/editor/utils/findNodeById";
import type { EditorElementNode } from "@/features/editor/types/document";
import { swallowReleaseClick } from "@/lib/swallowReleaseClick";

interface ActiveDragPreview {
  label: string;
}

/**
 * A Canvas node is never its own drop target (BC-12.3: this replaced a
 * per-node `disabled` that re-rendered every node on every move — see
 * useNodeDropRegistration). Structure drags run in their own nested
 * context since BC-12.5 (StructureDragContext) and never reach this one.
 */
const collisionDetection: CollisionDetection = (args) =>
  pointerWithin({ ...args, droppableContainers: args.droppableContainers.filter((container) => container.id !== args.active.id) });

/**
 * One object for the component's lifetime: useSensor memoizes on it, and a
 * new object every render gave dnd-kit new activators, a new internal
 * context and a re-render of every draggable Canvas node whenever this
 * component re-rendered (found in PROJECT-1.5's recovery profiling).
 */
const POINTER_SENSOR_OPTIONS = { activationConstraint: { distance: 4 } };

/**
 * Drag auto-scroll (dnd-kit) scrolls the dragged item's scrollable
 * ancestors when the pointer nears their edges. A Resource panel list
 * opts out (data-no-drag-autoscroll, set by ResourceScrollRegion).
 *
 * Since BC-03.2 those lists really scroll, and dragging a tile out of one
 * towards the Canvas crosses the list's lower edge band, so dnd-kit
 * scrolled the list under the pointer (measured: 94 px per drag, which
 * then made the next drag start on the search field). Nothing is ever
 * dropped into these lists, so auto-scrolling them has no use. The
 * threshold and acceleration are unchanged. (The Structure list's own
 * edge auto-scroll lives in StructureDragContext, BC-12.3/12.5.)
 */
const AUTO_SCROLL_OPTIONS = {
  threshold: { x: 0, y: 0.2 },
  acceleration: 10,
  // BC-13.6: while a Resource Panel drag previews a Free container, that
  // session's own auto-scroll (freeAutoScroll, limited to what the container
  // can reach) is the only one running.
  canScroll: (element: Element) => !isFreeInsertionScrolling() && !(element instanceof HTMLElement && element.dataset.noDragAutoscroll !== undefined),
};

/**
 * BC-13.5 (D21): Escape during a Canvas or catalog drag (this DndContext)
 * only cancels the drag — dnd-kit's own listener does that. Marked as
 * handled first (capture phase), so the Canvas's Escape-clears-the-
 * selection shortcut (CanvasInteractionBoundary skips a defaultPrevented
 * Escape) keeps the selection — the same claim BC-12.3.1 added for
 * Structure drags. Module-level, so the same function is added and removed.
 */
/** Whether ancestorId is an ancestor of nodeId. */
function isAncestorOf(documentModel: EditorElementNode, ancestorId: string, nodeId: string): boolean {
  return findAncestorChain(documentModel, nodeId).some((ancestor) => ancestor.id === ancestorId);
}

function claimEscapeDuringDrag(event: KeyboardEvent) {
  if (event.key !== "Escape") return;
  event.preventDefault();
  // The button is still held: the click its release produces (uncaptured,
  // on whatever is under the pointer) must not change the selection either.
  swallowReleaseClick();
}

interface EditorAppProps {
  /**
   * PROJECT-1.2 — project UI supplied by the project feature's
   * ProjectWorkspace, which wraps this component. Passed in as props so the
   * editor never imports the project feature (ADR-0003). All optional: the
   * editor runs on its own without them.
   */
  fileMenuCommands?: FileMenuCommands;
  project?: ProjectIdentityInfo;
  /** Project dialogs and notices, rendered alongside the editor. */
  overlays?: ReactNode;
}

/**
 * The editor's top-level composition root: assembles AppShell with real
 * feature content and owns the one shared DndContext both the Creation
 * Toolbar's catalog cards (insert) and the Canvas's rendered nodes
 * (move) drag through — collisionDetection is pointerWithin rather than
 * the default rectIntersection specifically because targets nest
 * (a Heading sits inside a Section inside the page root): pointerWithin
 * prefers the smallest/most specific droppable actually under the
 * cursor, where rectIntersection's largest-overlap-area default would
 * keep favoring the outer container. autoScroll is dnd-kit's built-in
 * behavior, not custom code — it already discovers the Workspace's
 * scrollable region on its own; the config below only tunes the edge
 * activation band and stops automatically the instant a drag ends
 * (dnd-kit's own guarantee, not something this component manages).
 */
export function EditorApp({ fileMenuCommands, project, overlays }: EditorAppProps = {}) {
  const documentModel = useEditorStore((state) => state.document);
  const selection = useEditorStore((state) => state.selection);
  const clipboard = useEditorStore((state) => state.clipboard);
  const styleClipboard = useEditorStore((state) => state.styleClipboard);
  const hasPast = useEditorStore((state) => state.past.length > 0);
  const hasFuture = useEditorStore((state) => state.future.length > 0);
  const editorMode = useEditorStore((state) => state.editorMode);
  const insert = useInsertElement();
  const move = useMoveElement();
  const [activeDrag, setActiveDrag] = useState<ActiveDragPreview | null>(null);

  useEditorKeyboardShortcuts();
  useSnapPreferenceHydration();

  // The panels take no props and subscribe to the stores themselves, so the
  // same element objects let React skip them when only this component's
  // props change — the project header's save and recovery status flips
  // (PROJECT-1.5) no longer re-render a large Canvas and Structure tree.
  const workspaceContent = useMemo(() => <DocumentCanvas />, []);
  const workspaceControls = useMemo(() => <CanvasControlStrip />, []);
  const inspectorContent = useMemo(() => <InspectorContent selectedElement={null} />, []);
  const structureContent = useMemo(() => <StructurePanel />, []);

  const sensors = useSensors(useSensor(PointerSensor, POINTER_SENSOR_OPTIONS));

  // Cut/Copy/Duplicate act on the whole selection since BC-10.5 (one
  // element exactly as before; two or more as their selected subtrees), so
  // they are available whenever a selected element isn't the page root.
  const primarySelectedId = selection.primaryId ?? null;
  const hasEligiblePrimarySelection =
    (primarySelectedId !== null && primarySelectedId !== documentModel.id) || selection.ids.some((id) => id !== documentModel.id);
  const hasEligibleSelection = selection.ids.length > 0;

  const editMenuCommands: EditMenuCommands = {
    canUndo: hasPast,
    canRedo: hasFuture,
    canCut: hasEligiblePrimarySelection,
    canCopy: hasEligiblePrimarySelection,
    canDuplicate: hasEligiblePrimarySelection,
    canDelete: hasEligibleSelection,
    canPaste: clipboard !== null,
    onUndo: () => useEditorStore.getState().undo(),
    onRedo: () => useEditorStore.getState().redo(),
    onCut: () => useEditorStore.getState().cutSelection(),
    onCopy: () => useEditorStore.getState().copySelection(),
    onPaste: () => useEditorStore.getState().pasteClipboard(),
    onDuplicate: () => useEditorStore.getState().duplicateSelection(),
    // BC-10.2: two or more selected elements ask for confirmation first.
    onDelete: () => useEditorStore.getState().requestDeleteSelection(),
    // BC-11.2: Copy CSS reads the primary element; Paste CSS needs a copied
    // style and something selected (the store re-validates both).
    canCopyStyle: primarySelectedId !== null && primarySelectedId !== documentModel.id,
    canPasteStyle: styleClipboard !== null && selection.ids.some((id) => id !== documentModel.id),
    onCopyStyle: () => useEditorStore.getState().copyStyle(),
    onPasteStyle: () => useEditorStore.getState().pasteStyle(),
  };

  const previewControl = {
    mode: editorMode,
    onToggle: () =>
      editorMode === "preview"
        ? useEditorStore.getState().exitPreview()
        : useEditorStore.getState().enterPreview(),
  };

  // Never leave the Escape claim behind if the editor unmounts mid-drag.
  useEffect(
    () => () => {
      window.removeEventListener("keydown", claimEscapeDuringDrag, true);
      cancelFreeInsertion();
    },
    [],
  );

  function handleDragStart(event: DragStartEvent) {
    window.addEventListener("keydown", claimEscapeDuringDrag, true);
    const label = event.active.data.current?.label;
    setActiveDrag(typeof label === "string" ? { label } : null);

    // BC-13.6: a Resource Panel component (not a Canvas move) gets the live
    // Free insertion session; the pointer keeps the spot it held on the card.
    const elementType = event.active.data.current?.elementType;
    if (typeof elementType === "string" && isInsertableElementType(elementType)) {
      const activator = event.activatorEvent;
      const card = event.active.rect.current.initial;
      const pointer = activator instanceof PointerEvent || activator instanceof MouseEvent ? { x: activator.clientX, y: activator.clientY } : null;
      startFreeInsertion({
        prototype: createElementNode(elementType),
        label: typeof label === "string" ? label : elementType,
        pointer: pointer ?? { x: 0, y: 0 },
        hotspot: pointer && card && card.width > 0 && card.height > 0 ? { x: (pointer.x - card.left) / card.width, y: (pointer.y - card.top) / card.height } : { x: 0.5, y: 0.5 },
      });
    }
  }

  /** BC-13.6: the destination the drop would use right now (the shared insertion rule) — a Free container gets the live preview. */
  function handleDragMoveOrOver(event: DragMoveEvent | DragOverEvent) {
    const request = resolveDragEndInsertion(event, documentModel);
    if (!request) return; // not a Resource Panel component
    setFreeInsertionDestination(
      request.targetId ? resolveInsertionParent(documentModel, request.targetId, request.zone, primarySelectedId).parentId : null,
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    window.removeEventListener("keydown", claimEscapeDuringDrag, true);
    setActiveDrag(null);
    // The final pointer position is processed first; an interrupted drag inserts nothing.
    const { placement, interrupted } = finishFreeInsertion();
    if (interrupted) return;

    const moveRequest = resolveDragEndMove(event, documentModel);
    if (moveRequest) {
      move(moveRequest.nodeId, moveRequest.targetId, moveRequest.zone);
      return;
    }

    const insertRequest = resolveDragEndInsertion(event, documentModel);
    if (!insertRequest) return;

    // BC-13.6 (Decision 30): a drop into the Free container the preview was
    // showing lands exactly where the preview was; any other drop keeps the
    // existing placement.
    const parentId = insertRequest.targetId
      ? resolveInsertionParent(documentModel, insertRequest.targetId, insertRequest.zone, primarySelectedId).parentId
      : null;
    if (placement && parentId !== null && parentId !== placement.containerId && isAncestorOf(documentModel, parentId, placement.containerId)) {
      // dnd-kit reported a coarser (ancestor) target than the Free container
      // the preview was showing (its rects can lag the session's auto-scroll):
      // the drop goes where the preview was.
      insert(insertRequest.elementType, placement.containerId, "inside", placement.geometry);
      return;
    }
    const freeGeometry = placement && parentId === placement.containerId ? placement.geometry : undefined;
    insert(insertRequest.elementType, insertRequest.targetId, insertRequest.zone, freeGeometry);
  }

  function handleActivateCard(card: CatalogCardPlaceholder) {
    if (
      card.disabled ||
      !card.elementType ||
      !isInsertableElementType(card.elementType)
    ) {
      return;
    }
    insert(card.elementType);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      autoScroll={AUTO_SCROLL_OPTIONS}
      onDragStart={handleDragStart}
      onDragMove={handleDragMoveOrOver}
      onDragOver={handleDragMoveOrOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        window.removeEventListener("keydown", claimEscapeDuringDrag, true);
        setActiveDrag(null);
        cancelFreeInsertion(); // Escape, pointercancel, an interrupted drag: nothing is inserted
      }}
    >
      <AppShell
        workspaceContent={workspaceContent}
        workspaceControls={workspaceControls}
        inspectorContent={inspectorContent}
        structureContent={structureContent}
        onActivateCatalogCard={handleActivateCard}
        editMenuCommands={editMenuCommands}
        previewControl={previewControl}
        fileMenuCommands={fileMenuCommands}
        project={project}
      />
      <EditorNoticeBanner />
      <MultiDeleteConfirmDialog />
      {overlays}
      <DragOverlay>
        {activeDrag && (
          <div className="rounded-control border-accent/40 bg-surface-panel text-fg-primary shadow-elevated pointer-events-none flex items-center gap-2 border px-3 py-2 text-sm font-medium">
            {activeDrag.label}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

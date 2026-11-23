"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  defaultAnnouncements,
  pointerWithin,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { AppShell } from "@/components/layout/AppShell";
import type { EditMenuCommands, FileMenuCommands } from "@/components/layout/applicationMenus";
import type { ProjectIdentityInfo } from "@/components/layout/ProjectIdentity";
import type { CatalogCardPlaceholder } from "@/components/layout/creationToolbarCategories";
import { DocumentCanvas } from "@/features/canvas/components/DocumentCanvas";
import { EditorNoticeBanner } from "@/features/editor/components/EditorNoticeBanner";
import { MultiDeleteConfirmDialog } from "@/features/editor/components/MultiDeleteConfirmDialog";
import { StructurePanel } from "@/features/editor/components/structure/StructurePanel";
import { InspectorContent } from "@/features/inspector/components/InspectorContent";
import { isInsertableElementType } from "@/features/editor/factories/elementFactories";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { useEditorKeyboardShortcuts } from "@/features/editor/hooks/useEditorKeyboardShortcuts";
import { useInsertElement } from "@/features/editor/hooks/useInsertElement";
import { useMoveElement } from "@/features/editor/hooks/useMoveElement";
import { resolveDragEndInsertion } from "@/features/editor/utils/resolveDragEndInsertion";
import { resolveDragEndMove } from "@/features/editor/utils/resolveDragEndMove";
import { EditorPointerSensor } from "@/features/editor/utils/editorDragSensors";
import {
  describeStructureDragSet,
  isStructureDragData,
  resolveStructureDragSet,
  STRUCTURE_TREE_ATTRIBUTE,
} from "@/features/editor/components/structure/structureDragDrop";
import { findNodeById } from "@/features/editor/utils/findNodeById";
import { StructureDragPreview } from "@/features/editor/components/structure/StructureDragPreview";

interface ActiveDragPreview {
  label: string;
  /** BC-12.3: a Structure row drag shows its own compact chip. */
  structure?: { tag: string; count: number };
}

/**
 * BC-12.3: a Structure row drag hit-tests rows itself (useStructureDragDrop),
 * so it has no dnd-kit collisions at all — the Canvas never shows an
 * indicator or accepts a drop for it. Every other drag is unchanged.
 */
const collisionDetection: CollisionDetection = (args) => {
  if (isStructureDragData(args.active.data.current)) return [];
  // A Canvas node is never its own drop target (this replaced a per-node
  // `disabled` that re-rendered every node on every move — see
  // useNodeDropRegistration).
  return pointerWithin({ ...args, droppableContainers: args.droppableContainers.filter((container) => container.id !== args.active.id) });
};

/**
 * dnd-kit's default screen-reader announcements read raw ids. A Structure
 * drag announces itself in the Structure panel's live region instead, so
 * these stay silent for it (no duplicate speech); other drags keep the
 * defaults.
 */
const ANNOUNCEMENTS: Announcements = {
  onDragStart: (args) => (isStructureDragData(args.active.data.current) ? undefined : defaultAnnouncements.onDragStart(args)),
  onDragOver: (args) => (isStructureDragData(args.active.data.current) ? undefined : defaultAnnouncements.onDragOver(args)),
  onDragEnd: (args) => (isStructureDragData(args.active.data.current) ? undefined : defaultAnnouncements.onDragEnd(args)),
  onDragCancel: (args) => (isStructureDragData(args.active.data.current) ? undefined : defaultAnnouncements.onDragCancel(args)),
};

function isStructureScrollRegion(element: Element): boolean {
  return element instanceof HTMLElement && element.dataset.noDragAutoscroll !== undefined && element.querySelector(`[${STRUCTURE_TREE_ATTRIBUTE}]`) !== null;
}

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
 * threshold and acceleration are unchanged.
 *
 * BC-12.3 (D4): the one exception is a Structure row drag, which scrolls
 * only the scroll region holding the Structure tree (never the Canvas, the
 * Inspector or the page), and only while that drag is active.
 */
const AUTO_SCROLL_THRESHOLD = { x: 0, y: 0.2 };
const AUTO_SCROLL_ACCELERATION = 10;

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
  const structureDragActive = useRef(false);
  // BC-12.3: a Structure drag has no drop animation. Kept after the drop on
  // purpose — the animation runs after onDragEnd, and for ~250 ms its overlay
  // covered the Structure panel and swallowed the next press on a handle.
  const [lastDragWasStructure, setLastDragWasStructure] = useState(false);
  // One object for the component's lifetime (see POINTER_SENSOR_OPTIONS); canScroll reads the ref only while dragging.
  const autoScrollOptions = useMemo(
    () => ({
      threshold: AUTO_SCROLL_THRESHOLD,
      acceleration: AUTO_SCROLL_ACCELERATION,
      canScroll: (element: Element) =>
        structureDragActive.current
          ? isStructureScrollRegion(element)
          : !(element instanceof HTMLElement && element.dataset.noDragAutoscroll !== undefined),
    }),
    [],
  );

  useEditorKeyboardShortcuts();

  // The panels take no props and subscribe to the stores themselves, so the
  // same element objects let React skip them when only this component's
  // props change — the project header's save and recovery status flips
  // (PROJECT-1.5) no longer re-render a large Canvas and Structure tree.
  const workspaceContent = useMemo(() => <DocumentCanvas />, []);
  const inspectorContent = useMemo(() => <InspectorContent selectedElement={null} />, []);
  const structureContent = useMemo(() => <StructurePanel />, []);

  const sensors = useSensors(useSensor(EditorPointerSensor, POINTER_SENSOR_OPTIONS));

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

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current;
    structureDragActive.current = isStructureDragData(data);
    setLastDragWasStructure(isStructureDragData(data));
    if (isStructureDragData(data)) {
      // BC-12.4: the chip shows what this drag moves (resolved like the Structure panel does).
      const store = useEditorStore.getState();
      const moved = resolveStructureDragSet(store.document, store.selection.ids, data.nodeId);
      const { label, count } = describeStructureDragSet(store.document, moved, data.nodeId, data.label);
      const tag = moved.length === 1 && moved[0] !== data.nodeId ? (findNodeById(store.document, moved[0])?.tag ?? data.tag) : data.tag;
      setActiveDrag({ label, structure: { tag, count } });
      return;
    }
    const label = data?.label;
    setActiveDrag(typeof label === "string" ? { label } : null);
  }

  function endDrag() {
    structureDragActive.current = false;
    setActiveDrag(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    endDrag();
    // BC-12.3: a Structure drop is committed by the Structure panel itself.
    if (isStructureDragData(event.active.data.current)) return;

    const moveRequest = resolveDragEndMove(event, documentModel);
    if (moveRequest) {
      move(moveRequest.nodeId, moveRequest.targetId, moveRequest.zone);
      return;
    }

    const insertRequest = resolveDragEndInsertion(event, documentModel);
    if (!insertRequest) return;

    insert(insertRequest.elementType, insertRequest.targetId, insertRequest.zone);
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
      autoScroll={autoScrollOptions}
      accessibility={{ announcements: ANNOUNCEMENTS }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={endDrag}
    >
      <AppShell
        workspaceContent={workspaceContent}
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
      <DragOverlay dropAnimation={lastDragWasStructure ? null : undefined}>
        {activeDrag?.structure ? (
          <StructureDragPreview label={activeDrag.label} tag={activeDrag.structure.tag} count={activeDrag.structure.count} />
        ) : activeDrag && (
          <div className="rounded-control border-accent/40 bg-surface-panel text-fg-primary shadow-elevated pointer-events-none flex items-center gap-2 border px-3 py-2 text-sm font-medium">
            {activeDrag.label}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

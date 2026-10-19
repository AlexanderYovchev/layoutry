"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { AppShell } from "@/components/layout/AppShell";
import type { EditMenuCommands } from "@/components/layout/applicationMenus";
import type { CatalogCardPlaceholder } from "@/components/layout/creationToolbarCategories";
import { DocumentCanvas } from "@/features/canvas/components/DocumentCanvas";
import { EditorNoticeBanner } from "@/features/editor/components/EditorNoticeBanner";
import { StructurePanel } from "@/features/editor/components/structure/StructurePanel";
import { InspectorContent } from "@/features/inspector/components/InspectorContent";
import { isInsertableElementType } from "@/features/editor/factories/elementFactories";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { useEditorKeyboardShortcuts } from "@/features/editor/hooks/useEditorKeyboardShortcuts";
import { useInsertElement } from "@/features/editor/hooks/useInsertElement";
import { useMoveElement } from "@/features/editor/hooks/useMoveElement";
import { resolveDragEndInsertion } from "@/features/editor/utils/resolveDragEndInsertion";
import { resolveDragEndMove } from "@/features/editor/utils/resolveDragEndMove";

interface ActiveDragPreview {
  label: string;
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
export function EditorApp() {
  const documentModel = useEditorStore((state) => state.document);
  const selection = useEditorStore((state) => state.selection);
  const clipboard = useEditorStore((state) => state.clipboard);
  const hasPast = useEditorStore((state) => state.past.length > 0);
  const hasFuture = useEditorStore((state) => state.future.length > 0);
  const editorMode = useEditorStore((state) => state.editorMode);
  const insert = useInsertElement();
  const move = useMoveElement();
  const [activeDrag, setActiveDrag] = useState<ActiveDragPreview | null>(null);

  useEditorKeyboardShortcuts();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  // Cut/Copy/Duplicate stay single-target (primary-only) operations this
  // checkpoint (Checkpoint 1.15.2 explicitly deferred multi-node clipboard/
  // duplicate — see this checkpoint's report, section M); Delete already
  // supports the full selection, so its own menu/shortcut availability is
  // keyed off the whole selection instead.
  const primarySelectedId = selection.primaryId ?? null;
  const hasEligiblePrimarySelection = primarySelectedId !== null && primarySelectedId !== documentModel.id;
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
    onDelete: () => useEditorStore.getState().deleteSelection(),
  };

  const previewControl = {
    mode: editorMode,
    onToggle: () =>
      editorMode === "preview"
        ? useEditorStore.getState().exitPreview()
        : useEditorStore.getState().enterPreview(),
  };

  function handleDragStart(event: DragStartEvent) {
    const label = event.active.data.current?.label;
    setActiveDrag(typeof label === "string" ? { label } : null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDrag(null);

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
      collisionDetection={pointerWithin}
      autoScroll={{ threshold: { x: 0, y: 0.2 }, acceleration: 10 }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDrag(null)}
    >
      <AppShell
        workspaceContent={<DocumentCanvas />}
        inspectorContent={<InspectorContent selectedElement={null} />}
        structureContent={<StructurePanel />}
        onActivateCatalogCard={handleActivateCard}
        editMenuCommands={editMenuCommands}
        previewControl={previewControl}
      />
      <EditorNoticeBanner />
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

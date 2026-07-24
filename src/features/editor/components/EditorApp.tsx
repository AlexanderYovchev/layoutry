"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { AppShell } from "@/components/layout/AppShell";
import type { CatalogCardPlaceholder } from "@/components/layout/creationToolbarCategories";
import { DocumentCanvas } from "@/features/canvas/components/DocumentCanvas";
import { StructurePanel } from "@/features/editor/components/structure/StructurePanel";
import { InspectorContent } from "@/features/inspector/components/InspectorContent";
import { isInsertableElementType } from "@/features/editor/factories/elementFactories";
import { useInsertElement } from "@/features/editor/hooks/useInsertElement";
import { resolveDragEndInsertion } from "@/features/editor/utils/resolveDragEndInsertion";

interface ActiveDragPreview {
  label: string;
}

/**
 * The editor's top-level composition root: assembles AppShell with real
 * feature content (same as page.tsx did through Checkpoint 3.2) and adds
 * the one thing that now needs real hooks — a shared DndContext plus the
 * click/drag insertion wiring — which is why this moved out of page.tsx
 * (a Server Component) into its own "use client" feature component.
 * Click-to-insert (via onActivateCatalogCard) and drag-to-insert (via
 * onDragEnd) both call the exact same useInsertElement pipeline.
 */
export function EditorApp() {
  const insert = useInsertElement();
  const [activeDrag, setActiveDrag] = useState<ActiveDragPreview | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  function handleDragStart(event: DragStartEvent) {
    const label = event.active.data.current?.label;
    setActiveDrag(typeof label === "string" ? { label } : null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDrag(null);

    const request = resolveDragEndInsertion(event);
    if (!request) return;

    insert(request.elementType, request.targetParentId);
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
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDrag(null)}
    >
      <AppShell
        workspaceContent={<DocumentCanvas />}
        inspectorContent={<InspectorContent selectedElement={null} />}
        structureContent={<StructurePanel />}
        onActivateCatalogCard={handleActivateCard}
      />
      <DragOverlay>
        {activeDrag && (
          <div className="pointer-events-none flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-md dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
            {activeDrag.label}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

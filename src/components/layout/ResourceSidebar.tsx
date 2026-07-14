"use client";

import { useState, type PointerEvent, type ReactNode } from "react";
import { ResizeHandle } from "@/components/ui/resizable/ResizeHandle";
import { ResourceContextPanel } from "@/components/layout/ResourceContextPanel";
import { ResourceNavigationRail } from "@/components/layout/ResourceNavigationRail";
import {
  resourcePanelSections,
  type ResourceSectionId,
} from "@/components/layout/resourcePanelSections";

interface ResourceSidebarProps {
  structureContent?: ReactNode;
  width: number;
  isDragging: boolean;
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
}

export function ResourceSidebar({
  structureContent,
  width,
  isDragging,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: ResourceSidebarProps) {
  const [activeSectionId, setActiveSectionId] = useState<ResourceSectionId>(
    resourcePanelSections[0].id,
  );

  const activeSection =
    resourcePanelSections.find((section) => section.id === activeSectionId) ??
    resourcePanelSections[0];

  return (
    <aside
      aria-label="Resource panel"
      style={{ width }}
      className="relative flex shrink-0 border-r border-zinc-200 dark:border-zinc-800"
    >
      <ResourceNavigationRail
        activeSectionId={activeSectionId}
        onSelect={setActiveSectionId}
      />

      <div className="min-w-0 flex-1 overflow-hidden">
        <ResourceContextPanel
          section={activeSection}
          structureContent={structureContent}
        />
      </div>

      <ResizeHandle
        className="right-0"
        isDragging={isDragging}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />
    </aside>
  );
}

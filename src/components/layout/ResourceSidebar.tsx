"use client";

import { useState, type ReactNode } from "react";
import { ResizeHandle } from "@/components/ui/resizable/ResizeHandle";
import { useResizablePanelWidth } from "@/components/ui/resizable/useResizablePanelWidth";
import { ResourceContextPanel } from "@/components/layout/ResourceContextPanel";
import { ResourceNavigationRail } from "@/components/layout/ResourceNavigationRail";
import {
  resourcePanelSections,
  type ResourceSectionId,
} from "@/components/layout/resourcePanelSections";

const RESOURCE_PANEL_DEFAULT_WIDTH = 280;
const RESOURCE_PANEL_MIN_WIDTH = 220;
const RESOURCE_PANEL_MAX_WIDTH = 520;

interface ResourceSidebarProps {
  structureContent?: ReactNode;
}

export function ResourceSidebar({ structureContent }: ResourceSidebarProps) {
  const [activeSectionId, setActiveSectionId] = useState<ResourceSectionId>(
    resourcePanelSections[0].id,
  );

  const activeSection =
    resourcePanelSections.find((section) => section.id === activeSectionId) ??
    resourcePanelSections[0];

  const {
    width,
    isDragging,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  } = useResizablePanelWidth({
    storageKey: "layoutry:resource-panel-width",
    defaultWidth: RESOURCE_PANEL_DEFAULT_WIDTH,
    minWidth: RESOURCE_PANEL_MIN_WIDTH,
    maxWidth: RESOURCE_PANEL_MAX_WIDTH,
    growDirection: "right",
  });

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
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
    </aside>
  );
}

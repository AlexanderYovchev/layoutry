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
  minWidth: number;
  maxWidth: number;
  isDragging: boolean;
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
}

export function ResourceSidebar({
  structureContent,
  width,
  minWidth,
  maxWidth,
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
    // `width` includes the 8px outer gutter (pl-2), so the shell's width
    // budget (computeAppliedPanelWidths) is unchanged by the card layout.
    <aside
      aria-label="Resource panel"
      style={{ width }}
      className="relative flex shrink-0 pl-2"
    >
      <div className="rounded-surface border-line bg-surface-panel shadow-panel flex min-w-0 flex-1 overflow-hidden border">
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
      </div>

      {/* Centered on the 8px gutter between this card and the Workspace (10px hit target, 1px line). */}
      <ResizeHandle
        aria-label="Resize Resource Panel"
        valueNow={width}
        valueMin={minWidth}
        valueMax={maxWidth}
        className="-right-2.25"
        isDragging={isDragging}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />
    </aside>
  );
}

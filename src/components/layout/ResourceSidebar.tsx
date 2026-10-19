"use client";

import { useId, useState, type PointerEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ResizeHandle } from "@/components/ui/resizable/ResizeHandle";
import { ResourceContextPanel } from "@/components/layout/ResourceContextPanel";
import { ResourceNavigationRail } from "@/components/layout/ResourceNavigationRail";
import type { CatalogCardPlaceholder } from "@/components/layout/creationToolbarCategories";
import {
  resourcePanelSections,
  type ResourceSectionId,
} from "@/components/layout/resourcePanelSections";

interface ResourceSidebarProps {
  structureContent?: ReactNode;
  /** Click-to-insert for the Elements/Components library tiles — the same handler the creation toolbar uses. */
  onActivateCard?: (card: CatalogCardPlaceholder) => void;
  width: number;
  minWidth: number;
  maxWidth: number;
  isDragging: boolean;
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
  /** Collapsed to just the navigation rail (UI-1.6) — distinct from being hidden via the View menu, which unmounts the panel. */
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  /** Animate the width change (only while a collapse/expand is in progress — never during a drag-resize). */
  animateWidth?: boolean;
}

export function ResourceSidebar({
  structureContent,
  onActivateCard,
  width,
  minWidth,
  maxWidth,
  isDragging,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  collapsed = false,
  onToggleCollapsed,
  animateWidth = false,
}: ResourceSidebarProps) {
  const contentId = useId();
  const [activeSectionId, setActiveSectionId] = useState<ResourceSectionId>(
    resourcePanelSections[0].id,
  );

  const activeSection =
    resourcePanelSections.find((section) => section.id === activeSectionId) ??
    resourcePanelSections[0];

  // A rail section clicked while collapsed is a request to see it: select
  // it and expand in one action.
  function handleSelect(sectionId: ResourceSectionId) {
    setActiveSectionId(sectionId);
    if (collapsed) onToggleCollapsed?.();
  }

  return (
    // `width` includes the 8px outer gutter (pl-2), so the shell's width
    // budget (computeAppliedPanelWidths) is unchanged by the card layout.
    <aside
      aria-label="Resource panel"
      data-collapsed={collapsed || undefined}
      style={{ width }}
      className={cn(
        "relative flex shrink-0 pl-2",
        animateWidth &&
          "ease-studio transition-[width] duration-(--ly-motion-slow)",
      )}
    >
      <div
        className={cn(
          "rounded-surface border-line bg-surface-panel shadow-panel flex min-w-0 flex-1 border",
          // The rail rounds its own corners, so clipping is only needed
          // for the full panel; collapsed, the rail's tooltips must be
          // free to extend past it.
          !collapsed && "overflow-hidden",
        )}
      >
        <ResourceNavigationRail
          activeSectionId={activeSectionId}
          onSelect={handleSelect}
          collapsed={collapsed}
          onToggleCollapsed={() => onToggleCollapsed?.()}
          contentId={contentId}
        />

        {/*
         * Stays mounted while collapsed (display:none), so the active
         * section, library search/filter and Structure tree state all
         * survive a collapse; display:none also takes it out of the tab
         * order and the accessibility tree.
         */}
        <div
          id={contentId}
          className={cn(
            "min-w-0 flex-1 overflow-hidden",
            collapsed && "hidden",
            // Fade the content in after an expand toggle only (not on page
            // load): it appears once the width transition is under way.
            !collapsed &&
              animateWidth &&
              "transition-opacity delay-100 duration-(--ly-motion-standard) starting:opacity-0",
          )}
        >
          <ResourceContextPanel
            section={activeSection}
            structureContent={structureContent}
            onActivateCard={onActivateCard}
          />
        </div>
      </div>

      {/* Centered on the 8px gutter between this card and the Workspace (10px hit target, 1px line). Unavailable while collapsed: the rail has a fixed width. */}
      {!collapsed && (
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
      )}
    </aside>
  );
}

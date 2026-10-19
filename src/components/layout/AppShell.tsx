"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { CreationToolbar } from "@/components/layout/CreationToolbar";
import type { PreviewControl } from "@/components/layout/GlobalActions";
import { InspectorPanel } from "@/components/layout/InspectorPanel";
import { ResourceSidebar } from "@/components/layout/ResourceSidebar";
import { StatusBar } from "@/components/layout/StatusBar";
import { UnsupportedViewportNotice } from "@/components/layout/UnsupportedViewportNotice";
import { Workspace } from "@/components/layout/Workspace";
import { computeAppliedPanelWidths } from "@/components/ui/resizable/computeAppliedPanelWidths";
import { useResizablePanelWidth } from "@/components/ui/resizable/useResizablePanelWidth";
import { useViewportWidth } from "@/components/ui/viewport/useViewportWidth";
import type { EditMenuCommands, ViewState } from "@/components/layout/applicationMenus";
import type { CatalogCardPlaceholder } from "@/components/layout/creationToolbarCategories";

interface AppShellProps {
  workspaceContent: ReactNode;
  inspectorContent: ReactNode;
  structureContent?: ReactNode;
  onActivateCatalogCard?: (card: CatalogCardPlaceholder) => void;
  editMenuCommands: EditMenuCommands;
  previewControl: PreviewControl;
}

const initialViewState: ViewState = {
  resourcePanelVisible: true,
  inspectorPanelVisible: true,
  statusBarVisible: true,
};

/**
 * Collapse is a third panel state, distinct from ViewState's hidden
 * (UI-1.6): a collapsed panel stays mounted as a narrow rail (its own
 * state preserved, one action to restore), while a hidden panel is
 * unmounted by the View menu. Hidden wins: re-showing a panel restores
 * whichever collapse state it had. Session-only, like ViewState; the
 * expanded width preference (localStorage) is never touched by it.
 */
interface PanelCollapseState {
  resource: boolean;
  inspector: boolean;
}

const initialCollapseState: PanelCollapseState = {
  resource: false,
  inspector: false,
};

// Collapsed rail widths, gutters included (same convention as the
// expanded widths): Resource = 8px gutter + 2px card border + 56px icon
// rail; Inspector = 8px gutter + 48px card.
const RESOURCE_PANEL_COLLAPSED_WIDTH = 66;
const INSPECTOR_COLLAPSED_WIDTH = 56;

// Covers the 240ms --ly-motion-slow width transition plus a frame of
// slack; the transition class is only applied during this window so
// drag-resizing and viewport clamping never animate.
const PANEL_TOGGLE_ANIMATION_MS = 300;

const RESOURCE_PANEL_DEFAULT_WIDTH = 280;
const RESOURCE_PANEL_MIN_WIDTH = 220;
const RESOURCE_PANEL_MAX_WIDTH = 520;

const INSPECTOR_DEFAULT_WIDTH = 300;
const INSPECTOR_MIN_WIDTH = 260;
const INSPECTOR_MAX_WIDTH = 520;

// Matches Workspace's own 420px floor (min-w-101 + its 2 × 8px gutters) — the width below which
// the canvas stops feeling like a recognizable page (see Workspace.tsx).
const MIN_WORKSPACE_WIDTH = 420;

// The narrowest width at which the Resource Panel, Inspector, and
// Workspace can all sit at their own minimums with zero overlap:
// 220 + 260 + 420. Below this the shell cannot lay itself out safely, so
// a dedicated notice is shown instead of a broken editor.
const MIN_SUPPORTED_VIEWPORT_WIDTH =
  RESOURCE_PANEL_MIN_WIDTH + INSPECTOR_MIN_WIDTH + MIN_WORKSPACE_WIDTH;

export function AppShell({
  workspaceContent,
  inspectorContent,
  structureContent,
  onActivateCatalogCard,
  editMenuCommands,
  previewControl,
}: AppShellProps) {
  const [viewState, setViewState] = useState<ViewState>(initialViewState);
  const [collapseState, setCollapseState] =
    useState<PanelCollapseState>(initialCollapseState);
  const [isPanelToggleAnimating, setIsPanelToggleAnimating] = useState(false);
  const animationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(
    () => () => {
      if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current);
    },
    [],
  );
  const viewportWidth = useViewportWidth();

  const resourcePanel = useResizablePanelWidth({
    storageKey: "layoutry:resource-panel-width",
    defaultWidth: RESOURCE_PANEL_DEFAULT_WIDTH,
    minWidth: RESOURCE_PANEL_MIN_WIDTH,
    maxWidth: RESOURCE_PANEL_MAX_WIDTH,
    growDirection: "right",
  });

  const inspectorPanel = useResizablePanelWidth({
    storageKey: "layoutry:inspector-panel-width",
    defaultWidth: INSPECTOR_DEFAULT_WIDTH,
    minWidth: INSPECTOR_MIN_WIDTH,
    maxWidth: INSPECTOR_MAX_WIDTH,
    growDirection: "left",
  });

  function handleToggleView(region: keyof ViewState) {
    setViewState((current) => ({ ...current, [region]: !current[region] }));
  }

  function handleToggleCollapsed(panel: keyof PanelCollapseState) {
    setCollapseState((current) => ({ ...current, [panel]: !current[panel] }));
    setIsPanelToggleAnimating(true);
    if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current);
    animationTimeoutRef.current = setTimeout(
      () => setIsPanelToggleAnimating(false),
      PANEL_TOGGLE_ANIMATION_MS,
    );
  }

  if (viewportWidth < MIN_SUPPORTED_VIEWPORT_WIDTH) {
    return <UnsupportedViewportNotice />;
  }

  // Hidden panels contribute nothing to the shared width budget; a
  // collapsed panel contributes exactly its fixed rail width (as both its
  // width and its minimum, so it is never squeezed). Both rail widths are
  // below the expanded minimums, so MIN_SUPPORTED_VIEWPORT_WIDTH — computed
  // from the expanded minimums — still covers every combination.
  const resourceCollapsed = collapseState.resource;
  const inspectorCollapsed = collapseState.inspector;
  const { resourceWidth, inspectorWidth } = computeAppliedPanelWidths({
    viewportWidth,
    resourceWidth: !viewState.resourcePanelVisible
      ? 0
      : resourceCollapsed
        ? RESOURCE_PANEL_COLLAPSED_WIDTH
        : resourcePanel.width,
    resourceMinWidth: !viewState.resourcePanelVisible
      ? 0
      : resourceCollapsed
        ? RESOURCE_PANEL_COLLAPSED_WIDTH
        : RESOURCE_PANEL_MIN_WIDTH,
    inspectorWidth: !viewState.inspectorPanelVisible
      ? 0
      : inspectorCollapsed
        ? INSPECTOR_COLLAPSED_WIDTH
        : inspectorPanel.width,
    inspectorMinWidth: !viewState.inspectorPanelVisible
      ? 0
      : inspectorCollapsed
        ? INSPECTOR_COLLAPSED_WIDTH
        : INSPECTOR_MIN_WIDTH,
    minWorkspaceWidth: MIN_WORKSPACE_WIDTH,
  });

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-surface-app">
      <AppHeader
        viewState={viewState}
        onToggleView={handleToggleView}
        editMenuCommands={editMenuCommands}
        previewControl={previewControl}
      />
      <CreationToolbar onActivateCard={onActivateCatalogCard} />
      <div className="flex min-h-0 flex-1 overflow-x-auto py-2">
        {viewState.resourcePanelVisible && (
          <ResourceSidebar
            structureContent={structureContent}
            onActivateCard={onActivateCatalogCard}
            width={resourceWidth}
            minWidth={RESOURCE_PANEL_MIN_WIDTH}
            maxWidth={RESOURCE_PANEL_MAX_WIDTH}
            isDragging={resourcePanel.isDragging}
            onPointerDown={(event) =>
              resourcePanel.handlePointerDown(event, resourceWidth)
            }
            onPointerMove={resourcePanel.handlePointerMove}
            onPointerUp={resourcePanel.handlePointerUp}
            collapsed={resourceCollapsed}
            onToggleCollapsed={() => handleToggleCollapsed("resource")}
            animateWidth={isPanelToggleAnimating && !resourcePanel.isDragging}
          />
        )}
        <Workspace>{workspaceContent}</Workspace>
        {viewState.inspectorPanelVisible && (
          <InspectorPanel
            width={inspectorWidth}
            minWidth={INSPECTOR_MIN_WIDTH}
            maxWidth={INSPECTOR_MAX_WIDTH}
            isDragging={inspectorPanel.isDragging}
            onPointerDown={(event) =>
              inspectorPanel.handlePointerDown(event, inspectorWidth)
            }
            onPointerMove={inspectorPanel.handlePointerMove}
            onPointerUp={inspectorPanel.handlePointerUp}
            collapsed={inspectorCollapsed}
            onToggleCollapsed={() => handleToggleCollapsed("inspector")}
            animateWidth={isPanelToggleAnimating && !inspectorPanel.isDragging}
          >
            {inspectorContent}
          </InspectorPanel>
        )}
      </div>
      {viewState.statusBarVisible && <StatusBar mode={previewControl.mode} />}
    </div>
  );
}

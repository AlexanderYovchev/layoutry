"use client";

import { useState, type ReactNode } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { CreationToolbar } from "@/components/layout/CreationToolbar";
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
}

const initialViewState: ViewState = {
  resourcePanelVisible: true,
  inspectorPanelVisible: true,
  statusBarVisible: true,
};

const RESOURCE_PANEL_DEFAULT_WIDTH = 280;
const RESOURCE_PANEL_MIN_WIDTH = 220;
const RESOURCE_PANEL_MAX_WIDTH = 520;

const INSPECTOR_DEFAULT_WIDTH = 300;
const INSPECTOR_MIN_WIDTH = 260;
const INSPECTOR_MAX_WIDTH = 520;

// Matches Workspace's own min-w-105 (420px) floor — the width below which
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
}: AppShellProps) {
  const [viewState, setViewState] = useState<ViewState>(initialViewState);
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

  if (viewportWidth < MIN_SUPPORTED_VIEWPORT_WIDTH) {
    return <UnsupportedViewportNotice />;
  }

  // Hidden panels contribute nothing to the shared width budget.
  const { resourceWidth, inspectorWidth } = computeAppliedPanelWidths({
    viewportWidth,
    resourceWidth: viewState.resourcePanelVisible ? resourcePanel.width : 0,
    resourceMinWidth: viewState.resourcePanelVisible
      ? RESOURCE_PANEL_MIN_WIDTH
      : 0,
    inspectorWidth: viewState.inspectorPanelVisible ? inspectorPanel.width : 0,
    inspectorMinWidth: viewState.inspectorPanelVisible
      ? INSPECTOR_MIN_WIDTH
      : 0,
    minWorkspaceWidth: MIN_WORKSPACE_WIDTH,
  });

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-white dark:bg-black">
      <AppHeader
        viewState={viewState}
        onToggleView={handleToggleView}
        editMenuCommands={editMenuCommands}
      />
      <CreationToolbar onActivateCard={onActivateCatalogCard} />
      <div className="flex min-h-0 flex-1 overflow-x-auto">
        {viewState.resourcePanelVisible && (
          <ResourceSidebar
            structureContent={structureContent}
            width={resourceWidth}
            minWidth={RESOURCE_PANEL_MIN_WIDTH}
            maxWidth={RESOURCE_PANEL_MAX_WIDTH}
            isDragging={resourcePanel.isDragging}
            onPointerDown={(event) =>
              resourcePanel.handlePointerDown(event, resourceWidth)
            }
            onPointerMove={resourcePanel.handlePointerMove}
            onPointerUp={resourcePanel.handlePointerUp}
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
          >
            {inspectorContent}
          </InspectorPanel>
        )}
      </div>
      {viewState.statusBarVisible && <StatusBar />}
    </div>
  );
}

"use client";

import { useState, type ReactNode } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { CreationToolbar } from "@/components/layout/CreationToolbar";
import { InspectorPanel } from "@/components/layout/InspectorPanel";
import { ResourceSidebar } from "@/components/layout/ResourceSidebar";
import { StatusBar } from "@/components/layout/StatusBar";
import { Workspace } from "@/components/layout/Workspace";
import type { ViewState } from "@/components/layout/applicationMenus";

interface AppShellProps {
  workspaceContent: ReactNode;
  inspectorContent: ReactNode;
}

const initialViewState: ViewState = {
  resourcePanelVisible: true,
  inspectorPanelVisible: true,
  statusBarVisible: true,
};

export function AppShell({
  workspaceContent,
  inspectorContent,
}: AppShellProps) {
  const [viewState, setViewState] = useState<ViewState>(initialViewState);

  function handleToggleView(region: keyof ViewState) {
    setViewState((current) => ({ ...current, [region]: !current[region] }));
  }

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-white dark:bg-black">
      <AppHeader viewState={viewState} onToggleView={handleToggleView} />
      <CreationToolbar />
      <div className="flex min-h-0 flex-1 overflow-x-auto">
        {viewState.resourcePanelVisible && <ResourceSidebar />}
        <Workspace>{workspaceContent}</Workspace>
        {viewState.inspectorPanelVisible && (
          <InspectorPanel>{inspectorContent}</InspectorPanel>
        )}
      </div>
      {viewState.statusBarVisible && <StatusBar />}
    </div>
  );
}

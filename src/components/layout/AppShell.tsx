import { AppHeader } from "@/components/layout/AppHeader";
import { CreationToolbar } from "@/components/layout/CreationToolbar";
import { InspectorPanel } from "@/components/layout/InspectorPanel";
import { ResourceSidebar } from "@/components/layout/ResourceSidebar";
import { StatusBar } from "@/components/layout/StatusBar";
import { Workspace } from "@/components/layout/Workspace";

interface AppShellProps {
  workspaceContent: React.ReactNode;
  inspectorContent: React.ReactNode;
}

export function AppShell({
  workspaceContent,
  inspectorContent,
}: AppShellProps) {
  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-white dark:bg-black">
      <AppHeader />
      <CreationToolbar />
      <div className="flex min-h-0 flex-1">
        <ResourceSidebar />
        <Workspace>{workspaceContent}</Workspace>
        <InspectorPanel>{inspectorContent}</InspectorPanel>
      </div>
      <StatusBar />
    </div>
  );
}

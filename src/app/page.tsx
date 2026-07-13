import { AppShell } from "@/components/layout/AppShell";
import { CanvasPlaceholder } from "@/features/canvas/components/CanvasPlaceholder";
import { InspectorPlaceholder } from "@/features/inspector/components/InspectorPlaceholder";

export default function Home() {
  return (
    <AppShell
      workspaceContent={<CanvasPlaceholder />}
      inspectorContent={<InspectorPlaceholder />}
    />
  );
}

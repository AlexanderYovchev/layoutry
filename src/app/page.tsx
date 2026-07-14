import { AppShell } from "@/components/layout/AppShell";
import { CanvasPlaceholder } from "@/features/canvas/components/CanvasPlaceholder";
import { StructurePanel } from "@/features/editor/components/structure/StructurePanel";
import { InspectorContent } from "@/features/inspector/components/InspectorContent";

export default function Home() {
  return (
    <AppShell
      workspaceContent={<CanvasPlaceholder />}
      inspectorContent={<InspectorContent selectedElement={null} />}
      structureContent={<StructurePanel />}
    />
  );
}

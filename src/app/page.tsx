import { AppShell } from "@/components/layout/AppShell";
import { DocumentCanvas } from "@/features/canvas/components/DocumentCanvas";
import { StructurePanel } from "@/features/editor/components/structure/StructurePanel";
import { InspectorContent } from "@/features/inspector/components/InspectorContent";

export default function Home() {
  return (
    <AppShell
      workspaceContent={<DocumentCanvas />}
      inspectorContent={<InspectorContent selectedElement={null} />}
      structureContent={<StructurePanel />}
    />
  );
}

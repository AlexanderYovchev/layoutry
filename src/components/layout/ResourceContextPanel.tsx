import { ResourcePlaceholderMessage } from "@/components/layout/ResourcePlaceholderMessage";
import type { ResourcePanelSection } from "@/components/layout/resourcePanelSections";
import { StructureTree } from "@/components/layout/StructureTree";

interface ResourceContextPanelProps {
  section: ResourcePanelSection;
}

export function ResourceContextPanel({ section }: ResourceContextPanelProps) {
  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {section.label}
        </p>
      </div>
      <div
        role="tabpanel"
        id={`resource-panel-${section.id}`}
        aria-labelledby={`resource-tab-${section.id}`}
        className="min-h-0 flex-1 overflow-y-auto p-3"
      >
        {section.id === "structure" ? (
          <StructureTree />
        ) : (
          <ResourcePlaceholderMessage description={section.description} />
        )}
      </div>
    </div>
  );
}

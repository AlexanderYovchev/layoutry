import type { ReactNode } from "react";
import { ResourcePlaceholderMessage } from "@/components/layout/ResourcePlaceholderMessage";
import type { ResourcePanelSection } from "@/components/layout/resourcePanelSections";

interface ResourceContextPanelProps {
  section: ResourcePanelSection;
  structureContent?: ReactNode;
}

export function ResourceContextPanel({
  section,
  structureContent,
}: ResourceContextPanelProps) {
  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {section.label}
        </h2>
      </div>
      <div
        role="tabpanel"
        id={`resource-panel-${section.id}`}
        aria-labelledby={`resource-tab-${section.id}`}
        className="min-h-0 flex-1 overflow-y-auto p-3"
      >
        {section.id === "structure" ? (
          structureContent
        ) : (
          <ResourcePlaceholderMessage description={section.description} />
        )}
      </div>
    </div>
  );
}
